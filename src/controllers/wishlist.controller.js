const db = require('../config/db');
const { NotFoundError } = require('../utils/errors');

class WishlistController {
  async toggleWishlist(req, res, next) {
    try {
      const productId = parseInt(req.body.productId, 10);
      const userId = req.user.id;

      // Verify product exists
      const prod = await db.query("SELECT id FROM products WHERE id = ?", [productId]);
      if (prod.length === 0) {
        throw new NotFoundError('Product not found.');
      }

      // Check if already in wishlist
      const existing = await db.query(
        "SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?",
        [userId, productId]
      );

      let action = 'added';
      if (existing.length > 0) {
        await db.query("DELETE FROM wishlists WHERE id = ?", [existing[0].id]);
        action = 'removed';
      } else {
        await db.query(
          "INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)",
          [userId, productId]
        );
      }

      res.status(200).json({
        success: true,
        message: `Product successfully ${action} wishlist.`,
        data: { inWishlist: action === 'added' }
      });
    } catch (err) {
      next(err);
    }
  }

  async listWishlist(req, res, next) {
    try {
      const userId = req.user.id;

      const rows = await db.query(
        `SELECT w.id as wishlist_id, p.* 
         FROM wishlists w
         JOIN products p ON w.product_id = p.id
         WHERE w.user_id = ?
         ORDER BY w.id DESC`,
        [userId]
      );

      const formatted = rows.map(p => ({
        wishlistId: Number(p.wishlist_id),
        id: Number(p.id),
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: parseFloat(p.price),
        compareAtPrice: p.compare_at_price ? parseFloat(p.compare_at_price) : null,
        mainImage: p.main_image
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WishlistController();
