import { Router, Response } from 'express';
import { z } from 'zod';
import { Business } from '../models/Business';
import { authenticate, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { AppError } from '../middleware/error';

const router = Router();
router.use(authenticate);

const updateBusinessSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  currency: z.string().min(1).max(5).optional(),
  lowStockAlertThreshold: z.coerce.number().min(0).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
});

// GET /api/v1/business
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const business = await Business.findById(req.user!.businessId);
    if (!business) {
      throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
    }
    res.json({
      success: true,
      data: business,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/business
router.put(
  '/',
  requireRole('owner'),
  validateBody(updateBusinessSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const business = await Business.findById(req.user!.businessId);
      if (!business) {
        throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
      }

      Object.assign(business, req.body);
      const updated = await business.save();

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
