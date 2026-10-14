import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { Sale } from '../models/Sale';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/v1/reports/dashboard
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;

    // 1. Products and inventory value calculation
    const products = await Product.find({ businessId, isArchived: false });
    const totalProducts = products.length;
    let totalStockQuantity = 0;
    let lowStockCount = 0;
    let totalInventoryValue = 0;

    for (const p of products) {
      totalStockQuantity += p.quantity;
      totalInventoryValue += p.quantity * p.purchasePrice;
      if (p.quantity <= p.lowStockThreshold) {
        lowStockCount++;
      }
    }

    // 2. Recent stock movements
    const recentMovements = await StockMovement.find({ businessId })
      .populate('productId', 'name sku imageUrl')
      .populate('userId', 'name')
      .sort({ timestamp: -1 })
      .limit(6);

    // 3. Last 7 days sales chart data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const salesLast7Days = await Sale.aggregate([
      {
        $match: {
          businessId,
          status: 'COMPLETED',
          timestamp: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Build complete 7-day array even for days with zero sales
    const chartData: Array<{ date: string; label: string; amount: number; count: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });

      const found = salesLast7Days.find((item) => item._id === dateStr);
      chartData.push({
        date: dateStr,
        label: dayLabel,
        amount: found ? Math.round(found.totalSales * 100) / 100 : 0,
        count: found ? found.orderCount : 0,
      });
    }

    res.json({
      success: true,
      data: {
        summary: {
          totalProducts,
          totalStockQuantity,
          lowStockCount,
          totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        },
        recentMovements,
        chartData,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports/sales-summary
router.get('/sales-summary', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const matchQuery: any = {
      businessId,
      status: 'COMPLETED',
    };

    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    }

    const sales = await Sale.find(matchQuery);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalItemsSold = 0;
    const orderCount = sales.length;

    for (const sale of sales) {
      totalRevenue += sale.totalAmount;
      for (const item of sale.items) {
        totalItemsSold += item.quantity;
        totalCost += (item.purchaseCost || 0) * item.quantity;
      }
    }

    const grossProfit = totalRevenue - totalCost;

    res.json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        totalItemsSold,
        orderCount,
        averageOrderValue: orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports/top-products
router.get('/top-products', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;

    const topSelling = await Sale.aggregate([
      { $match: { businessId, status: 'COMPLETED' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.productName' },
          unitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
        },
      },
      { $sort: { unitsSold: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: topSelling,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports/restock-suggestions
router.get('/restock-suggestions', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const safetyBuffer = Number(req.query.safetyBuffer) || 5;
    const leadTimeDays = Number(req.query.leadTimeDays) || 7;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get units sold per product over the last 30 days
    const recentSales = await Sale.aggregate([
      {
        $match: {
          businessId,
          status: 'COMPLETED',
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          unitsSold: { $sum: '$items.quantity' },
        },
      },
    ]);

    const salesVelocityMap = new Map<string, number>();
    recentSales.forEach((s) => {
      // Average daily sales over 30 days
      salesVelocityMap.set(s._id.toString(), s.unitsSold / 30);
    });

    const products = await Product.find({ businessId, isArchived: false }).populate(
      'supplierId',
      'name phone email'
    );

    const suggestions = products.map((product) => {
      const dailyVelocity = salesVelocityMap.get(product._id.toString()) || 0;
      const hasSufficientData = dailyVelocity > 0;

      // Recommended reorder point = (daily velocity * leadTimeDays) + safetyBuffer
      const reorderPoint = hasSufficientData
        ? Math.ceil(dailyVelocity * leadTimeDays + safetyBuffer)
        : product.lowStockThreshold;

      const needsRestock = product.quantity <= reorderPoint;
      const suggestedReorderQuantity = needsRestock
        ? Math.max(reorderPoint * 2 - product.quantity, product.lowStockThreshold)
        : 0;

      const daysOfStockLeft =
        dailyVelocity > 0 ? Math.floor(product.quantity / dailyVelocity) : null;

      return {
        product: {
          id: product._id,
          name: product.name,
          sku: product.sku,
          quantity: product.quantity,
          lowStockThreshold: product.lowStockThreshold,
          purchasePrice: product.purchasePrice,
          imageUrl: product.imageUrl,
          supplier: product.supplierId,
        },
        dailyVelocity: Math.round(dailyVelocity * 100) / 100,
        daysOfStockLeft,
        needsRestock,
        reorderPoint,
        suggestedReorderQuantity,
        isEstimate: !hasSufficientData,
        note: hasSufficientData
          ? `${Math.round(dailyVelocity * 30)} units sold in last 30 days`
          : 'Low historical sales data; suggestion based on threshold safety buffer',
      };
    });

    // Sort to prioritize products that need restocking first
    suggestions.sort((a, b) => {
      if (a.needsRestock && !b.needsRestock) return -1;
      if (!a.needsRestock && b.needsRestock) return 1;
      return a.product.quantity - b.product.quantity;
    });

    res.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports/export/inventory-csv
router.get('/export/inventory-csv', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const products = await Product.find({ businessId, isArchived: false })
      .populate('supplierId', 'name')
      .sort({ name: 1 });

    let csv = 'Product Name,SKU,Barcode,Category,Quantity,Purchase Price,Selling Price,Inventory Value,Low Stock Threshold,Supplier\n';

    for (const p of products) {
      const inventoryVal = (p.quantity * p.purchasePrice).toFixed(2);
      const supplierName = (p.supplierId as any)?.name || 'N/A';
      const cleanName = `"${p.name.replace(/"/g, '""')}"`;
      const cleanCategory = `"${p.category.replace(/"/g, '""')}"`;
      csv += `${cleanName},${p.sku},${p.barcode || ''},${cleanCategory},${p.quantity},${p.purchasePrice},${p.sellingPrice},${inventoryVal},${p.lowStockThreshold},"${supplierName}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/reports/export/sales-csv
router.get('/export/sales-csv', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const businessId = req.user!.businessId;
    const sales = await Sale.find({ businessId })
      .populate('userId', 'name')
      .sort({ timestamp: -1 });

    let csv = 'Invoice Number,Date,Payment Method,Status,Items Count,Total Amount,Cashier\n';

    for (const s of sales) {
      const cashier = (s.userId as any)?.name || 'N/A';
      const dateStr = s.timestamp.toISOString();
      csv += `${s.invoiceNumber},${dateStr},${s.paymentMethod},${s.status},${s.items.length},${s.totalAmount.toFixed(2)},"${cashier}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sales_report.csv"');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
