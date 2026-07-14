'use strict';

const express = require('express');
const router = express.Router();
const AffiliateController = require('../controllers/affiliate.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireApprovedAffiliate } = require('../middlewares/affiliate.middleware');

// Public
router.get('/validate-code/:code', AffiliateController.validateCode);

// Customer Auth gated
router.post('/apply', authMiddleware, AffiliateController.apply);
router.get('/me', authMiddleware, AffiliateController.me);

// Customer Approved Affiliate gated
router.get('/commissions', authMiddleware, requireApprovedAffiliate, AffiliateController.myCommissions);
router.get('/referral-link', authMiddleware, requireApprovedAffiliate, AffiliateController.getReferralLink);

module.exports = router;
