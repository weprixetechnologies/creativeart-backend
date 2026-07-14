'use strict';

const nodemailer = require('nodemailer');

// ── Transporter (lazy-initialised once) ─────────────────────────────────────
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for port 465
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    // Gracefully time-out instead of hanging
    connectionTimeout: 8000,
    greetingTimeout:   5000,
    socketTimeout:     10000,
  });

  return _transporter;
}

// ── Branded HTML wrapper ─────────────────────────────────────────────────────
function wrapHtml(subject, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
    body { margin:0; padding:0; background:#EFF8F7; font-family:'Outfit',Arial,sans-serif; }
    .outer { background:#EFF8F7; padding:40px 16px; }
    .card  { max-width:600px; margin:0 auto; background:#FFFFFF;
             border-radius:24px; overflow:hidden;
             box-shadow:0 8px 32px rgba(43,168,162,0.12); }
    /* Header */
    .header {
      background:linear-gradient(135deg,#2BA8A2 0%,#1E8C86 100%);
      padding:32px 40px 28px;
      text-align:center;
    }
    .logo-row { display:flex; align-items:center; justify-content:center; gap:10px; }
    .logo-icon {
      width:44px; height:44px; background:#FFD23F;
      border-radius:12px; display:flex; align-items:center;
      justify-content:center; font-size:22px;
    }
    .brand-name {
      font-size:22px; font-weight:800; color:#FFFFFF; letter-spacing:-0.5px;
    }
    .brand-tag {
      font-size:11px; font-weight:600; color:rgba(255,255,255,0.70);
      letter-spacing:2px; text-transform:uppercase; margin-top:4px;
    }
    /* Divider stripe */
    .stripe {
      height:5px;
      background:linear-gradient(90deg,#FFD23F 0%,#EF6C4A 33%,#2BA8A2 66%,#FFD23F 100%);
    }
    /* Body */
    .body { padding:40px 40px 32px; }
    .greeting {
      font-size:26px; font-weight:800; color:#1E3A3A;
      line-height:1.25; margin:0 0 8px;
    }
    .intro { font-size:15px; color:#4A7070; line-height:1.6; margin:0 0 28px; }
    /* Info box */
    .infobox {
      background:#E8F6F5; border-radius:16px; border-left:4px solid #2BA8A2;
      padding:20px 24px; margin:0 0 24px;
    }
    .infobox p { margin:4px 0; font-size:14px; color:#1E3A3A; }
    .infobox .label { font-weight:600; color:#4A7070; font-size:12px;
                      text-transform:uppercase; letter-spacing:0.06em; }
    .infobox .value { font-weight:700; font-size:16px; }
    /* CTA button */
    .cta-wrap { text-align:center; margin:28px 0; }
    .cta {
      display:inline-block; background:linear-gradient(135deg,#FFD23F,#E6B800);
      color:#2C3E50; font-weight:700; font-size:15px;
      padding:14px 36px; border-radius:999px; text-decoration:none;
      box-shadow:0 4px 20px rgba(255,210,63,0.45);
    }
    /* Divider */
    hr { border:none; border-top:1.5px solid #E8F6F5; margin:24px 0; }
    /* Rich text body */
    .message { font-size:15px; color:#4A7070; line-height:1.7; }
    .message strong { color:#1E3A3A; }
    /* Footer */
    .footer { background:#EFF8F7; padding:24px 40px; text-align:center; }
    .footer p { font-size:12px; color:#7BA8A4; margin:4px 0; line-height:1.6; }
    .footer a { color:#2BA8A2; text-decoration:none; font-weight:600; }
    /* Mobile */
    @media (max-width:600px) {
      .body, .footer { padding:28px 24px; }
      .header { padding:24px; }
      .greeting { font-size:22px; }
    }
  </style>
</head>
<body>
<div class="outer">
  <div class="card">
    <!-- Header -->
    <div class="header">
      <div class="logo-row">
        <div class="logo-icon">🎨</div>
        <div>
          <div class="brand-name">CreativeArt</div>
          <div class="brand-tag">Handcrafted With Love</div>
        </div>
      </div>
    </div>
    <div class="stripe"></div>

    <!-- Body -->
    <div class="body">
      ${body}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>You received this email because you placed an order on CreativeArt.</p>
      <p>Questions? <a href="mailto:support@creativeart.in">support@creativeart.in</a></p>
      <p style="margin-top:12px;color:#A8C8C5;">© ${new Date().getFullYear()} CreativeArt. All rights reserved.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Public API ───────────────────────────────────────────────────────────────
class EmailService {
  /**
   * Send an email.
   * @param {object} opts
   * @param {string}        opts.to       – recipient email address
   * @param {string}        opts.subject  – email subject
   * @param {string}        opts.html     – raw HTML body section (will be wrapped)
   * @param {string}        [opts.text]   – optional plain-text fallback
   * @returns {Promise<{messageId:string}>}
   */
  async sendEmail({ to, subject, html, text }) {
    const transporter = getTransporter();

    const info = await transporter.sendMail({
      from:    process.env.SMTP_FROM || '"CreativeArt" <noreply@creativeart.in>',
      to,
      subject,
      html:    wrapHtml(subject, html),
      text:    text || subject,
    });

    console.log(`[EmailService] Sent → ${to} | msgId: ${info.messageId}`);
    return { messageId: info.messageId };
  }

  /**
   * Verify SMTP connectivity (call on server boot for early error detection).
   */
  async verify() {
    try {
      await getTransporter().verify();
      console.log('[EmailService] SMTP connection verified ✓');
    } catch (err) {
      console.warn('[EmailService] SMTP verification failed (email delivery will be unavailable):', err.message);
    }
  }
}

module.exports = new EmailService();
