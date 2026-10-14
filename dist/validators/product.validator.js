"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productQuerySchema = exports.updateProductSchema = exports.createProductSchema = void 0;
const zod_1 = require("zod");
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Product name is required').max(150),
    sku: zod_1.z.string().min(1, 'SKU is required').max(50).toUpperCase(),
    barcode: zod_1.z.string().max(50).optional().default(''),
    category: zod_1.z.string().min(1, 'Category is required').max(50).default('General'),
    description: zod_1.z.string().max(1000).optional().default(''),
    purchasePrice: zod_1.z.coerce.number().min(0, 'Purchase price cannot be negative'),
    sellingPrice: zod_1.z.coerce.number().min(0, 'Selling price cannot be negative'),
    quantity: zod_1.z.coerce.number().int().min(0, 'Quantity cannot be negative').default(0),
    lowStockThreshold: zod_1.z.coerce.number().int().min(0, 'Low stock threshold cannot be negative').default(5),
    supplierId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid supplier ID').optional().nullable(),
    imageUrl: zod_1.z.string().min(1, 'Product image is required'),
    imagePublicId: zod_1.z.string().optional().default(''),
});
exports.updateProductSchema = exports.createProductSchema.partial();
exports.productQuerySchema = zod_1.z.object({
    search: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    lowStock: zod_1.z.enum(['true', 'false']).optional(),
    isArchived: zod_1.z.enum(['true', 'false']).default('false').optional(),
    supplierId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid supplier ID').optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
