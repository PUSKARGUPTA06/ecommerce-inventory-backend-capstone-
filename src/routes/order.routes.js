const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validateObjectId, validateRequiredFields } = require('../middlewares/validate.middleware');

router.use(protect);

router.post('/checkout', authorizeRoles('customer'), orderController.checkoutOrder);
router.get('/', orderController.getOrders);
router.get('/:id', validateObjectId('id'), orderController.getOrderById);
router.patch(
  '/:id/status',
  authorizeRoles('seller', 'admin'),
  validateObjectId('id'),
  validateRequiredFields(['orderStatus']),
  orderController.updateOrderStatus
);
router.patch('/:id/cancel', authorizeRoles('customer'), validateObjectId('id'), orderController.cancelMyOrder);

module.exports = router;