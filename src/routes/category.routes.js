const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validateObjectId, validateRequiredFields } = require('../middlewares/validate.middleware');

router.get('/', categoryController.getAllCategories);

router.post(
  '/',
  protect,
  authorizeRoles('admin'),
  validateRequiredFields(['name']),
  categoryController.createCategory
);
router.patch(
  '/:id',
  protect,
  authorizeRoles('admin'),
  validateObjectId('id'),
  categoryController.updateCategory
);
router.delete(
  '/:id',
  protect,
  authorizeRoles('admin'),
  validateObjectId('id'),
  categoryController.deleteCategory
);

module.exports = router;