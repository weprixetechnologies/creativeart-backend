const db = require('../config/db');
const CartModel = require('../models/cart.model');
const ProductModel = require('../models/product.model');
const ProductVariantModel = require('../models/product-variant.model');
const ProductCustomFieldModel = require('../models/product-custom-field.model');
const { 
  NotFoundError, 
  ValidationError, 
  MixedCartNotAllowedError 
} = require('../utils/errors');

class CartService {
  async getCart({ userId = null, sessionId = null } = {}) {
    let cart = null;
    if (userId) {
      cart = await CartModel.findActiveByUserId(userId);
    } else if (sessionId) {
      cart = await CartModel.findActiveBySessionId(sessionId);
    }

    if (!cart) {
      return {
        id: null,
        userId: userId,
        sessionId: sessionId,
        cartItemType: null,
        items: []
      };
    }

    const items = await CartModel.getItems(cart.id);
    if (items.length === 0) {
      return {
        id: cart.id,
        userId: cart.user_id,
        sessionId: cart.session_id,
        cartItemType: cart.cart_item_type,
        items: []
      };
    }

    // Load custom values
    const itemIds = items.map(i => i.id);
    const customValues = await CartModel.getCustomValuesForItems(itemIds);

    // Group custom values by item_id
    const valuesByItemId = {};
    customValues.forEach(val => {
      const itemIdNum = Number(val.cart_item_id);
      if (!valuesByItemId[itemIdNum]) {
        valuesByItemId[itemIdNum] = {};
      }
      valuesByItemId[itemIdNum][val.field_key] = val.value;
    });

    const formattedItems = items.map(item => {
      const attrs = typeof item.variant_attributes === 'string' 
        ? JSON.parse(item.variant_attributes) 
        : item.variant_attributes;
      
      const itemIdNum = Number(item.id);
      return {
        id: itemIdNum,
        productId: Number(item.product_id),
        variantId: item.variant_id ? Number(item.variant_id) : null,
        qty: item.qty,
        unitPriceSnapshot: parseFloat(item.unit_price_snapshot),
        productName: item.product_name,
        productSlug: item.product_slug,
        itemType: item.item_type,
        productType: item.product_type,
        variantSku: item.variant_sku,
        variantAttributes: attrs || null,
        customFieldValues: valuesByItemId[itemIdNum] || {}
      };
    });

    return {
      id: cart.id,
      userId: cart.user_id,
      sessionId: cart.session_id,
      cartItemType: cart.cart_item_type,
      items: formattedItems
    };
  }

  async getOrCreateCart({ userId = null, sessionId = null } = {}) {
    let cart = null;
    if (userId) {
      cart = await CartModel.findActiveByUserId(userId);
    } else if (sessionId) {
      cart = await CartModel.findActiveBySessionId(sessionId);
    }

    if (!cart) {
      cart = await CartModel.create({ userId, sessionId });
    }
    return cart;
  }

  async addItem({ userId = null, sessionId = null, productId, variantId = null, qty = 1, customFieldValues = {} } = {}) {
    if (!userId && !sessionId) {
      throw new ValidationError('Either userId or sessionId is required to add an item to cart.');
    }

    // 1. Fetch and validate product
    const product = await ProductModel.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundError('Product not found or currently unavailable.');
    }

    // 2. Fetch or create cart
    const cart = await this.getOrCreateCart({ userId, sessionId });

    // 3. No-Mixing Validation
    if (cart.cart_item_type && cart.cart_item_type !== product.item_type) {
      throw new MixedCartNotAllowedError();
    }

    // 4. Validate variant selection if product is VARIABLE
    let unitPrice = product.base_price;
    let variant = null;

    if (product.item_type === 'PRODUCT' && product.product_type === 'VARIABLE') {
      if (!variantId) {
        throw new ValidationError('variantId is required for variable products.');
      }
      variant = await ProductVariantModel.findById(variantId);
      if (!variant || variant.product_id !== product.id || variant.status !== 'ACTIVE') {
        throw new NotFoundError('Selected product variant not found.');
      }
      if (variant.stock_qty < qty) {
        throw new ValidationError('Requested quantity exceeds available variant stock.');
      }
      unitPrice = variant.price_override !== null ? variant.price_override : product.base_price;
    } else {
      if (variantId) {
        throw new ValidationError('variantId is only allowed for variable products.');
      }
    }

    // 5. Validate custom fields if CUSTOMISABLE or PROJECT
    const customFields = await ProductCustomFieldModel.findByProductId(productId);
    const parsedCustomValues = [];

    for (const field of customFields) {
      const val = customFieldValues[field.field_key];
      const isPresent = val !== undefined && val !== null && String(val).trim() !== '';

      if (field.required && !isPresent) {
        throw new ValidationError(`Custom field "${field.label}" is required.`);
      }

      if (isPresent) {
        if (field.type === 'NUMBER' && isNaN(Number(val))) {
          throw new ValidationError(`Custom field "${field.label}" must be a valid number.`);
        }
        if (field.type === 'DATE' && isNaN(Date.parse(val))) {
          throw new ValidationError(`Custom field "${field.label}" must be a valid date.`);
        }
        if (field.type === 'DROPDOWN') {
          const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options;
          if (Array.isArray(opts) && !opts.includes(val)) {
            throw new ValidationError(`Custom field "${field.label}" must be one of allowed options.`);
          }
        }
        if (field.type === 'FILE' && (!val.startsWith('http://') && !val.startsWith('https://'))) {
          throw new ValidationError(`Custom field "${field.label}" must be a valid URL file path.`);
        }

        parsedCustomValues.push({
          customFieldId: field.id,
          value: String(val)
        });
      }
    }

    // 6. DB write transaction
    await db.transaction(async (conn) => {
      // Set cart item type if currently null
      if (!cart.cart_item_type) {
        await conn.query("UPDATE carts SET cart_item_type = ? WHERE id = ?", [product.item_type, cart.id]);
        cart.cart_item_type = product.item_type;
      }

      // Add item row
      const cartItemId = await CartModel.addItem(conn, {
        cartId: cart.id,
        productId,
        variantId,
        qty,
        unitPriceSnapshot: unitPrice
      });

      // Save custom values
      if (parsedCustomValues.length > 0) {
        await CartModel.addCustomValues(conn, cartItemId, parsedCustomValues);
      }
    });

    return this.getCart({ userId, sessionId });
  }

  async updateItemQty({ userId = null, sessionId = null, cartItemId, qty } = {}) {
    if (qty <= 0) {
      return this.removeItem({ userId, sessionId, cartItemId });
    }

    const cart = await this.getCart({ userId, sessionId });
    if (!cart.id) {
      throw new NotFoundError('Active cart not found.');
    }

    const item = cart.items.find(i => i.id === cartItemId);
    if (!item) {
      throw new NotFoundError('Cart item not found.');
    }

    // If variant is set, check stock limits
    if (item.variantId) {
      const variant = await ProductVariantModel.findById(item.variantId);
      if (variant && variant.stock_qty < qty) {
        throw new ValidationError('Requested quantity exceeds available stock.');
      }
    }

    await CartModel.updateItemQty(cartItemId, qty);
    return this.getCart({ userId, sessionId });
  }

  async removeItem({ userId = null, sessionId = null, cartItemId } = {}) {
    const cart = await this.getCart({ userId, sessionId });
    if (!cart.id) {
      throw new NotFoundError('Active cart not found.');
    }

    const item = cart.items.find(i => i.id === cartItemId);
    if (!item) {
      throw new NotFoundError('Cart item not found.');
    }

    await db.transaction(async (conn) => {
      // Custom values are deleted automatically due to ON DELETE CASCADE on fk_cicv_cart_item_id
      await CartModel.removeItem(conn, cartItemId);

      // Check if any items remain in the cart
      const remaining = await conn.query("SELECT COUNT(*) as count FROM cart_items WHERE cart_id = ?", [cart.id]);
      if (parseInt(remaining[0].count, 10) === 0) {
        await conn.query("UPDATE carts SET cart_item_type = NULL WHERE id = ?", [cart.id]);
      }
    });

    return this.getCart({ userId, sessionId });
  }

  async mergeCarts(userId, sessionId) {
    if (!userId || !sessionId) return;

    const userCart = await CartModel.findActiveByUserId(userId);
    const guestCart = await CartModel.findActiveBySessionId(sessionId);

    if (!guestCart) return;

    const guestItems = await CartModel.getItems(guestCart.id);
    if (guestItems.length === 0) {
      await db.query("UPDATE carts SET status = 'ABANDONED' WHERE id = ?", [guestCart.id]);
      return;
    }

    if (!userCart) {
      // If user has no active cart, convert guest cart directly to user's cart
      await db.query(
        "UPDATE carts SET user_id = ?, session_id = NULL WHERE id = ?",
        [userId, guestCart.id]
      );
      return;
    }

    // If user has an active cart, check no-mixing rule
    if (userCart.cart_item_type && guestCart.cart_item_type && userCart.cart_item_type !== guestCart.cart_item_type) {
      // Conflict: Discard guest cart to preserve user's database cart integrity
      await db.query("UPDATE carts SET status = 'ABANDONED' WHERE id = ?", [guestCart.id]);
      return;
    }

    // Merge items
    await db.transaction(async (conn) => {
      // If user cart item type was null, take guest cart's type
      if (!userCart.cart_item_type && guestCart.cart_item_type) {
        await conn.query("UPDATE carts SET cart_item_type = ? WHERE id = ?", [guestCart.cart_item_type, userCart.id]);
      }

      for (const guestItem of guestItems) {
        // Find if identical item already exists in user cart
        // Fetch all user items to compare
        const userItems = await CartModel.getItems(userCart.id);
        const duplicate = userItems.find(ui => ui.product_id === guestItem.product_id && ui.variant_id === guestItem.variant_id);

        if (duplicate) {
          // Increment quantity
          await conn.query("UPDATE cart_items SET qty = qty + ? WHERE id = ?", [guestItem.qty, duplicate.id]);
          await conn.query("DELETE FROM cart_items WHERE id = ?", [guestItem.id]);
        } else {
          // Move item to user cart
          await conn.query("UPDATE cart_items SET cart_id = ? WHERE id = ?", [userCart.id, guestItem.id]);
        }
      }

      // Deactivate/abandon guest cart
      await conn.query("UPDATE carts SET status = 'ABANDONED' WHERE id = ?", [guestCart.id]);
    });
  }
}

module.exports = new CartService();
