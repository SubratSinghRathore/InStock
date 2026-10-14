"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sale = void 0;
const mongoose_1 = require("mongoose");
const saleItemSchema = new mongoose_1.Schema({
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    productName: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    purchaseCost: {
        type: Number,
        default: 0,
        min: 0,
    },
    total: {
        type: Number,
        required: true,
        min: 0,
    },
}, { _id: false });
const saleSchema = new mongoose_1.Schema({
    businessId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true,
    },
    invoiceNumber: {
        type: String,
        required: true,
        trim: true,
    },
    items: {
        type: [saleItemSchema],
        required: true,
        validate: [(val) => val.length > 0, 'Sale must have at least one item'],
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    paymentMethod: {
        type: String,
        enum: ['CASH', 'CARD', 'UPI', 'OTHER'],
        default: 'CASH',
    },
    status: {
        type: String,
        enum: ['COMPLETED', 'REFUNDED'],
        default: 'COMPLETED',
    },
    idempotencyKey: {
        type: String,
        sparse: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    notes: {
        type: String,
        trim: true,
        default: '',
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: true,
});
saleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
saleSchema.index({ businessId: 1, timestamp: -1 });
exports.Sale = (0, mongoose_1.model)('Sale', saleSchema);
