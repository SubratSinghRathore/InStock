"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Supplier_1 = require("../models/Supplier");
const Product_1 = require("../models/Product");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const supplier_validator_1 = require("../validators/supplier.validator");
const cloudinary_service_1 = require("../services/cloudinary.service");
const error_1 = require("../middleware/error");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// GET /api/v1/suppliers
router.get('/', async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const suppliers = await Supplier_1.Supplier.find({ businessId }).sort({ name: 1 });
        // Include product count for each supplier
        const supplierIds = suppliers.map((s) => s._id);
        const productCounts = await Product_1.Product.aggregate([
            { $match: { businessId, supplierId: { $in: supplierIds }, isArchived: false } },
            { $group: { _id: '$supplierId', count: { $sum: 1 } } },
        ]);
        const countMap = new Map();
        productCounts.forEach((pc) => countMap.set(pc._id.toString(), pc.count));
        const enrichedSuppliers = suppliers.map((s) => ({
            ...s.toObject(),
            productCount: countMap.get(s._id.toString()) || 0,
        }));
        res.json({
            success: true,
            data: enrichedSuppliers,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/suppliers/:id
router.get('/:id', async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const supplier = await Supplier_1.Supplier.findOne({ _id: req.params.id, businessId });
        if (!supplier) {
            throw new error_1.AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
        }
        const products = await Product_1.Product.find({
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
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/suppliers
router.post('/', (0, validate_1.validateBody)(supplier_validator_1.createSupplierSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const data = req.body;
        const supplier = await Supplier_1.Supplier.create({
            ...data,
            businessId,
        });
        res.status(201).json({
            success: true,
            data: supplier,
        });
    }
    catch (error) {
        next(error);
    }
});
// PUT /api/v1/suppliers/:id
router.put('/:id', (0, validate_1.validateBody)(supplier_validator_1.updateSupplierSchema), async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const supplier = await Supplier_1.Supplier.findOne({ _id: req.params.id, businessId });
        if (!supplier) {
            throw new error_1.AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
        }
        if (req.body.imagePublicId &&
            supplier.imagePublicId &&
            req.body.imagePublicId !== supplier.imagePublicId) {
            (0, cloudinary_service_1.deleteCloudinaryImage)(supplier.imagePublicId).catch(() => { });
        }
        Object.assign(supplier, req.body);
        const updated = await supplier.save();
        res.json({
            success: true,
            data: updated,
        });
    }
    catch (error) {
        next(error);
    }
});
// DELETE /api/v1/suppliers/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const businessId = req.user.businessId;
        const supplier = await Supplier_1.Supplier.findOneAndDelete({ _id: req.params.id, businessId });
        if (!supplier) {
            throw new error_1.AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
        }
        // Unlink supplier from products
        await Product_1.Product.updateMany({ businessId, supplierId: supplier._id }, { $set: { supplierId: null } });
        if (supplier.imagePublicId) {
            (0, cloudinary_service_1.deleteCloudinaryImage)(supplier.imagePublicId).catch(() => { });
        }
        res.json({
            success: true,
            data: {
                message: 'Supplier deleted successfully',
                id: supplier._id,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
