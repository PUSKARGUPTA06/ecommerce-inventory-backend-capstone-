const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validateObjectId, validateRequiredFields } = require('../middlewares/validate.middleware');

// Shopping cart is strictly for customers
router.use(protect, authorizeRoles('customer'));

router.get('/', cartController.getMyCart);
router.post('/items', validateRequiredFields(['productId']), cartController.addItemToCart);
router.patch(
  '/items/:productId',
  validateObjectId('productId'),
  validateRequiredFields(['quantity']),
  cartController.updateCartItemQuantity
);
router.delete('/items/:productId', validateObjectId('productId'), cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;