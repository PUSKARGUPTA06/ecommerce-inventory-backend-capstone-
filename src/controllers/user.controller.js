const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/users/me
const getMyProfile = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, req.user, 'Profile fetched successfully'));
});

// PATCH /api/users/me
const updateMyProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = {};
  if (req.body.name) allowedUpdates.name = req.body.name;

  if (Object.keys(allowedUpdates).length === 0) {
    throw new ApiError(400, 'Please provide valid fields to update (e.g., name).');
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, allowedUpdates, {
    new: true,
    runValidators: true
  });

  res.status(200).json(new ApiResponse(200, updatedUser, 'Profile updated successfully'));
});

// GET /api/users (Admin only)
const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.role) filter.role = req.query.role;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      'Users fetched successfully'
    )
  );
});

// PATCH /api/users/:id/role (Admin only)
const updateUserRoleOrStatus = asyncHandler(async (req, res) => {
  const { role, isActive } = req.body;
  const updates = {};

  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;

  const user = await User.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  res.status(200).json(new ApiResponse(200, user, 'User updated successfully'));
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  getAllUsers,
  updateUserRoleOrStatus
};