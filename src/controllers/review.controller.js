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
  async getGoogleReviews(req, res, next) {
    try {
      const placeId = process.env.GOOGLE_PLACE_ID;
      const apiKey = process.env.GOOGLE_PLACES_API_KEY;

      if (!placeId || !apiKey) {
        // Fallback mock data if keys are not configured
        return res.status(200).json({
          success: true,
          data: {
            rating: 4.9,
            user_ratings_total: 128,
            reviews: [
              {
                author_name: "Sarah Jenkins",
                profile_photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop",
                rating: 5,
                text: "Absolutely stunning work! The flower preservation was perfect and brought tears to my eyes. Highly recommend!",
                time: Math.floor(Date.now() / 1000) - 86400 * 2
              },
              {
                author_name: "Michael Chen",
                profile_photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop",
                rating: 5,
                text: "I ordered a custom photo lamp for our anniversary and it exceeded all expectations. Beautiful craftsmanship.",
                time: Math.floor(Date.now() / 1000) - 86400 * 5
              },
              {
                author_name: "Priya Patel",
                profile_photo_url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=100&auto=format&fit=crop",
                rating: 4,
                text: "The gift hamper was gorgeous. Shipping took one day longer than expected, but the quality made up for it.",
                time: Math.floor(Date.now() / 1000) - 86400 * 12
              },
              {
                author_name: "Emily R.",
                profile_photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop",
                rating: 5,
                text: "Tannu is an artist! The resin art piece looks incredible in my living room. Will definitely buy again.",
                time: Math.floor(Date.now() / 1000) - 86400 * 20
              }
            ]
          }
        });
      }

      // Fetch from Google Places API
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch from Google API');
      }

      const data = await response.json();
      
      if (data.status !== 'OK') {
        throw new Error(data.error_message || 'Google API returned an error');
      }

      res.status(200).json({
        success: true,
        data: {
          rating: data.result.rating,
          user_ratings_total: data.result.user_ratings_total,
          reviews: data.result.reviews || []
        }
      });
    } catch (err) {
      console.error('Google Reviews Error:', err);
      // Fallback to empty state on error so frontend doesn't crash
      res.status(200).json({
        success: true,
        data: {
          rating: 0,
          user_ratings_total: 0,
          reviews: []
        }
      });
    }
  }
}

module.exports = new ReviewController();
