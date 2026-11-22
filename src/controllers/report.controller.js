const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Aggregation Pipeline 1: Sales & Revenue Summary (with optional date range & seller scope)
// GET /api/reports/sales-summary
const getSalesSummary = asyncHandler(async (req, res) => {
  const matchStage = {
    orderStatus: { $ne: 'CANCELLED' }
  };

  if (req.query.startDate || req.query.endDate) {
    matchStage.createdAt = {};
    if (req.query.startDate) matchStage.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) matchStage.createdAt.$lte = new Date(req.query.endDate);
  }

  const pipeline = [{ $match: matchStage }, { $unwind: '$items' }];

  // If seller is requesting, filter only their sold items
  if (req.user.role === 'seller') {
    pipeline.push({
      $match: { 'items.seller': new mongoose.Types.ObjectId(req.user._id) }
    });
  }

  pipeline.push(
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        totalRevenue: {
          $sum: { $multiply: ['$items.priceSnapshot', '$items.quantity'] }
        },
        totalUnitsSold: { $sum: '$items.quantity' },
        distinctOrders: { $addToSet: '$_id' }
      }
    },
    {
      $project: {
        _id: 0,
        date: {
          $concat: [
            { $toString: '$_id.year' },
            '-',
            { $toString: '$_id.month' },
            '-',
            { $toString: '$_id.day' }
          ]
        },
        totalRevenue: { $round: ['$totalRevenue', 2] },
        totalUnitsSold: 1,
        orderCount: { $size: '$distinctOrders' }
      }
    },
    { $sort: { date: -1 } }
  );

  const dailyBreakdown = await Order.aggregate(pipeline);

  const overallTotals = dailyBreakdown.reduce(
    (acc, day) => {
      acc.grossRevenue = Number((acc.grossRevenue + day.totalRevenue).toFixed(2));
      acc.totalUnitsSold += day.totalUnitsSold;
      acc.totalOrders += day.orderCount;
      return acc;
    },
    { grossRevenue: 0, totalUnitsSold: 0, totalOrders: 0 }
  );

  res.status(200).json(
    new ApiResponse(
      200,
      { overallTotals, dailyBreakdown },
      'Sales summary report generated successfully'
    )
  );
});

// Aggregation Pipeline 2: Top Best-Selling Products
// GET /api/reports/best-sellers
const getBestSellingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);

  const pipeline = [
    { $match: { orderStatus: { $ne: 'CANCELLED' } } },
    { $unwind: '$items' }
  ];

  if (req.user.role === 'seller') {
    pipeline.push({
      $match: { 'items.seller': new mongoose.Types.ObjectId(req.user._id) }
    });
  }

  pipeline.push(
    {
      $group: {
        _id: '$items.product',
        productName: { $first: '$items.nameSnapshot' },
        totalQuantitySold: { $sum: '$items.quantity' },
        totalRevenueGenerated: {
          $sum: { $multiply: ['$items.priceSnapshot', '$items.quantity'] }
        },
        orderAppearances: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'currentProductInfo'
      }
    },
    {
      $unwind: {
        path: '$currentProductInfo',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        productName: 1,
        totalQuantitySold: 1,
        totalRevenueGenerated: { $round: ['$totalRevenueGenerated', 2] },
        orderAppearances: 1,
        currentStock: '$currentProductInfo.stock',
        currentPrice: '$currentProductInfo.price'
      }
    },
    { $sort: { totalQuantitySold: -1, totalRevenueGenerated: -1 } },
    { $limit: limit }
  );

  const bestSellers = await Order.aggregate(pipeline);

  res.status(200).json(
    new ApiResponse(200, bestSellers, 'Best-selling products report generated successfully')
  );
});

// Aggregation Pipeline 3: Inventory Health & Category Valuation Report
// GET /api/reports/inventory-summary
const getInventorySummary = asyncHandler(async (req, res) => {
  const matchStage = { isDeleted: false };

  if (req.user.role === 'seller') {
    matchStage.seller = new mongoose.Types.ObjectId(req.user._id);
  }

  const categoryBreakdown = await Product.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$category',
        totalProducts: { $sum: 1 },
        totalStockUnits: { $sum: '$stock' },
        inventoryValuation: { $sum: { $multiply: ['$price', '$stock'] } },
        lowStockCount: {
          $sum: {
            $cond: [{ $lte: ['$stock', '$lowStockThreshold'] }, 1, 0]
          }
        },
        outOfStockCount: {
          $sum: {
            $cond: [{ $eq: ['$stock', 0] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    { $unwind: '$categoryInfo' },
    {
      $project: {
        _id: 0,
        categoryId: '$_id',
        categoryName: '$categoryInfo.name',
        totalProducts: 1,
        totalStockUnits: 1,
        inventoryValuation: { $round: ['$inventoryValuation', 2] },
        lowStockCount: 1,
        outOfStockCount: 1
      }
    },
    { $sort: { inventoryValuation: -1 } }
  ]);

  const lowStockProducts = await Product.find({
    ...matchStage,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] }
  })
    .populate('category', 'name')
    .select('name price stock lowStockThreshold category');

  res.status(200).json(
    new ApiResponse(
      200,
      { categoryBreakdown, lowStockProducts },
      'Inventory summary report generated successfully'
    )
  );
});

module.exports = {
  getSalesSummary,
  getBestSellingProducts,
  getInventorySummary
};