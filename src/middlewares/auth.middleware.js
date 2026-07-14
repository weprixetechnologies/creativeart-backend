const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../utils/errors');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Authentication token missing or invalid.');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
    
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new AuthenticationError('Token has expired.'));
        }
        return next(new AuthenticationError('Invalid authentication token.'));
      }

      req.user = {
        id: decoded.userId,
        role: decoded.role
      };
      next();
    });
  } catch (err) {
    next(err);
  }
};

module.exports = authMiddleware;
