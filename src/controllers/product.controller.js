const Product = require('../models/Product');
const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { orderEvents, EVENTS } = require('../events/orderEvents');

// GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter = { isDeleted: false };

  if (req.query.category) filter.category = req.query.category;
  if (req.query.seller) filter.seller = req.query.seller;
  if (req.query.inStock === 'true') filter.stock = { $gt: 0 };

  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }

  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  // Sorting
  let sortOption = { createdAt: -1 };
  if (req.query.sort === 'price_asc') sortOption = { price: 1 };
  if (req.query.sort === 'price_desc') sortOption = { price: -1 };
  if (req.query.sort === 'stock_asc') sortOption = { stock: 1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('seller', 'name email')
      .sort(sortOption)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter)
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      'Products fetched successfully'
    )
  );
});

// GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false })
    .populate('category', 'name slug')
    .populate('seller', 'name email');

  if (!product) throw new ApiError(404, 'Product not found.');

  res.status(200).json(new ApiResponse(200, product, 'Product fetched successfully'));
});

// POST /api/products (Seller / Admin)
const createProduct = asyncHandler(async (req, res) => {
  const { name, description, price, stock, lowStockThreshold, category } = req.body;

  const categoryExists = await Category.findOne({ _id: category, isActive: true });
  if (!categoryExists) {
    throw new ApiError(404, 'Valid active category not found.');
  }

  const product = await Product.create({
    name,
    description,
    price,
    stock,
    lowStockThreshold: lowStockThreshold ?? 5,
    category,
    seller: req.user._id
  });

  if (product.stock <= product.lowStockThreshold) {
    orderEvents.emit(EVENTS.STOCK_LOW, { product });
  }

  res.status(201).json(new ApiResponse(201, product, 'Product created successfully'));
});

// PATCH /api/products/:id (Owner Seller or Admin)
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found.');

  // Ownership check: seller can only update their own product
  if (req.user.role !== 'admin' && product.seller.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Forbidden: You can only modify your own products.');
  }

  const allowedFields = ['name', 'description', 'price', 'stock', 'lowStockThreshold', 'category'];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

  await product.save();

  if (product.stock <= product.lowStockThreshold) {
    orderEvents.emit(EVENTS.STOCK_LOW, { product });
  }

  res.status(200).json(new ApiResponse(200, product, 'Product updated successfully'));
});

// DELETE /api/products/:id (Owner Seller or Admin - Soft Delete)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found.');

  if (req.user.role !== 'admin' && product.seller.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Forbidden: You can only delete your own products.');
  }

  product.isDeleted = true;
  await product.save();

  res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully'));
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};