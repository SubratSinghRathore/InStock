"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovement = void 0;
const mongoose_1 = require("mongoose");
const stockMovementSchema = new mongoose_1.Schema({
    businessId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true,
    },
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['IN', 'OUT', 'SALE', 'RETURN', 'ADJUSTMENT'],
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    previousQuantity: {
        type: Number,
        required: true,
    },
    newQuantity: {
        type: Number,
        required: true,
    },
    reason: {
        type: String,
        trim: true,
        default: '',
    },
    referenceId: {
        type: String,
        trim: true,
        default: '',
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
    },
}, {
    timestamps: true,
});
stockMovementSchema.index({ businessId: 1, productId: 1, timestamp: -1 });
exports.StockMovement = (0, mongoose_1.model)('StockMovement', stockMovementSchema);
