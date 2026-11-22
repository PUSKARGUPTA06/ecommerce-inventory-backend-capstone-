const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { validateObjectId } = require('../middlewares/validate.middleware');

router.use(protect);

router.get('/me', userController.getMyProfile);
router.patch('/me', userController.updateMyProfile);

// Admin routes
router.get('/', authorizeRoles('admin'), userController.getAllUsers);
router.patch('/:id/role', authorizeRoles('admin'), validateObjectId('id'), userController.updateUserRoleOrStatus);

module.exports = router;