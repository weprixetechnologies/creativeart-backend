const db = require('../config/db');
const { ValidationError, NotFoundError } = require('../utils/errors');

class ReviewController {
  async submitReview(req, res, next) {
    try {
      const productId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { rating, title, comment } = req.body;

      const rate = parseInt(rating, 10);
      if (isNaN(rate) || rate < 1 || rate > 5) {
        throw new ValidationError('Rating must be an integer between 1 and 5.');
      }

      // Check if product exists
      const prod = await db.query("SELECT id FROM products WHERE id = ?", [productId]);
      if (prod.length === 0) {
        throw new NotFoundError('Product not found.');
      }

      // Insert review
      await db.query(
        `INSERT INTO product_reviews (product_id, user_id, rating, title, comment, status) 
         VALUES (?, ?, ?, ?, ?, 'PENDING_MODERATION')`,
        [productId, userId, rate, title || null, comment || null]
      );

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully. It will be visible once approved.'
      });
    } catch (err) {
      next(err);
    }
  }

  async listApprovedReviews(req, res, next) {
    try {
      const productId = parseInt(req.params.id, 10);

      const rows = await db.query(
        `SELECT r.*, u.name as reviewer_name 
         FROM product_reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.product_id = ? AND r.status = 'APPROVED'
         ORDER BY r.id DESC`,
        [productId]
      );

      const formatted = rows.map(r => ({
        id: Number(r.id),
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        reviewerName: r.reviewer_name,
        createdAt: r.created_at
      }));

      // Calculate aggregate rating stats
      const statsRow = await db.query(
        `SELECT COUNT(*) as count, AVG(rating) as avgRating 
         FROM product_reviews 
         WHERE product_id = ? AND status = 'APPROVED'`,
        [productId]
      );

      res.status(200).json({
        success: true,
        data: {
          reviews: formatted,
          totalReviews: Number(statsRow[0]?.count || 0),
          averageRating: parseFloat(statsRow[0]?.avgRating || 0).toFixed(1)
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReviewController();
