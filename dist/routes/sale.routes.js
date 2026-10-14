"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Sale_1 = require("../models/Sale");
const inventory_service_1 = require("../services/inventory.service");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const sale_validator_1 = require("../validators/sale.validator");
const error_1 = require("../middleware/error");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// POST /api/v1/sales
router.post('/', (0, validate_1.validateBody)(sale_validator_1.createSaleSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const userId = req.user.id;
        const { items, paymentMethod, notes, idempotencyKey } = req.body;
        const sale = await inventory_service_1.InventoryService.recordSale(businessId, userId, items, paymentMethod, notes, idempotencyKey);
        res.status(201).json({
            success: true,
            data: sale,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/sales
router.get('/', (0, validate_1.validateQuery)(sale_validator_1.salesQuerySchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const { startDate, endDate, status, page = 1, limit = 20 } = req.query;
        const query = { businessId };
        if (status) {
            query.status = status;
        }
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                query.timestamp.$lte = new Date(endDate);
            }
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [sales, total] = await Promise.all([
            Sale_1.Sale.find(query)
                .populate('userId', 'name email')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Sale_1.Sale.countDocuments(query),
        ]);
        res.json({
            success: true,
            data: {
                sales,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    totalPages: Math.ceil(total / Number(limit)) || 1,
                },
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/sales/:id
router.get('/:id', async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const sale = await Sale_1.Sale.findOne({ _id: req.params.id, businessId }).populate('userId', 'name email');
        if (!sale) {
            throw new error_1.AppError('Sale not found', 404, 'SALE_NOT_FOUND');
        }
        res.json({
            success: true,
            data: sale,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/sales/:id/return
router.post('/:id/return', (0, validate_1.validateBody)(sale_validator_1.returnSaleSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const userId = req.user.id;
        const { reason } = req.body;
        const refundedSale = await inventory_service_1.InventoryService.returnSale(businessId, userId, req.params.id, reason);
        res.json({
            success: true,
            data: refundedSale,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
