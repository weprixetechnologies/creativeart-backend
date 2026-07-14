const CartService = require('../services/cart.service');

class CartController {
  async getCart(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || null;

      // Merge guest cart if both identifiers are present (FR-7)
      if (userId && sessionId) {
        await CartService.mergeCarts(userId, sessionId);
      }

      const cart = await CartService.getCart({ userId, sessionId });
      res.status(200).json({
        success: true,
        data: cart
      });
    } catch (err) {
      next(err);
    }
  }

  async addItem(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || null;
      const { productId, variantId, qty, customFieldValues } = req.body;

      const cart = await CartService.addItem({
        userId,
        sessionId,
        productId,
        variantId,
        qty,
        customFieldValues
      });

      res.status(200).json({
        success: true,
        data: cart
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQty(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || null;
      const cartItemId = parseInt(req.params.id, 10);
      const { qty } = req.body;

      const cart = await CartService.updateItemQty({
        userId,
        sessionId,
        cartItemId,
        qty
      });

      res.status(200).json({
        success: true,
        data: cart
      });
    } catch (err) {
      next(err);
    }
  }

  async removeItem(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || null;
      const cartItemId = parseInt(req.params.id, 10);

      const cart = await CartService.removeItem({
        userId,
        sessionId,
        cartItemId
      });

      res.status(200).json({
        success: true,
        data: cart
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CartController();
