'use strict';

const { renderHtml } = require('../templates/renderer');

const FRONTEND = process.env.FRONTEND_URL || 'https://thecreativeart.shop';

const SUBJECTS = {
  ORDER_PLACED: (v) => `🎉 Order Confirmed — ${v.orderNumber}`,
  ORDER_PAID: (v) => `✅ Payment Received — ${v.orderNumber}`,
  PACKED: (v) => `📦 Order Packed — ${v.orderNumber}`,
  SHIPPED: (v) => `🚚 Your Order Is On Its Way! — ${v.orderNumber}`,
  DELIVERED: (v) => `🎁 Your Order Has Arrived — ${v.orderNumber}`,
  CANCELLED: (v) => `❌ Order Cancelled — ${v.orderNumber}`,
  ADVANCE_PAID: (v) => `💛 Advance Received — Project Begins! — ${v.orderNumber}`,
  AWAITING_MATERIAL_DISPATCH: (v) => `📬 Awaiting Your Materials — ${v.orderNumber}`,
  MATERIAL_IN_TRANSIT: (v) => `🔄 Materials In Transit — ${v.orderNumber}`,
  MATERIAL_RECEIVED: (v) => `📥 Materials Received — Production Starts Soon — ${v.orderNumber}`,
  IN_PRODUCTION: (v) => `🛠️ Your Order Is In Production — ${v.orderNumber}`,
  READY_PENDING_FINAL_PAYMENT: (v) => `🌟 Your Creation Is Ready — Final Payment Due — ${v.orderNumber}`,
  FINAL_PAID: (v) => `✨ Final Payment Received — Shipping Soon! — ${v.orderNumber}`,
  AFFILIATE_APPLICATION_RECEIVED: (v) => `📢 New Affiliate Application Received`,
  AFFILIATE_APPROVED: (v) => `🎉 Affiliate Application Approved!`,
  AFFILIATE_REJECTED: (v) => `❌ Update on Affiliate Application`,
  AFFILIATE_COMMISSION_RECEIVED: (v) => `💰 New Pending Commission Received!`,
  AFFILIATE_COMMISSION_CONFIRMED: (v) => `💰 Commission Confirmed!`,
  AFFILIATE_PAYOUT_PROCESSED: (v) => `💸 Payout Processed Successfully`
};

/**
 * Get the email template for a given event key, with variables resolved from coded templates folder.
 * @param {string} eventKey - e.g. 'ORDER_PLACED'
 * @param {object} vars - resolved variable map (orderNumber, customerName, etc.)
 * @returns {{ subject: string, html: string } | null}
 */
function getEmailTemplate(eventKey, vars) {
  const subjectFn = SUBJECTS[eventKey];
  if (!subjectFn) return null;

  try {
    const templateVars = {
      ...vars,
      frontendUrl: FRONTEND
    };
    const html = renderHtml(eventKey, templateVars);
    return {
      subject: subjectFn(vars),
      html
    };
  } catch (err) {
    console.error(`[email-templates] Error loading/rendering template ${eventKey}:`, err.message);
    return null;
  }
}

module.exports = { getEmailTemplate };
