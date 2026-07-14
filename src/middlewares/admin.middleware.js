const { ValidationError } = require('../utils/errors');

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: { message: 'Authentication required.', code: 'UNAUTHORIZED' } });
  }
  if (req.user.role === 'CUSTOMER') {
    return res.status(403).json({ success: false, error: { message: 'Admin access required.', code: 'FORBIDDEN' } });
  }
  next();
};

module.exports = adminOnly;
