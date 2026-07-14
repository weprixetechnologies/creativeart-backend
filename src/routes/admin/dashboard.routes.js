const express = require('express');
const router = express.Router();
const AdminDashboardController = require('../../controllers/admin/dashboard.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminOnly = require('../../middlewares/admin.middleware');

router.use(authMiddleware, adminOnly);

router.get('/kpis', AdminDashboardController.getKpis);
router.get('/reports', AdminDashboardController.getReports);
router.get('/audit-logs', AdminDashboardController.listAuditLogs);
router.get('/audit-logs/export', AdminDashboardController.exportAuditLogs);

module.exports = router;
