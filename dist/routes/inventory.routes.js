"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const StockMovement_1 = require("../models/StockMovement");
const inventory_service_1 = require("../services/inventory.service");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const inventory_validator_1 = require("../validators/inventory.validator");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// POST /api/v1/inventory/stock-in
router.post('/stock-in', (0, validate_1.validateBody)(inventory_validator_1.stockInSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const userId = req.user.id;
        const { productId, quantity, reason, referenceId } = req.body;
        const result = await inventory_service_1.InventoryService.stockIn(businessId, userId, productId, quantity, reason, referenceId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/inventory/stock-out
router.post('/stock-out', (0, validate_1.validateBody)(inventory_validator_1.stockOutSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const userId = req.user.id;
        const { productId, quantity, reason, referenceId } = req.body;
        const result = await inventory_service_1.InventoryService.stockOut(businessId, userId, productId, quantity, reason, referenceId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/inventory/adjust
router.post('/adjust', (0, validate_1.validateBody)(inventory_validator_1.adjustStockSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const userId = req.user.id;
        const { productId, newQuantity, reason, referenceId } = req.body;
        const result = await inventory_service_1.InventoryService.adjustStock(businessId, userId, productId, newQuantity, reason, referenceId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/inventory/movements
router.get('/movements', (0, validate_1.validateQuery)(inventory_validator_1.movementQuerySchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const { productId, type, startDate, endDate, page = 1, limit = 20 } = req.query;
        const query = { businessId };
        if (productId) {
            query.productId = new mongoose_1.Types.ObjectId(productId);
        }
        if (type) {
            query.type = type;
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
        const [movements, total] = await Promise.all([
            StockMovement_1.StockMovement.find(query)
                .populate('productId', 'name sku imageUrl')
                .populate('userId', 'name email')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(Number(limit)),
            StockMovement_1.StockMovement.countDocuments(query),
        ]);
        res.json({
            success: true,
            data: {
                movements,
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
exports.default = router;
