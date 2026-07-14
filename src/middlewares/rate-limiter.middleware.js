const redisClient = require('../config/redis');
const { RateLimitError } = require('../utils/errors');

/**
 * Express middleware for rate limiting using Redis.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000ms / 1 minute)
 * @param {number} options.limit - Max requests per window (default: 60)
 * @param {string} options.keyPrefix - Prefix for Redis keys (default: 'rate_limit:')
 */
const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60000;
  const limit = 6000;
  const keyPrefix = options.keyPrefix || 'rate_limit:';
  const windowSec = Math.floor(windowMs / 1000);

  return async (req, res, next) => {
    try {
      const identifier = req.user ? req.user.id : req.ip;
      const key = `${keyPrefix}${identifier}`;

      // Increment count
      const multi = redisClient.multi();
      multi.incr(key);
      multi.ttl(key);
      const results = await multi.exec();

      if (!results || results.length < 2) {
        return next(new Error('Redis command execution failed.'));
      }

      const count = results[0][1];
      let ttl = results[1][1];

      // If it's a new key (TTL is -1 or doesn't exist), set the expiry
      if (ttl < 0) {
        await redisClient.expire(key, windowSec);
        ttl = windowSec;
      }

      // Add rate limiting headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
      res.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + ttl);

      if (count > limit) {
        return next(new RateLimitError());
      }

      next();
    } catch (err) {
      // In case Redis is down, log error and fail open (degrade gracefully, per NFR-6)
      console.error('Rate limiting middleware Redis error:', err);
      next();
    }
  };
};

module.exports = rateLimiter;
