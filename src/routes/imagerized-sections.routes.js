const express = require('express');
const router = express.Router();
const imagerizedSectionController = require('../controllers/imagerized-section.controller');

router.get('/', imagerizedSectionController.getActiveSections);

module.exports = router;
