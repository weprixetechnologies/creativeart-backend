class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_FAILED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

class IllegalTransitionError extends AppError {
  constructor(message) {
    super(message, 400, 'ILLEGAL_TRANSITION');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

class MixedCartNotAllowedError extends AppError {
  constructor(message = 'Mixing standard products and custom projects in the same cart is not allowed.') {
    super(message, 400, 'MIXED_CART_NOT_ALLOWED');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  IllegalTransitionError,
  RateLimitError,
  MixedCartNotAllowedError
};
