const express = require('express');
const router = express.Router();
const AdminSettingsController = require('../../controllers/admin/settings.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminOnly = require('../../middlewares/admin.middleware');

router.use(authMiddleware, adminOnly);

router.get('/', AdminSettingsController.getSettings);
router.put('/', AdminSettingsController.updateSettings);

module.exports = router;
