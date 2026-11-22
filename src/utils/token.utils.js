const jwt = require('jsonwebtoken');
const config = require('../config/env');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiresIn }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiresIn }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken
};