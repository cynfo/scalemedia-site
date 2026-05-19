'use strict';

const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode ikke tillatt' });

  const { name, email, company, phone, analyzedUrl, overallScore, summary } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({ error: 'Navn og e-post er påkrevd' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Ugyldig e-postadresse' });
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('SMTP-konfigurasjon mangler i miljøvariabler');
    return res.status(503).json({ error: 'E-posttjenesten er ikke konfigurert. Kontakt oss direkte på post@scalemedia.no' });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: smtpUser, pass: smtpPass }
  });

  const scoreColor = overallScore >= 75 ? '#22c55e' : overallScore >= 50 ? '#f59e0b' : '#ef4444';
  const leadEmail  = process.env.LEAD_EMAIL || 'post@scalemedia.no';
  const fromAddr   = process.env.SMTP_FROM  || smtpUser;

  const htmlBody = `
<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color: #1e1b4b; background: #f5f4ff; margin: 0; padding: 0; }
  .wrap { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; color: #fff; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
  .body { padding: 32px; }
  .score-box { display: inline-block; background: ${scoreColor}; color: #fff; font-size: 32px; font-weight: 900; padding: 12px 24px; border-radius: 8px; margin-bottom: 24px; }
  .field { margin-bottom: 12px; font-size: 15px; }
  .field strong { color: #6366f1; }
  .summary-box { background: #f5f4ff; border-left: 4px solid #6366f1; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 14px; line-height: 1.6; }
  .footer { background: #f5f4ff; padding: 20px 32px; font-size: 12px; color: #6b7280; }
</style></head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>🎯 Ny SEO-analyse-lead</h1>
      <p>En potensiell kunde har fullført en SEO-analyse og ber om oppfølging.</p>
    </div>
    <div class="body">
      <div class="score-box">${overallScore || '?'}/100</div>
      <div class="field"><strong>Navn:</strong> ${escapeHtml(name)}</div>
      <div class="field"><strong>E-post:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
      ${company ? `<div class="field"><strong>Bedrift:</strong> ${escapeHtml(company)}</div>` : ''}
      ${phone   ? `<div class="field"><strong>Telefon:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ''}
      <div class="field"><strong>Analysert nettside:</strong> <a href="${escapeHtml(analyzedUrl || '')}">${escapeHtml(analyzedUrl || 'ukjent')}</a></div>
      ${summary ? `<div class="summary-box"><strong>AI-oppsummering:</strong><br>${escapeHtml(summary)}</div>` : ''}
      <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
        Personen har samtykket til oppfølging fra ScaleMedia AS.
      </p>
    </div>
    <div class="footer">ScaleMedia AS · Kokstadvegen 41, 5257 Kokstad · post@scalemedia.no</div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    `"ScaleMedia SEO-analysator" <${fromAddr}>`,
      to:      leadEmail,
      replyTo: email,
      subject: `Ny SEO-lead: ${name}${company ? ' (' + company + ')' : ''} – Score ${overallScore}/100`,
      html:    htmlBody
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('E-postsending feilet:', err.message);
    return res.status(500).json({ error: 'Kunne ikke sende e-post. Kontakt oss direkte på post@scalemedia.no' });
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
