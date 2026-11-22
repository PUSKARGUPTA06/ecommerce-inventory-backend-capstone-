const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const idValue = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(idValue)) {
      return next(new ApiError(400, `Invalid ID format for parameter '${paramName}'.`));
    }
    next();
  };
};

const validateRequiredFields = (fields = []) => {
  return (req, res, next) => {
    const missing = fields.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
    );

    if (missing.length > 0) {
      return next(
        new ApiError(400, 'Validation failed: Missing required fields.', missing.map((f) => `${f} is required`))
      );
    }
    next();
  };
};

module.exports = {
  validateObjectId,
  validateRequiredFields
};