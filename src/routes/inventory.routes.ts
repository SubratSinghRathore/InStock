import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { StockMovement } from '../models/StockMovement';
import { InventoryService } from '../services/inventory.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  stockInSchema,
  stockOutSchema,
  adjustStockSchema,
  movementQuerySchema,
} from '../validators/inventory.validator';

const router = Router();
router.use(authenticate);

// POST /api/v1/inventory/stock-in
router.post(
  '/stock-in',
  validateBody(stockInSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { productId, quantity, reason, referenceId } = req.body;

      const result = await InventoryService.stockIn(
        businessId,
        userId,
        productId,
        quantity,
        reason,
        referenceId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/inventory/stock-out
router.post(
  '/stock-out',
  validateBody(stockOutSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { productId, quantity, reason, referenceId } = req.body;

      const result = await InventoryService.stockOut(
        businessId,
        userId,
        productId,
        quantity,
        reason,
        referenceId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/inventory/adjust
router.post(
  '/adjust',
  validateBody(adjustStockSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { productId, newQuantity, reason, referenceId } = req.body;

      const result = await InventoryService.adjustStock(
        businessId,
        userId,
        productId,
        newQuantity,
        reason,
        referenceId
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/inventory/movements
router.get(
  '/movements',
  validateQuery(movementQuerySchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const { productId, type, startDate, endDate, page = 1, limit = 20 } = req.query as any;

      const query: any = { businessId };

      if (productId) {
        query.productId = new Types.ObjectId(productId);
      }

      if (type) {
        query.type = type;
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
      const [movements, total] = await Promise.all([
        StockMovement.find(query)
          .populate('productId', 'name sku imageUrl')
          .populate('userId', 'name email')
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(Number(limit)),
        StockMovement.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: {
          movements,
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

export default router;
