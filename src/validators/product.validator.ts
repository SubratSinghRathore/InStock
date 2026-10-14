import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(150),
  sku: z.string().min(1, 'SKU is required').max(50).toUpperCase(),
  barcode: z.string().max(50).optional().default(''),
  category: z.string().min(1, 'Category is required').max(50).default('General'),
  description: z.string().max(1000).optional().default(''),
  purchasePrice: z.coerce.number().min(0, 'Purchase price cannot be negative'),
  sellingPrice: z.coerce.number().min(0, 'Selling price cannot be negative'),
  quantity: z.coerce.number().int().min(0, 'Quantity cannot be negative').default(0),
  lowStockThreshold: z.coerce.number().int().min(0, 'Low stock threshold cannot be negative').default(5),
  supplierId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid supplier ID').optional().nullable(),
  imageUrl: z.string().min(1, 'Product image is required'),
  imagePublicId: z.string().optional().default(''),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  isArchived: z.enum(['true', 'false']).default('false').optional(),
  supplierId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid supplier ID').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
