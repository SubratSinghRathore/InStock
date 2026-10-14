import { z } from 'zod';

export const stockInSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().max(255).optional().default('Stock received'),
  referenceId: z.string().max(100).optional().default(''),
});

export const stockOutSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().max(255).optional().default('Stock issued / damaged'),
  referenceId: z.string().max(100).optional().default(''),
});

export const adjustStockSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  newQuantity: z.coerce.number().int().min(0, 'Quantity cannot be negative'),
  reason: z.string().min(3, 'Adjustment reason is required').max(255),
  referenceId: z.string().max(100).optional().default(''),
});

export const movementQuerySchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID').optional(),
  type: z.enum(['IN', 'OUT', 'SALE', 'RETURN', 'ADJUSTMENT']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
