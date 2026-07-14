const express = require('express');
const StorageService = require('../services/storage.service');
const { ValidationError } = require('../utils/errors');

const router = express.Router();

// Handle binary body parser middleware for this route specifically
const rawParser = express.raw({ type: '*/*', limit: '20mb' });

router.put('/upload', rawParser, async (req, res, next) => {
  try {
    const { key, contentType } = req.query;
    
    if (!key) {
      throw new ValidationError('Query parameter "key" is required.');
    }

    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new ValidationError('Empty or invalid upload body.');
    }

    const fileUrl = await StorageService.uploadToBunny(key, req.body, contentType);

    res.status(200).json({
      success: true,
      data: { fileUrl }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
