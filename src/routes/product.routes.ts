import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { createProductSchema, updateProductSchema, productQuerySchema } from '../validators/product.validator';
import { deleteCloudinaryImage } from '../services/cloudinary.service';
import { AppError } from '../middleware/error';

const router = Router();
router.use(authenticate);

// GET /api/v1/products/categories/list
router.get('/categories/list', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const categories = await Product.distinct('category', { businessId, isArchived: false });
    res.json({
      success: true,
      data: categories.filter(Boolean).sort(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/products
router.get(
  '/',
  validateQuery(productQuerySchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const { search, category, lowStock, isArchived, supplierId, page = 1, limit = 20 } = req.query as any;

      const query: any = {
        businessId,
        isArchived: isArchived === 'true',
      };

      if (category) {
        query.category = category;
      }

      if (supplierId) {
        query.supplierId = new Types.ObjectId(supplierId);
      }

      if (search) {
        const regex = new RegExp(search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
        query.$or = [{ name: regex }, { sku: regex }, { barcode: regex }];
      }

      if (lowStock === 'true') {
        query.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('supplierId', 'name phone email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit)),
        Product.countDocuments(query),
      ]);

      res.json({
        success: true,
        data: {
          products,
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

// GET /api/v1/products/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const product = await Product.findOne({ _id: req.params.id, businessId }).populate(
      'supplierId',
      'name phone email'
    );

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    // Get latest stock movements for this product
    const recentMovements = await StockMovement.find({
      businessId,
      productId: product._id,
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'name');

    res.json({
      success: true,
      data: {
        product,
        recentMovements,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/products
router.post(
  '/',
  validateBody(createProductSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const data = req.body;

      // Check unique SKU in this business
      const existingSku = await Product.findOne({ businessId, sku: data.sku.toUpperCase() });
      if (existingSku) {
        throw new AppError(`A product with SKU "${data.sku}" already exists.`, 409, 'DUPLICATE_SKU');
      }

      const product = await Product.create({
        ...data,
        businessId,
        sku: data.sku.toUpperCase(),
      });

      // Record initial stock movement if initial quantity > 0
      if (product.quantity > 0) {
        await StockMovement.create({
          businessId,
          productId: product._id,
          type: 'IN',
          quantity: product.quantity,
          previousQuantity: 0,
          newQuantity: product.quantity,
          reason: 'Initial stock on product creation',
          userId: req.user!.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/products/:id
router.put(
  '/:id',
  validateBody(updateProductSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const data = req.body;

      const existingProduct = await Product.findOne({ _id: req.params.id, businessId });
      if (!existingProduct) {
        throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
      }

      if (data.sku && data.sku.toUpperCase() !== existingProduct.sku) {
        const skuExists = await Product.findOne({
          businessId,
          sku: data.sku.toUpperCase(),
          _id: { $ne: existingProduct._id },
        });
        if (skuExists) {
          throw new AppError(`A product with SKU "${data.sku}" already exists.`, 409, 'DUPLICATE_SKU');
        }
      }

      // If replacing image, clean up old Cloudinary asset
      if (
        data.imagePublicId &&
        existingProduct.imagePublicId &&
        data.imagePublicId !== existingProduct.imagePublicId
      ) {
        deleteCloudinaryImage(existingProduct.imagePublicId).catch(() => {});
      }

      // Quantity should be modified via inventory operations, but if explicitly changed here, record adjustment
      if (data.quantity !== undefined && data.quantity !== existingProduct.quantity) {
        const previousQuantity = existingProduct.quantity;
        const newQuantity = data.quantity;
        await StockMovement.create({
          businessId,
          productId: existingProduct._id,
          type: 'ADJUSTMENT',
          quantity: newQuantity - previousQuantity,
          previousQuantity,
          newQuantity,
          reason: 'Updated via product edit',
          userId: req.user!.id,
          timestamp: new Date(),
        });
      }

      Object.assign(existingProduct, data);
      if (data.sku) {
        existingProduct.sku = data.sku.toUpperCase();
      }

      const updated = await existingProduct.save();

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/products/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const product = await Product.findOne({ _id: req.params.id, businessId });

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    // Toggle archived status or remove
    product.isArchived = true;
    await product.save();

    res.json({
      success: true,
      data: {
        message: 'Product archived successfully',
        id: product._id,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
