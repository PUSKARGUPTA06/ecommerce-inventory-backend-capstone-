const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');
const { validateRequiredFields } = require('../middlewares/validate.middleware');

router.post(
  '/register',
  validateRequiredFields(['name', 'email', 'password']),
  authController.register
);
router.post('/login', validateRequiredFields(['email', 'password']), authController.login);
router.post('/refresh', validateRequiredFields(['refreshToken']), authController.refreshAccessToken);
router.post('/logout', protect, authController.logout);

module.exports = router;