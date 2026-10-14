import { Types } from 'mongoose';
import { InventoryService } from '../services/inventory.service';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { Sale } from '../models/Sale';
import { AppError } from '../middleware/error';

jest.mock('../models/Product');
jest.mock('../models/StockMovement');
jest.mock('../models/Sale');

describe('InventoryService', () => {
  const businessId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const productId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('stockIn', () => {
    it('should reject non-positive quantities', async () => {
      await expect(
        InventoryService.stockIn(businessId, userId, productId, 0)
      ).rejects.toThrow(AppError);

      await expect(
        InventoryService.stockIn(businessId, userId, productId, -5)
      ).rejects.toThrow('Quantity must be greater than zero');
    });

    it('should atomically increment stock and record movement', async () => {
      const mockProduct = {
        _id: new Types.ObjectId(productId),
        name: 'Hammer',
        quantity: 10,
      };

      (Product.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (Product.findOneAndUpdate as jest.Mock).mockResolvedValue({
        ...mockProduct,
        quantity: 15,
      });
      (StockMovement.create as jest.Mock).mockResolvedValue({
        _id: new Types.ObjectId(),
        type: 'IN',
        quantity: 5,
        newQuantity: 15,
      });

      const result = await InventoryService.stockIn(
        businessId,
        userId,
        productId,
        5,
        'Shipment received'
      );

      expect(result.product.quantity).toBe(15);
      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: productId, businessId },
        { $inc: { quantity: 5 } },
        { new: true }
      );
      expect(StockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'IN',
          quantity: 5,
          previousQuantity: 10,
          newQuantity: 15,
          reason: 'Shipment received',
        })
      );
    });
  });

  describe('stockOut', () => {
    it('should prevent stock out when requested quantity exceeds available quantity', async () => {
      const mockProduct = {
        _id: new Types.ObjectId(productId),
        name: 'Screwdriver',
        quantity: 3,
      };

      (Product.findOne as jest.Mock).mockResolvedValue(mockProduct);

      await expect(
        InventoryService.stockOut(businessId, userId, productId, 5)
      ).rejects.toThrow('Insufficient stock. Available: 3, Requested: 5');

      expect(Product.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should atomically decrement stock when sufficient inventory exists', async () => {
      const mockProduct = {
        _id: new Types.ObjectId(productId),
        name: 'Screwdriver',
        quantity: 10,
      };

      (Product.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (Product.findOneAndUpdate as jest.Mock).mockResolvedValue({
        ...mockProduct,
        quantity: 6,
      });
      (StockMovement.create as jest.Mock).mockResolvedValue({});

      const result = await InventoryService.stockOut(
        businessId,
        userId,
        productId,
        4,
        'Damaged goods'
      );

      expect(result.product.quantity).toBe(6);
      expect(Product.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: productId, businessId, quantity: { $gte: 4 } },
        { $inc: { quantity: -4 } },
        { new: true }
      );
      expect(StockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'OUT',
          quantity: -4,
          newQuantity: 6,
          reason: 'Damaged goods',
        })
      );
    });
  });

  describe('adjustStock', () => {
    it('should require a reason for manual adjustment', async () => {
      await expect(
        InventoryService.adjustStock(businessId, userId, productId, 10, '')
      ).rejects.toThrow('Adjustment reason is required');
    });

    it('should reject negative target quantities', async () => {
      await expect(
        InventoryService.adjustStock(businessId, userId, productId, -2, 'Inventory audit')
      ).rejects.toThrow('New quantity cannot be negative');
    });

    it('should successfully update stock and record adjustment movement', async () => {
      const mockProduct = {
        _id: new Types.ObjectId(productId),
        quantity: 12,
        save: jest.fn().mockResolvedValue(true),
      };

      (Product.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (StockMovement.create as jest.Mock).mockResolvedValue({});

      const result = await InventoryService.adjustStock(
        businessId,
        userId,
        productId,
        15,
        'Stock count correction'
      );

      expect(result.product.quantity).toBe(15);
      expect(mockProduct.save).toHaveBeenCalled();
      expect(StockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADJUSTMENT',
          quantity: 3,
          previousQuantity: 12,
          newQuantity: 15,
          reason: 'Stock count correction',
        })
      );
    });
  });

  describe('recordSale', () => {
    it('should return existing sale if idempotencyKey matches', async () => {
      const existingSale = {
        _id: new Types.ObjectId(),
        invoiceNumber: 'INV-123456-789',
        idempotencyKey: 'idem-key-1',
      };

      (Sale.findOne as jest.Mock).mockResolvedValue(existingSale);

      const result = await InventoryService.recordSale(
        businessId,
        userId,
        [{ productId, quantity: 2 }],
        'CASH',
        '',
        'idem-key-1'
      );

      expect(result).toBe(existingSale);
      expect(Product.find).not.toHaveBeenCalled();
    });

    it('should prevent sale if stock is insufficient', async () => {
      (Sale.findOne as jest.Mock).mockResolvedValue(null);
      (Product.find as jest.Mock).mockResolvedValue([
        {
          _id: new Types.ObjectId(productId),
          name: 'Nails (Pack)',
          quantity: 2,
          sellingPrice: 5.99,
          purchasePrice: 2.5,
        },
      ]);

      await expect(
        InventoryService.recordSale(businessId, userId, [{ productId, quantity: 5 }])
      ).rejects.toThrow('Insufficient stock for "Nails (Pack)"');
    });
  });

  describe('returnSale', () => {
    it('should reject refund if sale has already been refunded', async () => {
      const mockSale = {
        _id: new Types.ObjectId(),
        status: 'REFUNDED',
      };

      (Sale.findOne as jest.Mock).mockResolvedValue(mockSale);

      await expect(
        InventoryService.returnSale(businessId, userId, mockSale._id.toString(), 'Customer returned')
      ).rejects.toThrow('Sale has already been refunded');
    });
  });
});
