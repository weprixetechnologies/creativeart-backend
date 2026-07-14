const db = require('../config/db');
const CartService = require('./cart.service');
const CouponService = require('./coupon.service');
const OrderModel = require('../models/order.model');
const ProductModel = require('../models/product.model');
const ProductVariantModel = require('../models/product-variant.model');
const ProductCustomFieldModel = require('../models/product-custom-field.model');
const PaymentService = require('./payment.service');
const { v4: uuidv4 } = require('uuid');
const { ValidationError, NotFoundError } = require('../utils/errors');

class CheckoutService {
  // ── STANDARD CHECKOUT (PRODUCT items from localStorage cart) ─────────────────
  async checkoutStandard({ userId, addressId, couponCode = null, items = [], paymentMethod = 'PREPAID', referralCode = null } = {}) {
    if (!userId) {
      throw new ValidationError('Authentication is required to checkout.');
    }
    if (!items || items.length === 0) {
      throw new ValidationError('Your cart is empty. Cannot checkout.');
    }

    // 1. Resolve referral details if referralCode is supplied
    let affiliateId = null;
    let referralCodeUsed = null;
    if (referralCode && referralCode.trim() !== '') {
      try {
        const affiliates = await db.query(
          "SELECT id, user_id FROM affiliates WHERE referral_code = ? AND status = 'APPROVED' LIMIT 1",
          [referralCode.trim()]
        );
        if (affiliates.length > 0) {
          const affiliate = affiliates[0];
          if (Number(affiliate.user_id) === Number(userId)) {
            console.info(`[CheckoutService] Self-referral blocked: user #${userId} tried to use referral code "${referralCode}"`);
          } else {
            affiliateId = affiliate.id;
            referralCodeUsed = referralCode.trim();
          }
        }
      } catch (err) {
        console.error(`[CheckoutService] Error looking up referral code "${referralCode}":`, err.message);
      }
    }

    // Normalize incoming items array to match internal cart item structure
    const normalizedItems = items.map(item => ({
      productId: Number(item.productId),
      variantId: item.variantId ? Number(item.variantId) : null,
      productName: item.name || item.productName || 'Product',
      qty: Number(item.quantity || item.qty || 1),
      unitPriceSnapshot: parseFloat(item.price || item.unitPriceSnapshot || 0),
      customFieldValues: item.customFieldValues || {}
    }));

    // 2. Verify shipping address
    const address = await OrderModel.findAddressById(userId, addressId);
    if (!address) {
      throw new ValidationError('Selected shipping address not found in your address book.');
    }

    // 3. Stock checks for variable items
    for (const item of normalizedItems) {
      if (item.variantId) {
        const variant = await ProductVariantModel.findById(item.variantId);
        if (!variant || variant.status !== 'ACTIVE') {
          throw new NotFoundError(`Selected variant for product "${item.productName}" is not available.`);
        }
        if (variant.stock_qty < item.qty) {
          throw new ValidationError(`Insufficient stock for product variant "${variant.sku}".`);
        }
      }
    }

    // 4. Calculate pricing subtotals
    const subtotal = normalizedItems.reduce((acc, item) => {
      return acc + (item.unitPriceSnapshot * item.qty);
    }, 0);

    // 5. Coupon validation
    let discountAmount = 0.00;
    let couponId = null;

    if (couponCode && couponCode.trim() !== '') {
      const couponResult = await CouponService.validateCoupon({
        code: couponCode,
        userId,
        subtotal
      });
      discountAmount = couponResult.discountAmount;
      couponId = couponResult.id;
    }

    const taxAmount = 0.00;
    const shippingAmount = 0.00;
    const totalAmount = Math.max(0, subtotal - discountAmount + taxAmount + shippingAmount);

    // Generate Order Number: ORD-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randomStr}`;

    let orderId = null;
    const isCod = paymentMethod === 'COD';
    const gatewayOrderId = isCod 
      ? 'cod_order_' + Math.random().toString(36).substring(2, 15) 
      : uuidv4();
    const gatewayPaymentId = gatewayOrderId;

    // 6. DB Transactional commit
    await db.transaction(async (conn) => {
      const initialStatus = 'PLACED';
      
      // Create main order row
      orderId = await OrderModel.createOrder(conn, {
        orderNumber,
        userId,
        orderType: 'STANDARD',
        status: initialStatus,
        addressId,
        couponId,
        subtotal,
        discountAmount,
        taxAmount,
        shippingAmount,
        totalAmount,
        affiliateId,
        referralCodeUsed
      });

      // Write affiliate referrals trace if referred
      if (affiliateId) {
        await conn.query(
          `INSERT INTO affiliate_referrals (affiliate_id, order_id, referral_code_used) 
           VALUES (?, ?, ?)`,
          [affiliateId, orderId, referralCodeUsed]
        );
      }

      // Create items and decrement stocks
      for (const item of normalizedItems) {
        const orderItemId = await OrderModel.createOrderItem(conn, {
          orderId,
          productId: item.productId,
          variantId: item.variantId,
          productNameSnapshot: item.productName,
          qty: item.qty,
          unitPrice: item.unitPriceSnapshot,
          lineTotal: item.qty * item.unitPriceSnapshot
        });

        // Save customized choices snapshot
        const customFields = await ProductCustomFieldModel.findByProductId(item.productId);
        for (const [key, val] of Object.entries(item.customFieldValues || {})) {
          const fieldDef = customFields.find(cf => cf.field_key === key);
          if (fieldDef) {
            await OrderModel.createOrderItemCustomValue(conn, {
              orderItemId,
              customFieldId: fieldDef.id,
              fieldLabelSnapshot: fieldDef.label,
              value: String(val)
            });
          }
        }

        // Decrement variant stock
        if (item.variantId) {
          await conn.query(
            "UPDATE product_variants SET stock_qty = stock_qty - ? WHERE id = ?",
            [item.qty, item.variantId]
          );
        }
      }

      // Record coupon usage
      if (couponId) {
        await conn.query(
          "INSERT INTO coupon_usages (coupon_id, user_id, order_id) VALUES (?, ?, ?)",
          [couponId, userId, orderId]
        );
      }

      // Create initial payment intent record
      const gateway = isCod ? 'COD' : 'PHONEPE';
      const paymentStatus = isCod ? 'PENDING' : 'CREATED';
      
      await conn.query(
        `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, gateway_payment_id, amount, status)
         VALUES (?, 'FULL', ?, ?, ?, ?, ?)`,
        [orderId, gateway, gatewayOrderId, gatewayPaymentId, totalAmount, paymentStatus]
      );

      // Write status history audit
      await OrderModel.writeStatusHistory(conn, {
        orderId,
        fromStatus: null,
        toStatus: initialStatus,
        actorType: 'SYSTEM',
        actorUserId: userId,
        note: isCod 
          ? 'Checkout standard order created with COD'
          : 'Checkout standard order created pending PhonePe payment confirmation'
      });

      // Update cart to CONVERTED (safe query for active user session if exists in DB)
      try {
        await conn.query(
          "UPDATE carts SET status = 'CONVERTED' WHERE user_id = ? AND status = 'ACTIVE'",
          [userId]
        );
      } catch (err) {}
    });

    if (isCod) {
      return {
        orderId: Number(orderId),
        orderNumber,
        totalAmount,
        paymentMethod
      };
    }

    // Prepaid: Call PhonePe pay API
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendBase}/order-confirmation?orderId=${orderId}`;
    const initiateRes = await PaymentService.initiatePayment({
      merchantOrderId: gatewayOrderId,
      amount: totalAmount,
      redirectUrl,
      description: `Payment for standard order ${orderNumber}`
    });

    return {
      orderId: Number(orderId),
      orderNumber,
      totalAmount,
      paymentMethod,
      checkoutUrl: initiateRes.redirectUrl
    };
  }

  // ── DUAL-PAYMENT CHECKOUT (PROJECT items — bypasses cart entirely) ────────────
  // productId and customFieldValues come directly from sessionStorage (set by PDP).
  // The cart is NOT involved in this flow at all.
  async checkoutDualPayment({ userId, productId, addressId, selectedOfficeAddressId, materialShipmentMode = 'SELF_SHIP', courierName = null, trackingNumber = null, customFieldValues = {}, referralCode = null } = {}) {
    if (!userId) {
      throw new ValidationError('Authentication is required to checkout.');
    }
    if (!productId) {
      throw new ValidationError('A project product must be specified for booking.');
    }

    // 1. Resolve referral details if referralCode is supplied
    let affiliateId = null;
    let referralCodeUsed = null;
    if (referralCode && referralCode.trim() !== '') {
      try {
        const affiliates = await db.query(
          "SELECT id, user_id FROM affiliates WHERE referral_code = ? AND status = 'APPROVED' LIMIT 1",
          [referralCode.trim()]
        );
        if (affiliates.length > 0) {
          const affiliate = affiliates[0];
          if (Number(affiliate.user_id) === Number(userId)) {
            console.info(`[CheckoutService] Self-referral blocked: user #${userId} tried to use referral code "${referralCode}"`);
          } else {
            affiliateId = affiliate.id;
            referralCodeUsed = referralCode.trim();
          }
        }
      } catch (err) {
        console.error(`[CheckoutService] Error looking up referral code "${referralCode}":`, err.message);
      }
    }

    // 1. Fetch and validate the project product directly
    const product = await ProductModel.findById(productId);
    if (!product || product.status !== 'ACTIVE') {
      throw new NotFoundError('Project not found or is no longer active.');
    }
    if (product.item_type !== 'PROJECT') {
      throw new ValidationError('Dual-payment checkout is only for custom preservation projects.');
    }

    // 2. Verify shipping address
    const address = await OrderModel.findAddressById(userId, addressId);
    if (!address) {
      throw new ValidationError('Selected shipping address not found in your address book.');
    }

    // 3. Office intake hub is optional
    if (selectedOfficeAddressId) {
      const officeAddress = await OrderModel.findOfficeAddressById(selectedOfficeAddressId);
      if (!officeAddress) {
        throw new ValidationError('Selected intake hub is invalid or inactive.');
      }
    }

    // 4. Snapshot pricing from the project product definition
    const subtotal      = parseFloat(product.total_amount);
    const advanceAmount = parseFloat(product.advance_amount);
    const finalAmount   = parseFloat(product.final_amount);
    const totalAmount   = parseFloat(product.total_amount);

    // Generate Order Number: ORD-YYYYMMDD-XXXX
    const dateStr     = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr   = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${dateStr}-${randomStr}`;

    let orderId = null;
    const gatewayOrderId = uuidv4();
    const gatewayPaymentId = gatewayOrderId;

    const initialStatus = 'BOOKED_PENDING_ADVANCE';
    const auditNote = 'Project preservation booking created pending advance deposit payment confirmation';

    // 5. DB Transactional commit
    await db.transaction(async (conn) => {
      // Create main order row
      orderId = await OrderModel.createOrder(conn, {
        orderNumber,
        userId,
        orderType: 'DUAL_PAYMENT',
        status: initialStatus,
        addressId,
        selectedOfficeAddressId: selectedOfficeAddressId || null,
        couponId: null,
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        shippingAmount: 0,
        totalAmount,
        advanceAmount,
        finalAmount,
        affiliateId,
        referralCodeUsed
      });

      // Write affiliate referrals trace if referred
      if (affiliateId) {
        await conn.query(
          `INSERT INTO affiliate_referrals (affiliate_id, order_id, referral_code_used) 
           VALUES (?, ?, ?)`,
          [affiliateId, orderId, referralCodeUsed]
        );
      }

      const orderItemId = await OrderModel.createOrderItem(conn, {
        orderId,
        productId: product.id,
        variantId: null,
        productNameSnapshot: product.name,
        qty: 1,
        unitPrice: totalAmount,
        lineTotal: totalAmount
      });

      // Save custom field value snapshots
      if (customFieldValues && Object.keys(customFieldValues).length > 0) {
        const customFields = await ProductCustomFieldModel.findByProductId(product.id);
        for (const [key, val] of Object.entries(customFieldValues)) {
          if (!val) continue;
          const fieldDef = customFields.find(cf => cf.field_key === key);
          if (fieldDef) {
            await OrderModel.createOrderItemCustomValue(conn, {
              orderItemId,
              customFieldId: fieldDef.id,
              fieldLabelSnapshot: fieldDef.label,
              value: String(val)
            });
          }
        }
      }

      // If user provided courier tracking details now, record them
      if (materialShipmentMode === 'SELF_SHIP' && courierName && courierName.trim() && trackingNumber && trackingNumber.trim()) {
        const activeOffices = await conn.query(
          "SELECT id FROM office_addresses WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1"
        );
        const officeAddrId = activeOffices.length > 0 ? activeOffices[0].id : null;
        if (officeAddrId) {
          await conn.query(
            `INSERT INTO material_shipments 
             (order_id, office_address_id, courier_name, tracking_number, shipped_at) 
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [orderId, officeAddrId, courierName.trim(), trackingNumber.trim()]
          );
        }
      }

      // Create initial payment intent record
      await conn.query(
        `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, gateway_payment_id, amount, status)
         VALUES (?, 'ADVANCE', 'PHONEPE', ?, ?, ?, 'CREATED')`,
        [orderId, gatewayOrderId, gatewayPaymentId, advanceAmount]
      );

      // Write audit trail
      await OrderModel.writeStatusHistory(conn, {
        orderId,
        fromStatus: null,
        toStatus: initialStatus,
        actorType: 'SYSTEM',
        actorUserId: userId,
        note: auditNote
      });
      // NOTE: No cart to update — this flow is entirely cart-independent.
    });

    // Initiate payment on PhonePe
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendBase}/order-confirmation?orderId=${orderId}`;
    const initiateRes = await PaymentService.initiatePayment({
      merchantOrderId: gatewayOrderId,
      amount: advanceAmount,
      redirectUrl,
      description: `Advance deposit for preservation project order ${orderNumber}`
    });

    return {
      orderId: Number(orderId),
      orderNumber,
      totalAmount,
      advanceAmount,
      checkoutUrl: initiateRes.redirectUrl
    };
  }
}

module.exports = new CheckoutService();
