import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(150),
  phone: z.string().max(50).optional().default(''),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().max(255).optional().default(''),
  imageUrl: z.string().optional().default(''),
  imagePublicId: z.string().optional().default(''),
});

export const updateSupplierSchema = createSupplierSchema.partial();
