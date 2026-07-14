'use strict';

/**
 * seed-notification-templates.js
 *
 * Inserts/updates all default notification templates into the DB.
 * Run with: node scratch/seed-notification-templates.js
 *
 * Uses UPSERT so it is safe to run multiple times.
 */

require('dotenv').config();
const db = require('../src/config/db');

const templates = [
  // ── Standard Order Flow ────────────────────────────────────────────────────
  {
    templateKey:     'ORDER_PLACED',
    channels:        'EMAIL',
    subjectTemplate: '🎉 Order Confirmed — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nThank you for your order ({{orderNumber}})! We've received it and will begin processing shortly. Total: ₹{{totalAmount}}\n\nYou'll receive updates at every step.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'ORDER_PAID',
    channels:        'EMAIL',
    subjectTemplate: '✅ Payment Received — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nWe've received your payment for order {{orderNumber}}. Our team is now preparing your order.\n\nTotal Paid: ₹{{totalAmount}}\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'PACKED',
    channels:        'EMAIL',
    subjectTemplate: '📦 Order Packed — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour order {{orderNumber}} has been packed and is ready for dispatch! Shipping confirmation will follow shortly.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'SHIPPED',
    channels:        'EMAIL',
    subjectTemplate: '🚚 Your Order Is On Its Way! — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour order {{orderNumber}} has been shipped!\n\nCourier: {{courierName}}\nTracking (AWB): {{awbCode}}\n\nExpected delivery: 3–7 business days.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'DELIVERED',
    channels:        'EMAIL',
    subjectTemplate: '🎁 Your Order Has Arrived — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour order {{orderNumber}} has been delivered! We hope you love it. Please leave us a review — it means the world to us.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'CANCELLED',
    channels:        'EMAIL',
    subjectTemplate: '❌ Order Cancelled — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour order {{orderNumber}} has been cancelled. If a payment was made, a refund will be processed within 5–7 business days.\n\nNeed help? Email us at support@creativeart.in\n\nTeam CreativeArt 🎨`,
  },

  // ── Dual-Payment / Custom Project Flow ────────────────────────────────────
  {
    templateKey:     'ADVANCE_PAID',
    channels:        'EMAIL',
    subjectTemplate: '💛 Advance Received — Your Project Has Begun! — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nWe've received your advance payment for order {{orderNumber}}. Your custom project is now officially underway!\n\nAdvance Paid: ₹{{advanceAmount}}\nFinal Due: ₹{{finalAmount}}\n\nWe'll keep you updated throughout the journey.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'AWAITING_MATERIAL_DISPATCH',
    channels:        'EMAIL',
    subjectTemplate: '📬 Awaiting Your Materials — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour project {{orderNumber}} is confirmed. We are now waiting for the raw materials / customer-provided items to arrive at our studio.\n\nIf you have tracking details for the material shipment, please reply to this email.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'MATERIAL_IN_TRANSIT',
    channels:        'EMAIL',
    subjectTemplate: '🔄 Materials In Transit — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nThe materials for your custom project {{orderNumber}} are now in transit to our studio. We'll notify you as soon as they arrive!\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'MATERIAL_RECEIVED',
    channels:        'EMAIL',
    subjectTemplate: '📥 Materials Received — Production Starts Soon — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nGreat news! We've received all the materials for your order {{orderNumber}}. Our artisans are inspecting them and production will begin very soon!\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'IN_PRODUCTION',
    channels:        'EMAIL',
    subjectTemplate: '🛠️ Your Order Is In Production — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour custom order {{orderNumber}} is now in active production at our studio. Our artisans are working their magic!\n\nWe'll notify you as soon as it's ready. ✨\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'READY_PENDING_FINAL_PAYMENT',
    channels:        'EMAIL',
    subjectTemplate: '🌟 Your Creation Is Ready — Final Payment Due — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour custom order {{orderNumber}} is complete and ready to ship! We just need your final payment to dispatch it.\n\nFinal Amount Due: ₹{{finalAmount}}\n\nPlease log in to complete your payment.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'FINAL_PAID',
    channels:        'EMAIL',
    subjectTemplate: '✨ Final Payment Received — Shipping Soon! — {{orderNumber}}',
    bodyTemplate:
      `Hi {{customerName}},\n\nWe've received your final payment for order {{orderNumber}}! Your order is now being prepared for dispatch and will be shipped very soon.\n\nYou'll receive tracking details shortly.\n\nTeam CreativeArt 🎨`,
  },
  // ── Affiliate Program Flow ──────────────────────────────────────────────────
  {
    templateKey:     'AFFILIATE_APPLICATION_RECEIVED',
    channels:        'EMAIL',
    subjectTemplate: '📢 New Affiliate Application Received',
    bodyTemplate:
      `Hello Admin,\n\nA new affiliate application has been received from User ID {{userId}}. Please log in to the admin panel to review and approve/reject.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'AFFILIATE_APPROVED',
    channels:        'EMAIL',
    subjectTemplate: '🎉 Affiliate Application Approved!',
    bodyTemplate:
      `Hi {{customerName}},\n\nCongratulations! Your application to become an affiliate has been approved. Your referral code is {{referralCode}}.\n\nStart sharing your referral link to earn commissions!\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'AFFILIATE_REJECTED',
    channels:        'EMAIL',
    subjectTemplate: '❌ Update on Affiliate Application',
    bodyTemplate:
      `Hi {{customerName}},\n\nThank you for your interest in our Affiliate Program. Unfortunately, we are unable to approve your application at this time.\n\nReason: {{reason}}\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'AFFILIATE_COMMISSION_RECEIVED',
    channels:        'EMAIL',
    subjectTemplate: '💰 New Pending Commission Received!',
    bodyTemplate:
      `Hi {{customerName}},\n\nYou've referred a new sale! A pending commission for order {{orderNumber}} has been recorded. The amount is ₹{{commissionAmount}}. It will be confirmed once the order is delivered.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'AFFILIATE_COMMISSION_CONFIRMED',
    channels:        'EMAIL',
    subjectTemplate: '💰 Commission Confirmed!',
    bodyTemplate:
      `Hi {{customerName}},\n\nGreat news! Your commission for order {{orderNumber}} has been confirmed. The amount of ₹{{commissionAmount}} is added to your confirmed balance.\n\nTeam CreativeArt 🎨`,
  },
  {
    templateKey:     'AFFILIATE_PAYOUT_PROCESSED',
    channels:        'EMAIL',
    subjectTemplate: '💸 Payout Processed Successfully',
    bodyTemplate:
      `Hi {{customerName}},\n\nYour affiliate payout batch #{{batchId}} has been processed. A total of ₹{{totalAmount}} has been transferred to your account.\n\nNotes: {{notes}}\n\nTeam CreativeArt 🎨`,
  },
];

async function seed() {
  console.log('🌱  Seeding notification templates…');
  let inserted = 0;
  let updated  = 0;

  for (const tpl of templates) {
    // Check if it already exists
    const existing = await db.query(
      'SELECT id FROM notification_templates WHERE template_key = ?',
      [tpl.templateKey]
    );

    if (existing.length > 0) {
      await db.query(
        `UPDATE notification_templates
         SET channels = ?, subject_template = ?, body_template = ?
         WHERE template_key = ?`,
        [tpl.channels, tpl.subjectTemplate, tpl.bodyTemplate, tpl.templateKey]
      );
      console.log(`  ↺  Updated  : ${tpl.templateKey}`);
      updated++;
    } else {
      await db.query(
        `INSERT INTO notification_templates (template_key, channels, subject_template, body_template)
         VALUES (?, ?, ?, ?)`,
        [tpl.templateKey, tpl.channels, tpl.subjectTemplate, tpl.bodyTemplate]
      );
      console.log(`  ✓  Inserted : ${tpl.templateKey}`);
      inserted++;
    }
  }

  console.log(`\n✅  Done. Inserted: ${inserted}  Updated: ${updated}  Total: ${templates.length}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  Seeding failed:', err);
  process.exit(1);
});
