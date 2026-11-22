const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    nameSnapshot: {
      type: String,
      required: true
    },
    priceSnapshot: {
      type: Number,
      required: true,
      min: [0, 'Price snapshot cannot be negative']
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'Order must contain at least one item'
      }
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    shippingAddress: {
      street: { type: String, required: [true, 'Street address is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, required: [true, 'State is required'], trim: true },
      postalCode: { type: String, required: [true, 'Postal code is required'], trim: true },
      country: { type: String, default: 'India', trim: true }
    },
    paymentMethod: {
      type: String,
      enum: ['SIMULATED_CARD', 'SIMULATED_UPI', 'COD'],
      default: 'SIMULATED_UPI'
    },
    paymentStatus: {
      type: String,
      enum: ['SIMULATED_PAID', 'PENDING_COD', 'REFUNDED_SIMULATED'],
      default: 'SIMULATED_PAID'
    },
    orderStatus: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'CONFIRMED'
    },
    cancelledAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast customer history and seller order/analytics queries
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ 'items.seller': 1, orderStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);