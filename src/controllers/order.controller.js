const crypto = require('crypto');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { orderEvents, EVENTS } = require('../events/orderEvents');

const generateOrderNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${datePart}-${randomPart}`;
};

// POST /api/orders/checkout (Customer places order from cart)
const checkoutOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = 'SIMULATED_UPI' } = req.body;

  if (
    !shippingAddress ||
    !shippingAddress.street ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.postalCode
  ) {
    throw new ApiError(400, 'Complete shippingAddress (street, city, state, postalCode) is required.');
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Cannot checkout with an empty cart.');
  }

  const decrementedItems = [];
  const orderItems = [];
  let totalAmount = 0;

  try {
    // Step 1: Atomically verify & decrement stock for every cart item to prevent overselling[cite: 1]
    for (const cartItem of cart.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: cartItem.product,
          isDeleted: false,
          stock: { $gte: cartItem.quantity }
        },
        {
          $inc: { stock: -cartItem.quantity }
        },
        { new: true }
      );

      if (!updatedProduct) {
        const checkProd = await Product.findById(cartItem.product);
        const prodName = checkProd ? checkProd.name : 'Unknown Product';
        throw new ApiError(
          409,
          `Checkout failed: '${prodName}' is out of stock or has insufficient quantity.`
        );
      }

      decrementedItems.push({
        productId: updatedProduct._id,
        quantity: cartItem.quantity,
        productDoc: updatedProduct
      });

      const lineTotal = updatedProduct.price * cartItem.quantity;
      totalAmount += lineTotal;

      orderItems.push({
        product: updatedProduct._id,
        seller: updatedProduct.seller,
        nameSnapshot: updatedProduct.name,
        priceSnapshot: updatedProduct.price,
        quantity: cartItem.quantity
      });
    }

    // Step 2: Create Order record with server-calculated totals
    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      customer: req.user._id,
      items: orderItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      shippingAddress,
      paymentMethod,
      paymentStatus: paymentMethod === 'COD' ? 'PENDING_COD' : 'SIMULATED_PAID',
      orderStatus: 'CONFIRMED'
    });

    // Step 3: Clear customer cart
    cart.items = [];
    await cart.save();

    // Step 4: Emit real-time application events[cite: 1]
    const uniqueSellerIds = [...new Set(orderItems.map((i) => i.seller.toString()))];
    orderEvents.emit(EVENTS.ORDER_PLACED, { order, sellerIds: uniqueSellerIds });

    for (const entry of decrementedItems) {
      if (entry.productDoc.stock <= entry.productDoc.lowStockThreshold) {
        orderEvents.emit(EVENTS.STOCK_LOW, { product: entry.productDoc });
      }
    }

    res.status(201).json(new ApiResponse(201, order, 'Order placed successfully'));
  } catch (error) {
    // Compensating Rollback: Restore stock for any items already decremented before failure
    for (const rolledBack of decrementedItems) {
      await Product.findByIdAndUpdate(rolledBack.productId, {
        $inc: { stock: rolledBack.quantity }
      });
    }
    throw error;
  }
});

// GET /api/orders (Customer sees own orders; Seller sees orders containing their items; Admin sees all)
const getOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.user.role === 'customer') {
    filter.customer = req.user._id;
  } else if (req.user.role === 'seller') {
    filter['items.seller'] = req.user._id;
  }

  if (req.query.status) {
    filter.orderStatus = req.query.status.toUpperCase();
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('customer', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(filter)
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      'Orders fetched successfully'
    )
  );
});

// GET /api/orders/:id
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customer', 'name email')
    .populate('items.product', 'name price');

  if (!order) throw new ApiError(404, 'Order not found.');

  const isCustomerOwner = order.customer._id.toString() === req.user._id.toString();
  const isInvolvedSeller = order.items.some(
    (item) => item.seller.toString() === req.user._id.toString()
  );

  if (req.user.role !== 'admin' && !isCustomerOwner && !isInvolvedSeller) {
    throw new ApiError(403, 'Forbidden: You do not have permission to view this order.');
  }

  res.status(200).json(new ApiResponse(200, order, 'Order details fetched successfully'));
});

// PATCH /api/orders/:id/status (Seller / Admin updates fulfillment status)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderStatus } = req.body;
  const validTransitions = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: []
  };

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');

  if (req.user.role === 'seller') {
    const ownsItem = order.items.some((i) => i.seller.toString() === req.user._id.toString());
    if (!ownsItem) {
      throw new ApiError(403, 'Forbidden: You are not a seller for any item in this order.');
    }
  }

  const nextStatus = orderStatus?.toUpperCase();
  if (!validTransitions[order.orderStatus]?.includes(nextStatus)) {
    throw new ApiError(
      400,
      `Invalid status transition from '${order.orderStatus}' to '${nextStatus}'.`
    );
  }

  // If cancelled by seller/admin, restore stock atomically[cite: 1]
  if (nextStatus === 'CANCELLED') {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
    order.cancelledAt = new Date();
    if (order.paymentStatus === 'SIMULATED_PAID') {
      order.paymentStatus = 'REFUNDED_SIMULATED';
    }
  }

  order.orderStatus = nextStatus;
  await order.save();

  orderEvents.emit(EVENTS.ORDER_STATUS_UPDATED, { order });

  res.status(200).json(new ApiResponse(200, order, `Order status updated to ${nextStatus}`));
});

// PATCH /api/orders/:id/cancel (Customer cancels own order before shipping)
const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found.');

  if (order.customer.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Forbidden: You can only cancel your own orders.');
  }

  if (!['PENDING', 'CONFIRMED'].includes(order.orderStatus)) {
    throw new ApiError(
      400,
      `Order cannot be cancelled because it is already '${order.orderStatus}'.`
    );
  }

  // Restore inventory stock atomically[cite: 1]
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }

  order.orderStatus = 'CANCELLED';
  order.cancelledAt = new Date();
  if (order.paymentStatus === 'SIMULATED_PAID') {
    order.paymentStatus = 'REFUNDED_SIMULATED';
  }
  await order.save();

  orderEvents.emit(EVENTS.ORDER_STATUS_UPDATED, { order });

  res.status(200).json(new ApiResponse(200, order, 'Order cancelled and stock restored'));
});

module.exports = {
  checkoutOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder
};