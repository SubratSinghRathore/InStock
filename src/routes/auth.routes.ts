import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { config } from '../config/env';
import { validateBody } from '../middleware/validate';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { registerSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';
import { AppError } from '../middleware/error';

const router = Router();

const generateTokens = (userId: string, businessId: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, businessId, role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiry as any }
  );

  const refreshToken = jwt.sign(
    { userId, businessId, role },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry as any }
  );

  return { accessToken, refreshToken };
};

// POST /api/v1/auth/register
router.post(
  '/register',
  validateBody(registerSchema),
  async (req, res: Response, next) => {
    try {
      const { businessName, name, email, password, currency } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
      }

      // 1. Create Business
      const business = await Business.create({
        name: businessName,
        currency: currency || 'USD',
        contactEmail: email,
      });

      // 2. Hash Password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Create User (Owner)
      const user = await User.create({
        businessId: business._id,
        name,
        email,
        password: hashedPassword,
        role: 'owner',
      });

      // 4. Generate Tokens
      const { accessToken, refreshToken } = generateTokens(
        user._id.toString(),
        business._id.toString(),
        user.role
      );

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
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  validateBody(loginSchema),
  async (req, res: Response, next) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const business = await Business.findById(user.businessId);
      if (!business) {
        throw new AppError('Associated business not found', 404, 'BUSINESS_NOT_FOUND');
      }

      const { accessToken, refreshToken } = generateTokens(
        user._id.toString(),
        business._id.toString(),
        user.role
      );

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
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/refresh-token
router.post(
  '/refresh-token',
  validateBody(refreshTokenSchema),
  async (req, res: Response, next) => {
    try {
      const { refreshToken } = req.body;

      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      } catch (err) {
        throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      const user = await User.findById(decoded.userId);
      if (!user || !user.refreshTokens.includes(refreshToken)) {
        throw new AppError('Refresh token revoked or invalid', 401, 'TOKEN_REVOKED');
      }

      // Rotate refresh token
      const tokens = generateTokens(
        user._id.toString(),
        user.businessId.toString(),
        user.role
      );

      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
      user.refreshTokens.push(tokens.refreshToken);
      await user.save();

      res.json({
        success: true,
        data: {
          tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/auth/logout
router.post(
  '/logout',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { refreshToken } = req.body;
      if (refreshToken && req.user) {
        await User.updateOne(
          { _id: req.user.id },
          { $pull: { refreshTokens: refreshToken } }
        );
      }
      res.json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/auth/me
router.get(
  '/me',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const user = await User.findById(req.user!.id);
      const business = await Business.findById(req.user!.businessId);

      if (!user || !business) {
        throw new AppError('User or Business not found', 404, 'NOT_FOUND');
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
    } catch (error) {
      next(error);
    }
  }
);

export default router;
