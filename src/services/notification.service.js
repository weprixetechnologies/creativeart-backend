'use strict';

const db           = require('../config/db');
const EmailService = require('./email.service');
const { getEmailTemplate } = require('./email-templates');

class NotificationService {
  /**
   * Send all applicable notifications for a given event.
   *
   * @param {number} orderId     - The database order ID (or 0 for non-order events)
   * @param {string} templateKey - Event key, e.g. 'ORDER_PLACED', 'AFFILIATE_APPROVED'
   * @param {object} customData  - Optional extra variables for template rendering
   */
  async sendNotification(orderId, templateKey, customData = {}) {
    console.log(`[NotificationService] Preparing "${templateKey}" for Event…`);

    // ── 1. Fetch the DB template ─────────────────────────────────────────────
    const templates = await db.query(
      'SELECT * FROM notification_templates WHERE template_key = ?',
      [templateKey]
    );

    if (templates.length === 0) {
      console.warn(`[NotificationService] No template found for key: "${templateKey}" — skipping.`);
      return;
    }

    const template = templates[0];

    // ── 2. Determine recipient and build variable map ────────────────────────
    let recipientEmail = '';
    let recipientPhone = '';
    let vars = { ...customData };

    const isAffiliateEvent = templateKey.startsWith('AFFILIATE_');

    if (isAffiliateEvent) {
      if (templateKey === 'AFFILIATE_APPLICATION_RECEIVED') {
        // Recipient is the store Admin
        const admins = await db.query("SELECT email, phone FROM users WHERE role = 'ADMIN' LIMIT 1");
        recipientEmail = admins.length > 0 ? admins[0].email : 'admin@creativeart.in';
        recipientPhone = admins.length > 0 ? admins[0].phone : '9999999999';
        vars.customerName = 'Admin';
      } else {
        // Recipient is the affiliate user
        let affiliateId = customData.affiliateId;
        
        // If not directly provided, check if we can get it from the order
        if (!affiliateId && orderId && Number(orderId) > 0) {
          const orders = await db.query("SELECT affiliate_id FROM orders WHERE id = ?", [orderId]);
          if (orders.length > 0) {
            affiliateId = orders[0].affiliate_id;
          }
        }

        if (affiliateId) {
          const affs = await db.query(
            `SELECT u.name, u.email, u.phone, a.referral_code 
             FROM affiliates a 
             JOIN users u ON a.user_id = u.id 
             WHERE a.id = ?`,
            [affiliateId]
          );
          if (affs.length > 0) {
            recipientEmail = affs[0].email;
            recipientPhone = affs[0].phone;
            vars.customerName = affs[0].name;
            vars.referralCode = affs[0].referral_code;
          }
        }

        // If order details are relevant
        if (orderId && Number(orderId) > 0) {
          const orders = await db.query("SELECT order_number, subtotal, discount_amount FROM orders WHERE id = ?", [orderId]);
          if (orders.length > 0) {
            vars.orderNumber = orders[0].order_number;
            vars.totalAmount = parseFloat(orders[0].subtotal) - parseFloat(orders[0].discount_amount);
          }
          const comms = await db.query("SELECT commission_amount FROM affiliate_commissions WHERE order_id = ?", [orderId]);
          if (comms.length > 0) {
            vars.commissionAmount = parseFloat(comms[0].commission_amount);
          }
        }
      }
    } else {
      // Standard order flow
      const orders = await db.query(
        `SELECT o.*, u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
         FROM orders o
         JOIN users u ON o.user_id = u.id
         WHERE o.id = ?`,
        [orderId]
      );

      if (orders.length === 0) {
        console.warn(`[NotificationService] Order #${orderId} not found — skipping.`);
        return;
      }

      const order = orders[0];

      const shipments = await db.query(
        'SELECT courier_name, awb_code FROM shipments WHERE order_id = ? ORDER BY id DESC LIMIT 1',
        [orderId]
      );

      recipientEmail = order.customer_email;
      recipientPhone = order.customer_phone;

      vars = {
        orderNumber:   order.order_number,
        customerName:  order.customer_name  || 'Valued Customer',
        totalAmount:   order.total_amount,
        advanceAmount: order.advance_amount,
        finalAmount:   order.final_amount,
        courierName:   shipments[0]?.courier_name || '',
        awbCode:       shipments[0]?.awb_code     || '',
        ...customData,
      };
    }

    // ── 3. Mustache-style renderer (for SMS / DB body) ───────────────────────
    const render = (str) => {
      if (!str) return '';
      return str.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        vars[key] !== undefined ? vars[key] : `{{${key}}}`
      );
    };

    // ── 4. Process each channel ───────────────────────────────────────────────
    const channels = template.channels.split(',').map((c) => c.trim().toUpperCase());

    for (const channel of channels) {
      let recipient    = '';
      let status       = 'SENT';
      let errorMessage = null;

      try {
        if (channel === 'EMAIL') {
          recipient = recipientEmail || '';

          if (!recipient) {
            console.warn(`[NotificationService] Event "${templateKey}" has no recipient email — skipping EMAIL.`);
            continue;
          }

          // Try the rich HTML template first, fall back to DB template body
          const emailTpl = getEmailTemplate(templateKey, vars);

          if (emailTpl) {
            await EmailService.sendEmail({
              to:      recipient,
              subject: emailTpl.subject,
              html:    emailTpl.html,
            });
          } else {
            const subject = render(template.subject_template) || `Update from CreativeArt`;
            const bodyTxt = render(template.body_template);
            await EmailService.sendEmail({
              to:      recipient,
              subject,
              html:    `<p class="greeting">${subject}</p><p class="intro">${bodyTxt.replace(/\n/g, '<br/>')}</p>`,
              text:    bodyTxt,
            });
          }

          console.log(`[NotificationService] EMAIL → ${recipient} (${templateKey}) ✓`);

        } else if (channel === 'SMS') {
          recipient    = recipientPhone || '';
          const smsBody = render(template.body_template);
          console.log(`[NotificationService] MOCK SMS → ${recipient} | ${smsBody}`);

        } else {
          console.warn(`[NotificationService] Unknown channel "${channel}" — skipping.`);
          continue;
        }

      } catch (err) {
        status       = 'FAILED';
        errorMessage = err.message || String(err);
        console.error(`[NotificationService] ${channel} FAILED for event "${templateKey}":`, err.message);
      }

      // ── 5. Log dispatch attempt ───────────────────────────────────────────
      try {
        await db.query(
          `INSERT INTO notification_logs (order_id, recipient, channel, status, error_message)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId || 0, recipient, channel, status, errorMessage]
        );
      } catch (logErr) {
        console.error('[NotificationService] Failed to write notification log:', logErr.message);
      }
    }
  }
}

module.exports = new NotificationService();
