const { AppError } = require('../utils/errors');

const errorMiddleware = (err, req, res, next) => {
  if (err.statusCode === 401 || err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    console.warn(`[Auth Info] ${err.message || 'Authentication failed'}`);
  } else {
    console.error('API Error:', err);
  }

  // If headers already sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Handle Joi validation errors if they bubble up somehow
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.details[0].message
      }
    });
  }

  // Handle JWT errors explicitly if needed
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid token.'
      }
    });
  }

  // Default fallback for unhandled exceptions
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred.' 
        : err.message
    }
  });
};

module.exports = errorMiddleware;
