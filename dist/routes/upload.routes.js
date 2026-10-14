"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const cloudinary_service_1 = require("../services/cloudinary.service");
const error_1 = require("../middleware/error");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Memory storage for multer
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new error_1.AppError('Only image files (JPEG, PNG, WEBP) are allowed', 400, 'INVALID_FILE_TYPE'));
        }
    },
});
// GET /api/v1/upload/signature
router.get('/signature', (req, res, next) => {
    try {
        const folder = req.query.folder || 'instock/products';
        const signatureData = (0, cloudinary_service_1.generateUploadSignature)(folder);
        res.json({
            success: true,
            data: signatureData,
        });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/upload
router.post('/', upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            throw new error_1.AppError('No image file provided in request', 400, 'FILE_MISSING');
        }
        const folder = req.body.folder || 'instock/products';
        const result = await (0, cloudinary_service_1.uploadBufferToCloudinary)(req.file.buffer, folder);
        res.status(201).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
