import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Supplier } from '../models/Supplier';
import { Product } from '../models/Product';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createSupplierSchema, updateSupplierSchema } from '../validators/supplier.validator';
import { deleteCloudinaryImage } from '../services/cloudinary.service';
import { AppError } from '../middleware/error';

const router = Router();
router.use(authenticate);

// GET /api/v1/suppliers
router.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const suppliers = await Supplier.find({ businessId }).sort({ name: 1 });

    // Include product count for each supplier
    const supplierIds = suppliers.map((s) => s._id);
    const productCounts = await Product.aggregate([
      { $match: { businessId, supplierId: { $in: supplierIds }, isArchived: false } },
      { $group: { _id: '$supplierId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    productCounts.forEach((pc) => countMap.set(pc._id.toString(), pc.count));

    const enrichedSuppliers = suppliers.map((s) => ({
      ...s.toObject(),
      productCount: countMap.get(s._id.toString()) || 0,
    }));

    res.json({
      success: true,
      data: enrichedSuppliers,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/suppliers/:id
router.get('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const supplier = await Supplier.findOne({ _id: req.params.id, businessId });

    if (!supplier) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    const products = await Product.find({
      businessId,
      supplierId: supplier._id,
      isArchived: false,
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: {
        supplier,
        products,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/suppliers
router.post(
  '/',
  validateBody(createSupplierSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const data = req.body;

      const supplier = await Supplier.create({
        ...data,
        businessId,
      });

      res.status(201).json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/suppliers/:id
router.put(
  '/:id',
  validateBody(updateSupplierSchema),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const businessId = req.user!.businessId;
      const supplier = await Supplier.findOne({ _id: req.params.id, businessId });

      if (!supplier) {
        throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
      }

      if (
        req.body.imagePublicId &&
        supplier.imagePublicId &&
        req.body.imagePublicId !== supplier.imagePublicId
      ) {
        deleteCloudinaryImage(supplier.imagePublicId).catch(() => {});
      }

      Object.assign(supplier, req.body);
      const updated = await supplier.save();

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/suppliers/:id
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, businessId });

    if (!supplier) {
      throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    }

    // Unlink supplier from products
    await Product.updateMany(
      { businessId, supplierId: supplier._id },
      { $set: { supplierId: null } }
    );

    if (supplier.imagePublicId) {
      deleteCloudinaryImage(supplier.imagePublicId).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        message: 'Supplier deleted successfully',
        id: supplier._id,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
