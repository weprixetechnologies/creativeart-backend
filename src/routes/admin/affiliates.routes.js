'use strict';

const express = require('express');
const router = express.Router();
const AffiliateController = require('../../controllers/affiliate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

// Admin role check middleware
const adminOnly = [authMiddleware, roleGuard('ADMIN')];

// Affiliate approvals / CRU
router.get('/affiliates', adminOnly, AffiliateController.listAffiliates);
router.post('/affiliates/:id/approve', adminOnly, AffiliateController.approveAffiliate);
router.post('/affiliates/:id/reject', adminOnly, AffiliateController.rejectAffiliate);
router.post('/affiliates/:id/suspend', adminOnly, AffiliateController.suspendAffiliate);
router.put('/admin/affiliates/:id/commission', adminOnly, AffiliateController.updateCommissionOverride); // alias from specs
router.put('/affiliates/:id/commission', adminOnly, AffiliateController.updateCommissionOverride);
router.get('/affiliates/:id/commissions', adminOnly, AffiliateController.listCommissionsForAffiliate);

// Payout batches
router.post('/affiliate-payouts', adminOnly, AffiliateController.createPayoutBatch);
router.get('/affiliate-payouts', adminOnly, AffiliateController.listPayoutBatches);

// Settings
router.get('/affiliate-settings', adminOnly, AffiliateController.getAffiliateSettings);
router.put('/affiliate-settings', adminOnly, AffiliateController.updateAffiliateSettings);

// Dashboard
router.get('/affiliate-dashboard', adminOnly, AffiliateController.getAdminDashboardKPIs);

module.exports = router;
