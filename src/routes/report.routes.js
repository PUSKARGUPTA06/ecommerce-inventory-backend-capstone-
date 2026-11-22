const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');

// Analytics & Reports restricted to Sellers and Admins
router.use(protect, authorizeRoles('seller', 'admin'));

router.get('/sales-summary', reportController.getSalesSummary);
router.get('/best-sellers', reportController.getBestSellingProducts);
router.get('/inventory-summary', reportController.getInventorySummary);

module.exports = router;