const db = require('../../config/db');
const { ValidationError, NotFoundError } = require('../../utils/errors');

class AdminReviewController {
  async listAllReviews(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT r.*, p.name as product_name, u.name as reviewer_name, u.email as reviewer_email
         FROM product_reviews r
         JOIN products p ON r.product_id = p.id
         JOIN users u ON r.user_id = u.id
         ORDER BY r.id DESC`
      );

      const formatted = rows.map(r => ({
        id: Number(r.id),
        productId: Number(r.product_id),
        productName: r.product_name,
        reviewerName: r.reviewer_name,
        reviewerEmail: r.reviewer_email,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        status: r.status,
        createdAt: r.created_at
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async updateReviewStatus(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;

      if (!['APPROVED', 'REJECTED', 'PENDING_MODERATION'].includes(status)) {
        throw new ValidationError('Invalid review status.');
      }

      // Check existence
      const review = await db.query("SELECT id FROM product_reviews WHERE id = ?", [id]);
      if (review.length === 0) {
        throw new NotFoundError('Review not found.');
      }

      await db.query("UPDATE product_reviews SET status = ? WHERE id = ?", [status, id]);

      res.status(200).json({ success: true, message: `Review status updated to ${status}.` });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminReviewController();
