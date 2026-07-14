const CategoryService = require('../services/category.service');
const { ValidationError } = require('../utils/errors');
const {
  validateCreateCategory,
  validateUpdateCategory
} = require('../validators/category.validator');

class CategoryController {
  static async getCategoriesTree(req, res, next) {
    try {
      const tree = await CategoryService.getCategoriesTree();
      res.status(200).json({
        success: true,
        data: tree
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCategory(req, res, next) {
    try {
      const category = await CategoryService.getCategoryById(req.params.id);
      res.status(200).json({
        success: true,
        data: category
      });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req, res, next) {
    try {
      const { error, value } = validateCreateCategory(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const category = await CategoryService.createCategory(value);
      res.status(201).json({
        success: true,
        data: category
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req, res, next) {
    try {
      const { error, value } = validateUpdateCategory(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const category = await CategoryService.updateCategory(req.params.id, value);
      res.status(200).json({
        success: true,
        data: category
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req, res, next) {
    try {
      await CategoryService.deleteCategory(req.params.id);
      res.status(200).json({
        success: true,
        data: { message: 'Category deleted successfully.' }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CategoryController;
