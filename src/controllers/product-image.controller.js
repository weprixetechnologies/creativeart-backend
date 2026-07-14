const ProductImageService = require('../services/product-image.service');
const { ValidationError } = require('../utils/errors');
const { validateProductImageAction } = require('../validators/product-image.validator');

class ProductImageController {
  static async getProductImages(req, res, next) {
    try {
      const productId = req.params.id;
      const images = await ProductImageService.getProductImages(productId);
      res.status(200).json({
        success: true,
        data: images
      });
    } catch (err) {
      next(err);
    }
  }

  static async handleImageAction(req, res, next) {
    try {
      const productId = req.params.id;
      
      const { error, value } = validateProductImageAction(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const { action } = value;
      let result;

      if (action === 'add') {
        result = await ProductImageService.addImage(productId, value);
      } else if (action === 'reorder') {
        result = await ProductImageService.reorderImages(productId, value.images);
      } else if (action === 'set-primary') {
        result = await ProductImageService.setPrimaryImage(productId, value.imageId);
      } else if (action === 'delete') {
        result = await ProductImageService.deleteImage(productId, value.imageId);
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProductImageController;
