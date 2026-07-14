'use strict';

const db = require('../config/db');

async function requireApprovedAffiliate(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' }
      });
    }

    const affiliates = await db.query(
      "SELECT id, status FROM affiliates WHERE user_id = ? LIMIT 1",
      [req.user.id]
    );

    if (affiliates.length === 0 || affiliates[0].status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Approved affiliate profile is required to access this resource.' }
      });
    }

    // Attach affiliate info to request object
    req.affiliate = affiliates[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireApprovedAffiliate };
