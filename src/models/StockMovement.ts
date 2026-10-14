import { Schema, model, Document, Types } from 'mongoose';

export type MovementType = 'IN' | 'OUT' | 'SALE' | 'RETURN' | 'ADJUSTMENT';

export interface IStockMovement extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  productId: Types.ObjectId;
  type: MovementType;
  quantity: number; // positive delta or adjusted difference
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  referenceId?: string;
  userId: Types.ObjectId;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

stockMovementSchema.index({ businessId: 1, productId: 1, timestamp: -1 });

export const StockMovement = model<IStockMovement>('StockMovement', stockMovementSchema);
