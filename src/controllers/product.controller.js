const ProductService = require('../services/product.service');
const { ValidationError } = require('../utils/errors');
const {
  validateCreateProduct,
  validateUpdateProduct
} = require('../validators/product.validator');

class ProductController {
  static async getProducts(req, res, next) {
    try {
      const { search, categoryId, itemType, status, page, limit } = req.query;
      
      const isAdminRoute = req.originalUrl.includes('/admin/');

      const filters = {
        search,
        categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
        itemType,
        status: isAdminRoute ? status : 'ACTIVE',
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10
      };

      const result = await ProductService.getProducts(filters);
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta
      });
    } catch (err) {
      next(err);
    }
  }

  static async clearCache(req, res, next) {
    try {
      await ProductService.clearProductsCache();
      res.status(200).json({
        success: true,
        data: { message: 'Product catalog cache cleared successfully.' }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProduct(req, res, next) {
    try {
      const product = await ProductService.getProductById(req.params.id);
      res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  static async getProductBySlug(req, res, next) {
    try {
      const product = await ProductService.getProductBySlug(req.params.slug, true);
      res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req, res, next) {
    try {
      const { error, value } = validateCreateProduct(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const product = await ProductService.createProduct(value);
      res.status(201).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req, res, next) {
    try {
      const { error, value } = validateUpdateProduct(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const product = await ProductService.updateProduct(req.params.id, value);
      res.status(200).json({
        success: true,
        data: product
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteProduct(req, res, next) {
    try {
      await ProductService.deleteProduct(req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Catalog item deleted successfully.' }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProductController;
