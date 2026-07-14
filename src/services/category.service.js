const CategoryModel = require('../models/category.model');
const { NotFoundError, ConflictError } = require('../utils/errors');

class CategoryService {
  static async createCategory({ parentId, name, slug, sortOrder, status }) {
    // Check if slug is taken
    const existing = await CategoryModel.findBySlug(slug);
    if (existing) {
      throw new ConflictError('Category slug is already in use.');
    }

    // Verify parent exists if provided
    if (parentId) {
      const parent = await CategoryModel.findById(parentId);
      if (!parent) {
        throw new NotFoundError('Parent category not found.');
      }
    }

    return CategoryModel.create({ parentId, name, slug, sortOrder, status });
  }

  static async getCategoryById(id) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }
    return category;
  }

  static async getCategoriesTree() {
    const list = await CategoryModel.findAll();
    
    // Map list to include empty children array
    const categoryMap = {};
    list.forEach(cat => {
      categoryMap[cat.id] = { ...cat, children: [] };
    });

    const roots = [];
    list.forEach(cat => {
      const mappedCat = categoryMap[cat.id];
      if (cat.parent_id) {
        const parent = categoryMap[cat.parent_id];
        if (parent) {
          parent.children.push(mappedCat);
        } else {
          // If parent is not found for some reason, treat as root
          roots.push(mappedCat);
        }
      } else {
        roots.push(mappedCat);
      }
    });

    return roots;
  }

  static async updateCategory(id, updates) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }

    if (updates.slug && updates.slug !== category.slug) {
      const existing = await CategoryModel.findBySlug(updates.slug);
      if (existing) {
        throw new ConflictError('Category slug is already in use.');
      }
    }

    if (updates.parentId) {
      if (Number(updates.parentId) === Number(id)) {
        throw new ConflictError('A category cannot be its own parent.');
      }
      const parent = await CategoryModel.findById(updates.parentId);
      if (!parent) {
        throw new NotFoundError('Parent category not found.');
      }
    }

    return CategoryModel.update(id, updates);
  }

  static async deleteCategory(id) {
    const category = await CategoryModel.findById(id);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }

    // Check if products reference it
    const productCount = await CategoryModel.countProducts(id);
    if (productCount > 0) {
      throw new ConflictError('Cannot delete category because it has associated products.');
    }

    // Check if it has subcategories
    const all = await CategoryModel.findAll();
    const hasChildren = all.some(cat => Number(cat.parent_id) === Number(id));
    if (hasChildren) {
      throw new ConflictError('Cannot delete category because it has subcategories.');
    }

    await CategoryModel.delete(id);
  }
}

module.exports = CategoryService;
