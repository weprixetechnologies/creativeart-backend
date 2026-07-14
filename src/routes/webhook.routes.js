const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhook.controller');

router.post('/phonepe', express.raw({ type: 'application/json' }), WebhookController.handlePhonepe);
router.post('/shiprocket', WebhookController.handleShiprocket);

module.exports = router;
