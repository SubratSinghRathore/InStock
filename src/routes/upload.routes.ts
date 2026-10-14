import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { generateUploadSignature, uploadBufferToCloudinary } from '../services/cloudinary.service';
import { AppError } from '../middleware/error';

const router = Router();
router.use(authenticate);

// Memory storage for multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new AppError('Only image files (JPEG, PNG, WEBP) are allowed', 400, 'INVALID_FILE_TYPE'));
    }
  },
});

// GET /api/v1/upload/signature
router.get('/signature', (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const folder = (req.query.folder as string) || 'instock/products';
    const signatureData = generateUploadSignature(folder);
    res.json({
      success: true,
      data: signatureData,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/upload
router.post(
  '/',
  upload.single('image'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (!req.file) {
        throw new AppError('No image file provided in request', 400, 'FILE_MISSING');
      }

      const folder = (req.body.folder as string) || 'instock/products';
      const result = await uploadBufferToCloudinary(req.file.buffer, folder);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
