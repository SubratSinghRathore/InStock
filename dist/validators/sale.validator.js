"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesQuerySchema = exports.returnSaleSchema = exports.createSaleSchema = void 0;
const zod_1 = require("zod");
const saleItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
    quantity: zod_1.z.coerce.number().int().min(1, 'Quantity must be at least 1'),
    unitPrice: zod_1.z.coerce.number().min(0).optional(), // Can override default selling price if provided
});
exports.createSaleSchema = zod_1.z.object({
    items: zod_1.z.array(saleItemInputSchema).min(1, 'At least one sale item is required'),
    paymentMethod: zod_1.z.enum(['CASH', 'CARD', 'UPI', 'OTHER']).default('CASH'),
    notes: zod_1.z.string().max(500).optional().default(''),
    idempotencyKey: zod_1.z.string().max(100).optional(),
});
exports.returnSaleSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3, 'Return reason is required').max(255),
});
exports.salesQuerySchema = zod_1.z.object({
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    status: zod_1.z.enum(['COMPLETED', 'REFUNDED']).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
