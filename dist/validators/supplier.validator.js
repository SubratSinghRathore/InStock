"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupplierSchema = exports.createSupplierSchema = void 0;
const zod_1 = require("zod");
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Supplier name is required').max(150),
    phone: zod_1.z.string().max(50).optional().default(''),
    email: zod_1.z.string().email('Invalid email address').optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().max(255).optional().default(''),
    imageUrl: zod_1.z.string().optional().default(''),
    imagePublicId: zod_1.z.string().optional().default(''),
});
exports.updateSupplierSchema = exports.createSupplierSchema.partial();
