const Category = require('../models/Category');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/categories
const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  res.status(200).json(new ApiResponse(200, categories, 'Categories fetched successfully'));
});

// POST /api/categories (Admin)
const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const category = await Category.create({ name, description });
  res.status(201).json(new ApiResponse(201, category, 'Category created successfully'));
});

// PATCH /api/categories/:id (Admin)
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!category) throw new ApiError(404, 'Category not found.');
  res.status(200).json(new ApiResponse(200, category, 'Category updated successfully'));
});

// DELETE /api/categories/:id (Admin - Soft deactivate)
const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );
  if (!category) throw new ApiError(404, 'Category not found.');
  res.status(200).json(new ApiResponse(200, null, 'Category deactivated successfully'));
});

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
};