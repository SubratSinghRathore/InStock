"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = require("mongoose");
const productSchema = new mongoose_1.Schema({
    businessId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    sku: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
    },
    barcode: {
        type: String,
        trim: true,
        default: '',
    },
    category: {
        type: String,
        required: true,
        trim: true,
        default: 'General',
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    purchasePrice: {
        type: Number,
        required: true,
        min: 0,
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0,
    },
    lowStockThreshold: {
        type: Number,
        required: true,
        min: 0,
        default: 5,
    },
    supplierId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Supplier',
        default: null,
    },
    imageUrl: {
        type: String,
        required: true,
        trim: true,
    },
    imagePublicId: {
        type: String,
        trim: true,
        default: '',
    },
    isArchived: {
        type: Boolean,
        default: false,
        index: true,
    },
}, {
    timestamps: true,
});
// SKU must be unique within a business
productSchema.index({ businessId: 1, sku: 1 }, { unique: true });
productSchema.index({ businessId: 1, category: 1 });
productSchema.index({ businessId: 1, isArchived: 1, quantity: 1 });
exports.Product = (0, mongoose_1.model)('Product', productSchema);
