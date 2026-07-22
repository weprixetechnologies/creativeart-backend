const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settings.controller');

router.get('/', SettingsController.getPublicSettings);

module.exports = router;
