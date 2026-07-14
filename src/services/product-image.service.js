const ProductImageModel = require('../models/product-image.model');
const ProductModel = require('../models/product.model');
const { NotFoundError, ValidationError } = require('../utils/errors');
const db = require('../config/db');

class ProductImageService {
  static async verifyProductExists(productId) {
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }
    return product;
  }

  static async getProductImages(productId) {
    await this.verifyProductExists(productId);
    return ProductImageModel.findByProductId(productId);
  }

  static async addImage(productId, { url, isPrimary, sortOrder }) {
    await this.verifyProductExists(productId);

    return db.transaction(async (conn) => {
      // If primary is true, clear all other primary images for this product
      if (isPrimary) {
        const clearSql = 'UPDATE product_images SET is_primary = 0 WHERE product_id = ?';
        await conn.query(clearSql, [productId]);
      }

      // Check if this is the first image. If so, automatically set it as primary.
      const existingImages = await ProductImageModel.findByProductId(productId);
      const makePrimary = existingImages.length === 0 ? true : isPrimary;

      const insertSql = `
        INSERT INTO product_images (product_id, url, is_primary, sort_order)
        VALUES (?, ?, ?, ?)
      `;
      const res = await conn.query(insertSql, [
        productId,
        url,
        makePrimary ? 1 : 0,
        sortOrder || 0
      ]);

      const selectSql = 'SELECT * FROM product_images WHERE id = ?';
      const rows = await conn.query(selectSql, [res.insertId]);
      return rows[0];
    });
  }

  static async reorderImages(productId, imageOrders) {
    await this.verifyProductExists(productId);

    if (!Array.isArray(imageOrders)) {
      throw new ValidationError('Images order parameter must be an array.');
    }

    return db.transaction(async (conn) => {
      for (const item of imageOrders) {
        if (!item.id || item.sortOrder === undefined) {
          throw new ValidationError('Each reorder item must have an id and sortOrder.');
        }

        // Verify the image belongs to the product
        const checkSql = 'SELECT product_id FROM product_images WHERE id = ?';
        const rows = await conn.query(checkSql, [item.id]);
        if (rows.length === 0 || Number(rows[0].product_id) !== Number(productId)) {
          throw new ValidationError(`Image ID ${item.id} does not belong to product ${productId}.`);
        }

        const updateSql = 'UPDATE product_images SET sort_order = ? WHERE id = ?';
        await conn.query(updateSql, [item.sortOrder, item.id]);
      }

      const finalSql = 'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC';
      return conn.query(finalSql, [productId]);
    });
  }

  static async setPrimaryImage(productId, imageId) {
    await this.verifyProductExists(productId);

    // Verify image belongs to product
    const image = await ProductImageModel.findById(imageId);
    if (!image || Number(image.product_id) !== Number(productId)) {
      throw new ValidationError(`Image ID ${imageId} does not belong to product ${productId}.`);
    }

    return db.transaction(async (conn) => {
      // Clear all primary
      const clearSql = 'UPDATE product_images SET is_primary = 0 WHERE product_id = ?';
      await conn.query(clearSql, [productId]);

      // Set this one as primary
      const setSql = 'UPDATE product_images SET is_primary = 1 WHERE id = ?';
      await conn.query(setSql, [imageId]);

      const selectSql = 'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC';
      return conn.query(selectSql, [productId]);
    });
  }

  static async deleteImage(productId, imageId) {
    await this.verifyProductExists(productId);

    // Verify image belongs to product
    const image = await ProductImageModel.findById(imageId);
    if (!image || Number(image.product_id) !== Number(productId)) {
      throw new ValidationError(`Image ID ${imageId} does not belong to product ${productId}.`);
    }

    return db.transaction(async (conn) => {
      const delSql = 'DELETE FROM product_images WHERE id = ?';
      await conn.query(delSql, [imageId]);

      // If we deleted the primary image, make the first remaining image primary
      if (image.is_primary) {
        const remainingSql = 'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC LIMIT 1';
        const remaining = await conn.query(remainingSql, [productId]);
        if (remaining.length > 0) {
          const setSql = 'UPDATE product_images SET is_primary = 1 WHERE id = ?';
          await conn.query(setSql, [remaining[0].id]);
        }
      }

      const selectSql = 'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC';
      return conn.query(selectSql, [productId]);
    });
  }
}

module.exports = ProductImageService;
