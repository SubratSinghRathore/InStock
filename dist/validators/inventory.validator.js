"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.movementQuerySchema = exports.adjustStockSchema = exports.stockOutSchema = exports.stockInSchema = void 0;
const zod_1 = require("zod");
exports.stockInSchema = zod_1.z.object({
    productId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    reason: zod_1.z.string().max(255).optional().default('Stock received'),
    referenceId: zod_1.z.string().max(100).optional().default(''),
});
exports.stockOutSchema = zod_1.z.object({
    productId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    reason: zod_1.z.string().max(255).optional().default('Stock issued / damaged'),
    referenceId: zod_1.z.string().max(100).optional().default(''),
});
exports.adjustStockSchema = zod_1.z.object({
    productId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    newQuantity: zod_1.z.coerce.number().int().min(0, 'Quantity cannot be negative'),
    reason: zod_1.z.string().min(3, 'Adjustment reason is required').max(255),
    referenceId: zod_1.z.string().max(100).optional().default(''),
});
exports.movementQuerySchema = zod_1.z.object({
    productId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID').optional(),
    type: zod_1.z.enum(['IN', 'OUT', 'SALE', 'RETURN', 'ADJUSTMENT']).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
