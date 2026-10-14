import request from 'supertest';
import { createApp } from '../app';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { config } from '../config/env';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { Product } from '../models/Product';

jest.mock('../models/User');
jest.mock('../models/Business');
jest.mock('../models/Product');
jest.mock('../models/Supplier');
jest.mock('../models/StockMovement');
jest.mock('../models/Sale');

describe('InStock Backend API Endpoints', () => {
  const app = createApp();
  const testBusinessId = new Types.ObjectId();
  const testUserId = new Types.ObjectId();

  const validToken = jwt.sign(
    {
      userId: testUserId.toString(),
      businessId: testBusinessId.toString(),
      role: 'owner',
    },
    config.jwt.accessSecret,
    { expiresIn: '15m' }
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/health', () => {
    it('should return UP status and service info', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
    });
  });

  describe('Authentication and Protected Endpoints', () => {
    it('should reject protected endpoints without authorization header', async () => {
      const res = await request(app).get('/api/v1/products');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid or expired JWT token', async () => {
      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', 'Bearer invalid.token.string');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject registration if email is invalid or missing fields', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        businessName: 'My Store',
        name: 'John',
        email: 'invalid-email',
        password: '123', // Too short
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow access to protected endpoints with valid token', async () => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: testUserId,
        businessId: testBusinessId,
        role: 'owner',
        name: 'Store Owner',
        email: 'owner@test.com',
      });
      (Product.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });
      (Product.countDocuments as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toEqual([]);
    });
  });

  describe('Product Validation & Business Isolation', () => {
    beforeEach(() => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: testUserId,
        businessId: testBusinessId,
        role: 'owner',
        name: 'Store Owner',
        email: 'owner@test.com',
      });
    });

    it('should validate required product fields and disallow negative prices', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: '',
          sku: '',
          purchasePrice: -10,
          sellingPrice: -5,
          quantity: -2,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent cross-business data leakage by querying with businessId', async () => {
      (Product.find as jest.Mock).mockImplementation((query) => {
        expect(query.businessId.toString()).toBe(testBusinessId.toString());
        return {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([]),
        };
      });
      (Product.countDocuments as jest.Mock).mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(Product.find).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: testBusinessId })
      );
    });
  });

  describe('Stock Operations Validation', () => {
    beforeEach(() => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: testUserId,
        businessId: testBusinessId,
        role: 'owner',
        name: 'Store Owner',
        email: 'owner@test.com',
      });
    });

    it('should require a reason for manual stock adjustment', async () => {
      const validObjectId = new Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/inventory/adjust')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          productId: validObjectId,
          newQuantity: 10,
          reason: '', // Empty reason should fail
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject stock in with non-positive quantities', async () => {
      const validObjectId = new Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/inventory/stock-in')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          productId: validObjectId,
          quantity: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Upload Authorization', () => {
    it('should reject upload signature request without authentication', async () => {
      const res = await request(app).get('/api/v1/upload/signature');
      expect(res.status).toBe(401);
    });

    it('should return signature details for authenticated user', async () => {
      (User.findById as jest.Mock).mockResolvedValue({
        _id: testUserId,
        businessId: testBusinessId,
        role: 'owner',
      });

      const res = await request(app)
        .get('/api/v1/upload/signature?folder=instock/products')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.folder).toBe('instock/products');
      expect(res.body.data.signature).toBeDefined();
    });
  });
});
