import { Types } from 'mongoose';
import { Product, IProduct } from '../models/Product';
import { StockMovement, MovementType, IStockMovement } from '../models/StockMovement';
import { Sale, ISale, ISaleItem, PaymentMethod } from '../models/Sale';
import { AppError } from '../middleware/error';

export interface StockOperationResult {
  product: IProduct;
  movement: IStockMovement;
}

export class InventoryService {
  /**
   * Performs an atomic Stock In operation
   */
  static async stockIn(
    businessId: Types.ObjectId,
    userId: Types.ObjectId,
    productId: string,
    quantity: number,
    reason = 'Stock received',
    referenceId = ''
  ): Promise<StockOperationResult> {
    if (quantity <= 0) {
      throw new AppError('Quantity must be greater than zero', 400, 'INVALID_QUANTITY');
    }

    const product = await Product.findOne({
      _id: productId,
      businessId,
      isArchived: false,
    });

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const previousQuantity = product.quantity;
    const newQuantity = previousQuantity + quantity;

    // Atomic update
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, businessId },
      { $inc: { quantity } },
      { new: true }
    );

    if (!updatedProduct) {
      throw new AppError('Failed to update product stock', 500, 'UPDATE_FAILED');
    }

    // Record stock movement
    const movement = await StockMovement.create({
      businessId,
      productId: product._id,
      type: 'IN',
      quantity,
      previousQuantity,
      newQuantity,
      reason,
      referenceId,
      userId,
      timestamp: new Date(),
    });

    return { product: updatedProduct, movement };
  }

  /**
   * Performs an atomic Stock Out operation with negative stock prevention
   */
  static async stockOut(
    businessId: Types.ObjectId,
    userId: Types.ObjectId,
    productId: string,
    quantity: number,
    reason = 'Stock issued / damaged',
    referenceId = ''
  ): Promise<StockOperationResult> {
    if (quantity <= 0) {
      throw new AppError('Quantity must be greater than zero', 400, 'INVALID_QUANTITY');
    }

    const currentProduct = await Product.findOne({
      _id: productId,
      businessId,
      isArchived: false,
    });

    if (!currentProduct) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    if (currentProduct.quantity < quantity) {
      throw new AppError(
        `Insufficient stock. Available: ${currentProduct.quantity}, Requested: ${quantity}`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }

    const previousQuantity = currentProduct.quantity;

    // Conditional atomic decrement prevents negative inventory even in race conditions
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, businessId, quantity: { $gte: quantity } },
      { $inc: { quantity: -quantity } },
      { new: true }
    );

    if (!updatedProduct) {
      throw new AppError(
        'Concurrent modification prevented stock out: Insufficient stock',
        409,
        'CONCURRENT_MODIFICATION'
      );
    }

    const movement = await StockMovement.create({
      businessId,
      productId: currentProduct._id,
      type: 'OUT',
      quantity: -quantity,
      previousQuantity,
      newQuantity: updatedProduct.quantity,
      reason,
      referenceId,
      userId,
      timestamp: new Date(),
    });

    return { product: updatedProduct, movement };
  }

  /**
   * Performs a manual stock adjustment with required reason
   */
  static async adjustStock(
    businessId: Types.ObjectId,
    userId: Types.ObjectId,
    productId: string,
    newQuantity: number,
    reason: string,
    referenceId = ''
  ): Promise<StockOperationResult> {
    if (newQuantity < 0) {
      throw new AppError('New quantity cannot be negative', 400, 'INVALID_QUANTITY');
    }

    if (!reason || reason.trim().length === 0) {
      throw new AppError('Adjustment reason is required', 400, 'REASON_REQUIRED');
    }

    const product = await Product.findOne({
      _id: productId,
      businessId,
      isArchived: false,
    });

    if (!product) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }

    const previousQuantity = product.quantity;
    const delta = newQuantity - previousQuantity;

    product.quantity = newQuantity;
    await product.save();

    const movement = await StockMovement.create({
      businessId,
      productId: product._id,
      type: 'ADJUSTMENT',
      quantity: delta,
      previousQuantity,
      newQuantity,
      reason,
      referenceId,
      userId,
      timestamp: new Date(),
    });

    return { product, movement };
  }

  /**
   * Records a sale atomically with stock deduction and idempotency support
   */
  static async recordSale(
    businessId: Types.ObjectId,
    userId: Types.ObjectId,
    itemsInput: Array<{ productId: string; quantity: number; unitPrice?: number }>,
    paymentMethod: PaymentMethod = 'CASH',
    notes = '',
    idempotencyKey?: string
  ): Promise<ISale> {
    // 1. Idempotency check
    if (idempotencyKey) {
      const existingSale = await Sale.findOne({ businessId, idempotencyKey });
      if (existingSale) {
        return existingSale;
      }
    }

    // 2. Fetch all products and validate availability
    const productIds = itemsInput.map((item) => item.productId);
    const products = await Product.find({
      _id: { $in: productIds },
      businessId,
      isArchived: false,
    });

    const productMap = new Map<string, IProduct>();
    products.forEach((p) => productMap.set(p._id.toString(), p));

    // Validate existence & stock
    for (const item of itemsInput) {
      const p = productMap.get(item.productId);
      if (!p) {
        throw new AppError(`Product ID ${item.productId} not found`, 404, 'PRODUCT_NOT_FOUND');
      }
      if (p.quantity < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${p.name}". Available: ${p.quantity}, requested: ${item.quantity}`,
          400,
          'INSUFFICIENT_STOCK'
        );
      }
    }

    // 3. Atomically decrement stock for each item
    const decrementedList: Array<{ productId: string; quantity: number }> = [];
    const saleItems: ISaleItem[] = [];
    let totalAmount = 0;

    try {
      for (const item of itemsInput) {
        const p = productMap.get(item.productId)!;
        const previousQuantity = p.quantity;

        const updated = await Product.findOneAndUpdate(
          { _id: p._id, businessId, quantity: { $gte: item.quantity } },
          { $inc: { quantity: -item.quantity } },
          { new: true }
        );

        if (!updated) {
          throw new AppError(
            `Concurrent stock deduction failed for "${p.name}". Please retry.`,
            409,
            'STOCK_CONFLICT'
          );
        }

        decrementedList.push({ productId: item.productId, quantity: item.quantity });

        const unitPrice = item.unitPrice !== undefined ? item.unitPrice : p.sellingPrice;
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
        totalAmount += lineTotal;

        saleItems.push({
          productId: p._id,
          productName: p.name,
          quantity: item.quantity,
          unitPrice,
          purchaseCost: p.purchasePrice,
          total: lineTotal,
        });

        // Record stock movement for this sale line
        await StockMovement.create({
          businessId,
          productId: p._id,
          type: 'SALE',
          quantity: -item.quantity,
          previousQuantity,
          newQuantity: updated.quantity,
          reason: `Sale ${p.name} x ${item.quantity}`,
          referenceId: '', // Will update with invoiceNumber
          userId,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      // Rollback any successfully decremented items if an error occurs mid-process
      for (const dec of decrementedList) {
        await Product.updateOne(
          { _id: dec.productId, businessId },
          { $inc: { quantity: dec.quantity } }
        );
      }
      throw err;
    }

    // 4. Generate clean invoice number
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 5. Create sale record
    const sale = await Sale.create({
      businessId,
      invoiceNumber,
      items: saleItems,
      totalAmount: Math.round(totalAmount * 100) / 100,
      paymentMethod,
      status: 'COMPLETED',
      idempotencyKey,
      userId,
      notes,
      timestamp: new Date(),
    });

    // Update referenceId on movements
    await StockMovement.updateMany(
      { businessId, userId, type: 'SALE', referenceId: '', timestamp: { $gte: new Date(Date.now() - 5000) } },
      { $set: { referenceId: invoiceNumber } }
    );

    return sale;
  }

  /**
   * Refunds / Returns a sale and atomically restores product inventory
   */
  static async returnSale(
    businessId: Types.ObjectId,
    userId: Types.ObjectId,
    saleId: string,
    reason: string
  ): Promise<ISale> {
    const sale = await Sale.findOne({ _id: saleId, businessId });
    if (!sale) {
      throw new AppError('Sale record not found', 404, 'SALE_NOT_FOUND');
    }

    if (sale.status === 'REFUNDED') {
      throw new AppError('Sale has already been refunded', 400, 'ALREADY_REFUNDED');
    }

    // Atomically restore product stock
    for (const item of sale.items) {
      const product = await Product.findOne({ _id: item.productId, businessId });
      const previousQuantity = product ? product.quantity : 0;
      const newQuantity = previousQuantity + item.quantity;

      await Product.updateOne(
        { _id: item.productId, businessId },
        { $inc: { quantity: item.quantity } }
      );

      await StockMovement.create({
        businessId,
        productId: item.productId,
        type: 'RETURN',
        quantity: item.quantity,
        previousQuantity,
        newQuantity,
        reason: `Return invoice ${sale.invoiceNumber}: ${reason}`,
        referenceId: sale.invoiceNumber,
        userId,
        timestamp: new Date(),
      });
    }

    sale.status = 'REFUNDED';
    await sale.save();

    return sale;
  }
}
