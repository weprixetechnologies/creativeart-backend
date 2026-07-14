'use strict';

const db = require('../config/db');
const eventEmitter = require('../utils/event-emitter');

class AffiliateService {
  constructor() {
    // Listen for order status changes to drive the commission lifecycle
    eventEmitter.on('orderStatusChanged', this.handleOrderStatusChange.bind(this));
  }

  async handleOrderStatusChange({ orderId, fromStatus, toStatus }) {
    try {
      // 1. Fetch the order details
      const orders = await db.query(
        'SELECT id, affiliate_id, referral_code_used, subtotal, discount_amount, order_type FROM orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) return;
      const order = orders[0];

      // If the order was not referred by an affiliate, there's nothing to do
      if (!order.affiliate_id) return;

      const isPaymentSuccess = toStatus === 'PAID' || toStatus === 'FINAL_PAID' || toStatus === 'ADVANCE_PAID';
      const isConfirmed = toStatus === 'DELIVERED';
      const isCancelled = ['RTO', 'EXCEPTION', 'CANCELLED'].includes(toStatus);

      if (isPaymentSuccess) {
        await this.createPendingCommission(order);
      } else if (isConfirmed) {
        await this.confirmCommission(order.id);
      } else if (isCancelled) {
        await this.cancelCommission(order.id);
      }
    } catch (err) {
      console.error(`[AffiliateService] Error handling status change for order #${orderId}:`, err);
    }
  }

  async createPendingCommission(order) {
    // Check if a commission record already exists for this order (idempotency/defense-in-depth)
    const existing = await db.query(
      'SELECT id FROM affiliate_commissions WHERE order_id = ?',
      [order.id]
    );
    if (existing.length > 0) {
      return; // Already created, skip silently
    }

    // 1. Fetch primary product info for overrides
    const orderItems = await db.query(
      `SELECT oi.product_id, p.commission_type_override, p.commission_value_override 
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?
       LIMIT 1`,
      [order.id]
    );

    let commissionType = null;
    let commissionValue = null;

    if (orderItems.length > 0) {
      commissionType = orderItems[0].commission_type_override;
      commissionValue = orderItems[0].commission_value_override ? parseFloat(orderItems[0].commission_value_override) : null;
    }

    // 2. Load global defaults if overrides aren't set
    if (!commissionType || commissionValue === null) {
      const globalTypeSetting = await db.query(
        "SELECT value FROM settings WHERE `key` = 'affiliate_default_commission_type' LIMIT 1"
      );
      const globalValueSetting = await db.query(
        "SELECT value FROM settings WHERE `key` = 'affiliate_default_commission_value' LIMIT 1"
      );

      if (!commissionType) {
        commissionType = globalTypeSetting.length > 0 ? globalTypeSetting[0].value : 'PERCENTAGE';
      }
      if (commissionValue === null) {
        commissionValue = globalValueSetting.length > 0 ? parseFloat(globalValueSetting[0].value) : 10.00;
      }
    }

    const baseAmount = parseFloat(order.subtotal) - parseFloat(order.discount_amount);
    let commissionAmount = 0.00;

    if (commissionType === 'PERCENTAGE') {
      commissionAmount = Math.round((baseAmount * commissionValue / 100.0) * 100) / 100;
    } else {
      commissionAmount = commissionValue;
    }

    // Get referral ID
    const referrals = await db.query(
      'SELECT id FROM affiliate_referrals WHERE order_id = ? LIMIT 1',
      [order.id]
    );

    let referralId = null;
    if (referrals.length > 0) {
      referralId = referrals[0].id;
    } else {
      // Create a fallback referral row if not present
      const res = await db.query(
        'INSERT INTO affiliate_referrals (affiliate_id, order_id, referral_code_used) VALUES (?, ?, ?)',
        [order.affiliate_id, order.id, order.referral_code_used || '']
      );
      referralId = res.insertId;
    }

    try {
      await db.query(
        `INSERT INTO affiliate_commissions 
         (affiliate_id, order_id, referral_id, base_amount, commission_type, commission_value, commission_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
        [order.affiliate_id, order.id, referralId, baseAmount, commissionType, commissionValue, commissionAmount]
      );

      // Enqueue notification via BullMQ/Queue pattern
      try {
        const localQueue = require('../utils/queue');
        localQueue.add('notification', { orderId: order.id, event: 'AFFILIATE_COMMISSION_RECEIVED' });
      } catch (queueErr) {
        console.error('[AffiliateService] Failed to enqueue notification:', queueErr);
      }
    } catch (err) {
      // Handle UNIQUE duplicate entries gracefully (ER_DUP_ENTRY / code 1062 / sqlState 23000)
      if (err.errno === 1062 || err.code === 'ER_DUP_ENTRY') {
        console.log(`[AffiliateService] Commission already exists for order #${order.id} (caught unique constraint).`);
        return;
      }
      throw err;
    }
  }

  async confirmCommission(orderId) {
    const conn = await db.pool.getConnection();
    try {
      await conn.beginTransaction();

      const commissions = await conn.query(
        "SELECT id, status, affiliate_id FROM affiliate_commissions WHERE order_id = ? FOR UPDATE",
        [orderId]
      );

      if (commissions.length > 0 && commissions[0].status === 'PENDING') {
        await conn.query(
          "UPDATE affiliate_commissions SET status = 'CONFIRMED', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?",
          [commissions[0].id]
        );

        // Enqueue notification
        try {
          const localQueue = require('../utils/queue');
          localQueue.add('notification', { orderId, event: 'AFFILIATE_COMMISSION_CONFIRMED' });
        } catch (queueErr) {
          console.error('[AffiliateService] Failed to enqueue notification:', queueErr);
        }
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async cancelCommission(orderId) {
    const conn = await db.pool.getConnection();
    try {
      await conn.beginTransaction();

      const commissions = await conn.query(
        "SELECT id, status FROM affiliate_commissions WHERE order_id = ? FOR UPDATE",
        [orderId]
      );

      if (commissions.length > 0 && (commissions[0].status === 'PENDING' || commissions[0].status === 'CONFIRMED')) {
        await conn.query(
          "UPDATE affiliate_commissions SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?",
          [commissions[0].id]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new AffiliateService();
