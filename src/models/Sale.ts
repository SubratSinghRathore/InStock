import { Schema, model, Document, Types } from 'mongoose';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'OTHER';
export type SaleStatus = 'COMPLETED' | 'REFUNDED';

export interface ISaleItem {
  productId: Types.ObjectId;
  productName: string;
  quantity: number;
  unitPrice: number;
  purchaseCost: number;
  total: number;
}

export interface ISale extends Document {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  invoiceNumber: string;
  items: ISaleItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  idempotencyKey?: string;
  userId: Types.ObjectId;
  notes?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const saleItemSchema = new Schema<ISaleItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
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
  },
  { _id: false }
);

const saleSchema = new Schema<ISale>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
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
      validate: [(val: ISaleItem[]) => val.length > 0, 'Sale must have at least one item'],
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
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
saleSchema.index({ businessId: 1, timestamp: -1 });

export const Sale = model<ISale>('Sale', saleSchema);
