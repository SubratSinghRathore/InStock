"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const Business_1 = require("../models/Business");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const error_1 = require("../middleware/error");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
const updateBusinessSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100).optional(),
    currency: zod_1.z.string().min(1).max(5).optional(),
    lowStockAlertThreshold: zod_1.z.coerce.number().min(0).optional(),
    contactEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    contactPhone: zod_1.z.string().max(50).optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().max(255).optional().or(zod_1.z.literal('')),
});
// GET /api/v1/business
router.get('/', async (req, res, next) => {
    try {
        const business = await Business_1.Business.findById(req.user.businessId);
        if (!business) {
            throw new error_1.AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
        }
        res.json({
            success: true,
            data: business,
        });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/v1/business
router.put('/', (0, auth_1.requireRole)('owner'), (0, validate_1.validateBody)(updateBusinessSchema), async (req, res, next) => {
    try {
        const business = await Business_1.Business.findById(req.user.businessId);
        if (!business) {
            throw new error_1.AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
        }
        Object.assign(business, req.body);
        const updated = await business.save();
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
