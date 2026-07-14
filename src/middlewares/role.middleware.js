const { ForbiddenError, AuthenticationError } = require('../utils/errors');

const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to access this resource.'));
    }

    next();
  };
};

module.exports = roleGuard;
