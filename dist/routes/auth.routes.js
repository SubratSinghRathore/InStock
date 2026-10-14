"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const Business_1 = require("../models/Business");
const env_1 = require("../config/env");
const validate_1 = require("../middleware/validate");
const auth_1 = require("../middleware/auth");
const auth_validator_1 = require("../validators/auth.validator");
const error_1 = require("../middleware/error");
const router = (0, express_1.Router)();
const generateTokens = (userId, businessId, role) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId, businessId, role }, env_1.config.jwt.accessSecret, { expiresIn: env_1.config.jwt.accessExpiry });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, businessId, role }, env_1.config.jwt.refreshSecret, { expiresIn: env_1.config.jwt.refreshExpiry });
    return { accessToken, refreshToken };
};
// POST /api/v1/auth/register
router.post('/register', (0, validate_1.validateBody)(auth_validator_1.registerSchema), async (req, res, next) => {
    try {
        const { businessName, name, email, password, currency } = req.body;
        const existingUser = await User_1.User.findOne({ email });
        if (existingUser) {
            throw new error_1.AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
        }
        // 1. Create Business
        const business = await Business_1.Business.create({
            name: businessName,
            currency: currency || 'USD',
            contactEmail: email,
        });
        // 2. Hash Password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // 3. Create User (Owner)
        const user = await User_1.User.create({
            businessId: business._id,
            name,
            email,
            password: hashedPassword,
            role: 'owner',
        });
        // 4. Generate Tokens
        const { accessToken, refreshToken } = generateTokens(user._id.toString(), business._id.toString(), user.role);
        user.refreshTokens.push(refreshToken);
        await user.save();
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: business._id,
                },
                business: {
                    id: business._id,
                    name: business.name,
                    currency: business.currency,
                },
                tokens: {
                    accessToken,
                    refreshToken,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/auth/login
router.post('/login', (0, validate_1.validateBody)(auth_validator_1.loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await User_1.User.findOne({ email });
        if (!user) {
            throw new error_1.AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!isMatch) {
            throw new error_1.AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
        }
        const business = await Business_1.Business.findById(user.businessId);
        if (!business) {
            throw new error_1.AppError('Associated business not found', 404, 'BUSINESS_NOT_FOUND');
        }
        const { accessToken, refreshToken } = generateTokens(user._id.toString(), business._id.toString(), user.role);
        // Keep only latest 5 refresh tokens to prevent unbounded array growth
        user.refreshTokens = [...user.refreshTokens.slice(-4), refreshToken];
        await user.save();
        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: business._id,
                },
                business: {
                    id: business._id,
                    name: business.name,
                    currency: business.currency,
                    lowStockAlertThreshold: business.lowStockAlertThreshold,
                },
                tokens: {
                    accessToken,
                    refreshToken,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/auth/refresh-token
router.post('/refresh-token', (0, validate_1.validateBody)(auth_validator_1.refreshTokenSchema), async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(refreshToken, env_1.config.jwt.refreshSecret);
        }
        catch (err) {
            throw new error_1.AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
        }
        const user = await User_1.User.findById(decoded.userId);
        if (!user || !user.refreshTokens.includes(refreshToken)) {
            throw new error_1.AppError('Refresh token revoked or invalid', 401, 'TOKEN_REVOKED');
        }
        // Rotate refresh token
        const tokens = generateTokens(user._id.toString(), user.businessId.toString(), user.role);
        user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
        user.refreshTokens.push(tokens.refreshToken);
        await user.save();
        res.json({
            success: true,
            data: {
                tokens,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/auth/logout
router.post('/logout', auth_1.authenticate, async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken && req.user) {
            await User_1.User.updateOne({ _id: req.user.id }, { $pull: { refreshTokens: refreshToken } });
        }
        res.json({
            success: true,
            data: {
                message: 'Logged out successfully',
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/auth/me
router.get('/me', auth_1.authenticate, async (req, res, next) => {
    try {
        const user = await User_1.User.findById(req.user.id);
        const business = await Business_1.Business.findById(req.user.businessId);
        if (!user || !business) {
            throw new error_1.AppError('User or Business not found', 404, 'NOT_FOUND');
        }
        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    businessId: business._id,
                },
                business: {
                    id: business._id,
                    name: business.name,
                    currency: business.currency,
                    lowStockAlertThreshold: business.lowStockAlertThreshold,
                    contactEmail: business.contactEmail,
                    contactPhone: business.contactPhone,
                    address: business.address,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
