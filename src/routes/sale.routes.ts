import { Router, Response } from 'express';
import { Sale } from '../models/Sale';
import { InventoryService } from '../services/inventory.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createSaleSchema, returnSaleSchema, salesQuerySchema } from '../validators/sale.validator';
import { AppError } from '../middleware/error';

const router = Router();
router.use(authenticate);

// POST /api/v1/sales
router.post(
  '/',
  validateBody(createSaleSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { items, paymentMethod, notes, idempotencyKey } = req.body;

      const sale = await InventoryService.recordSale(
        businessId,
        userId,
        items,
        paymentMethod,
        notes,
        idempotencyKey
      );

      res.status(201).json({
        success: true,
        data: sale,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/sales
router.get(
  '/',
  validateQuery(salesQuerySchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const { startDate, endDate, status, page = 1, limit = 20 } = req.query as any;

      const query: any = { businessId };

      if (status) {
        query.status = status;
      }

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          query.timestamp.$gte = new Date(startDate);
        }
        if (endDate) {
          query.timestamp.$lte = new Date(endDate);
        }
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [sales, total] = await Promise.all([
        Sale.find(query)
          .populate('userId', 'name email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(Number(limit)),
        Sale.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: {
          sales,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)) || 1,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/sales/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const sale = await Sale.findOne({ _id: req.params.id, businessId }).populate(
      'userId',
      'name email'
    );

    if (!sale) {
      throw new AppError('Sale not found', 404, 'SALE_NOT_FOUND');
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sales/:id/return
router.post(
  '/:id/return',
  validateBody(returnSaleSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { reason } = req.body;

      const refundedSale = await InventoryService.returnSale(
        businessId,
        userId,
        req.params.id as string,
        reason
      );

      res.json({
        success: true,
        data: refundedSale,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
