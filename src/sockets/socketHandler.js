const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { orderEvents, EVENTS } = require('../events/orderEvents');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'PATCH']
    }
  });

  // Authenticate Socket.IO connections using JWT
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token required for Socket connection'));
      }

      const decoded = jwt.verify(token, config.jwtAccessSecret);
      socket.user = decoded; // { id, email, role }
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userRoom = `user:${socket.user.id}`;
    socket.join(userRoom);

    if (socket.user.role === 'admin') {
      socket.join('role:admin');
    }

    console.log(`Socket connected: ${socket.id} | User: ${socket.user.email} (${socket.user.role})`);

    socket.emit('connected', {
      message: 'Connected to E-Commerce Real-Time Notification Service',
      userId: socket.user.id,
      role: socket.user.role
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Bridge Internal EventEmitter -> Real-Time Socket.IO Notifications
  orderEvents.on(EVENTS.ORDER_PLACED, ({ order, sellerIds }) => {
    // 1. Notify customer
    io.to(`user:${order.customer}`).emit('notification:order_placed', {
      type: 'ORDER_PLACED',
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.orderStatus,
      message: `Your order ${order.orderNumber} has been confirmed!`
    });

    // 2. Notify each unique seller whose product was ordered
    sellerIds.forEach((sellerId) => {
      io.to(`user:${sellerId}`).emit('notification:new_seller_order', {
        type: 'NEW_ORDER',
        orderNumber: order.orderNumber,
        message: `You received a new order (${order.orderNumber}).`
      });
    });

    // 3. Notify admins
    io.to('role:admin').emit('notification:admin_order_feed', {
      type: 'NEW_ORDER',
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount
    });
  });

  orderEvents.on(EVENTS.ORDER_STATUS_UPDATED, ({ order }) => {
    io.to(`user:${order.customer}`).emit('notification:order_status', {
      type: 'ORDER_STATUS_UPDATED',
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      message: `Order ${order.orderNumber} status is now ${order.orderStatus}.`
    });
  });

  orderEvents.on(EVENTS.STOCK_LOW, ({ product }) => {
    const payload = {
      type: 'LOW_STOCK_ALERT',
      productId: product._id,
      productName: product.name,
      remainingStock: product.stock,
      threshold: product.lowStockThreshold,
      message: `Low stock alert: '${product.name}' has only ${product.stock} unit(s) left!`
    };

    io.to(`user:${product.seller}`).emit('notification:low_stock', payload);
    io.to('role:admin').emit('notification:low_stock', payload);
  });

  return io;
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO
};