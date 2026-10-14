import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import productRoutes from './routes/product.routes';
import inventoryRoutes from './routes/inventory.routes';
import supplierRoutes from './routes/supplier.routes';
import saleRoutes from './routes/sale.routes';
import reportRoutes from './routes/report.routes';
import businessRoutes from './routes/business.routes';
import uploadRoutes from './routes/upload.routes';
import { notFoundHandler, errorHandler } from './middleware/error';
import { config } from './config/env';

export const createApp = (): Express => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true,
    })
  );

  // Rate Limiting (100 req per minute)
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    },
  });

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging (skip during test runs)
  if (config.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  // Health check endpoint
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'in-stock-backend',
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
      },
    });
  });

  // Apply rate limiter to API routes
  app.use('/api/v1', limiter);

  // Mount API modules
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/suppliers', supplierRoutes);
  app.use('/api/v1/sales', saleRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/business', businessRoutes);
  app.use('/api/v1/upload', uploadRoutes);

  // 404 & Centralized Error Handler
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
