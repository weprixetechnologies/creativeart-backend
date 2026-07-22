const BannerModel = require('../models/banner.model');
const { ValidationError, NotFoundError } = require('../utils/errors');

class BannerController {
  // Public - list active banners
  static async getActiveBanners(req, res, next) {
    try {
      const banners = await BannerModel.findAll(true);
      res.status(200).json({ success: true, data: banners });
    } catch (err) {
      next(err);
    }
  }

  // Admin - list all banners
  static async getAllBanners(req, res, next) {
    try {
      const banners = await BannerModel.findAll(false);
      res.status(200).json({ success: true, data: banners });
    } catch (err) {
      next(err);
    }
  }

  // Admin - create banner
  static async createBanner(req, res, next) {
    try {
      const { imageUrl, linkUrl, isActive, sortOrder } = req.body;
      if (!imageUrl) {
        throw new ValidationError('imageUrl is required.');
      }
      const banner = await BannerModel.create({ imageUrl, linkUrl, isActive, sortOrder });
      res.status(201).json({ success: true, data: banner });
    } catch (err) {
      next(err);
    }
  }

  // Admin - update banner
  static async updateBanner(req, res, next) {
    try {
      const { id } = req.params;
      const banner = await BannerModel.update(id, req.body);
      if (!banner) {
        throw new NotFoundError('Banner not found.');
      }
      res.status(200).json({ success: true, data: banner });
    } catch (err) {
      next(err);
    }
  }

  // Admin - delete banner
  static async deleteBanner(req, res, next) {
    try {
      const { id } = req.params;
      await BannerModel.delete(id);
      res.status(200).json({ success: true, message: 'Banner deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BannerController;
