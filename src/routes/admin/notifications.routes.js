const express = require('express');
const router = express.Router();
const AdminNotificationController = require('../../controllers/admin/notification.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

router.use(authMiddleware, roleGuard('ADMIN'));

// Templates CRUD
router.get('/templates', AdminNotificationController.listTemplates);
router.post('/templates', AdminNotificationController.createTemplate);
router.put('/templates/:id', AdminNotificationController.updateTemplate);
router.delete('/templates/:id', AdminNotificationController.deleteTemplate);

// Logs
router.get('/logs', AdminNotificationController.listLogs);

module.exports = router;
