import { z } from 'zod';

const saleItemInputSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0).optional(), // Can override default selling price if provided
});

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'At least one sale item is required'),
  paymentMethod: z.enum(['CASH', 'CARD', 'UPI', 'OTHER']).default('CASH'),
  notes: z.string().max(500).optional().default(''),
  idempotencyKey: z.string().max(100).optional(),
});

export const returnSaleSchema = z.object({
  reason: z.string().min(3, 'Return reason is required').max(255),
});

export const salesQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['COMPLETED', 'REFUNDED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
