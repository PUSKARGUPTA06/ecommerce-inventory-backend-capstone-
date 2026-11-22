const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validateObjectId, validateRequiredFields } = require('../middlewares/validate.middleware');

router.get('/', productController.getProducts);
router.get('/:id', validateObjectId('id'), productController.getProductById);

router.post(
  '/',
  protect,
  authorizeRoles('seller', 'admin'),
  validateRequiredFields(['name', 'description', 'price', 'stock', 'category']),
  productController.createProduct
);
router.patch(
  '/:id',
  protect,
  authorizeRoles('seller', 'admin'),
  validateObjectId('id'),
  productController.updateProduct
);
router.delete(
  '/:id',
  protect,
  authorizeRoles('seller', 'admin'),
  validateObjectId('id'),
  productController.deleteProduct
);

module.exports = router;