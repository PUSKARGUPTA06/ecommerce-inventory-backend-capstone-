const Cart = require('../models/Cart');
const Product = require('../models/Product');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// Helper to format cart with calculated totals
const buildCartSummary = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate({
    path: 'items.product',
    select: 'name price stock isDeleted seller'
  });

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  let totalItems = 0;
  let subtotal = 0;
  const validItems = [];

  for (const item of cart.items) {
    if (item.product && !item.product.isDeleted) {
      const itemTotal = item.product.price * item.quantity;
      totalItems += item.quantity;
      subtotal += itemTotal;
      validItems.push({
        product: item.product,
        quantity: item.quantity,
        itemTotal: Number(itemTotal.toFixed(2))
      });
    }
  }

  return {
    cartId: cart._id,
    items: validItems,
    totalItems,
    subtotal: Number(subtotal.toFixed(2))
  };
};

// GET /api/cart
const getMyCart = asyncHandler(async (req, res) => {
  const summary = await buildCartSummary(req.user._id);
  res.status(200).json(new ApiResponse(200, summary, 'Cart fetched successfully'));
});

// POST /api/cart/items
const addItemToCart = asyncHandler(async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const qty = parseInt(quantity, 10);

  if (qty < 1) throw new ApiError(400, 'Quantity must be at least 1.');

  const product = await Product.findOne({ _id: productId, isDeleted: false });
  if (!product) throw new ApiError(404, 'Product not found.');

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  const existingIndex = cart.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  const currentQtyInCart = existingIndex > -1 ? cart.items[existingIndex].quantity : 0;
  const requestedTotalQty = currentQtyInCart + qty;

  if (requestedTotalQty > product.stock) {
    throw new ApiError(
      400,
      `Insufficient stock. Only ${product.stock} unit(s) available for '${product.name}'.`
    );
  }

  if (existingIndex > -1) {
    cart.items[existingIndex].quantity = requestedTotalQty;
  } else {
    cart.items.push({ product: productId, quantity: qty });
  }

  await cart.save();
  const summary = await buildCartSummary(req.user._id);
  res.status(200).json(new ApiResponse(200, summary, 'Item added to cart'));
});

// PATCH /api/cart/items/:productId
const updateCartItemQuantity = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const qty = parseInt(req.body.quantity, 10);

  if (isNaN(qty) || qty < 0) {
    throw new ApiError(400, 'Quantity must be 0 or a positive integer.');
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  const itemIndex = cart.items.findIndex((i) => i.product.toString() === productId);
  if (itemIndex === -1) throw new ApiError(404, 'Item not found in cart.');

  if (qty === 0) {
    cart.items.splice(itemIndex, 1);
  } else {
    const product = await Product.findOne({ _id: productId, isDeleted: false });
    if (!product) throw new ApiError(404, 'Product no longer exists.');
    if (qty > product.stock) {
      throw new ApiError(400, `Insufficient stock. Maximum available: ${product.stock}.`);
    }
    cart.items[itemIndex].quantity = qty;
  }

  await cart.save();
  const summary = await buildCartSummary(req.user._id);
  res.status(200).json(new ApiResponse(200, summary, 'Cart updated successfully'));
});

// DELETE /api/cart/items/:productId
const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();

  const summary = await buildCartSummary(req.user._id);
  res.status(200).json(new ApiResponse(200, summary, 'Item removed from cart'));
});

// DELETE /api/cart
const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { $set: { items: [] } });
  res.status(200).json(new ApiResponse(200, { items: [], totalItems: 0, subtotal: 0 }, 'Cart cleared'));
});

module.exports = {
  getMyCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
  clearCart
};