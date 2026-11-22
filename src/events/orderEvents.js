const EventEmitter = require('events');

class OrderEventEmitter extends EventEmitter {}

const orderEvents = new OrderEventEmitter();

// Event Constants
const EVENTS = {
  ORDER_PLACED: 'order:placed',
  ORDER_STATUS_UPDATED: 'order:status_updated',
  STOCK_LOW: 'inventory:stock_low'
};

module.exports = {
  orderEvents,
  EVENTS
};