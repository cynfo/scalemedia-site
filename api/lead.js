'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/lead

   Tar imot kontaktinfo fra generatoren (+ valgfri generert side og brief) og
   sender et lead-varsel til post@scalemedia.no. Sender også en best-effort
   kopi av forhåndsvisningen til den besøkende.

   Bygger på samme SMTP-oppsett som api/send-lead.js (miljøvariabler).
   ──────────────────────────────────────────────────────────────────────────── */

const nodemailer = require('nodemailer');

const MAX_ATTACH_CHARS = 400000; // ~400 KB tak på vedlagt HTML

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode ikke tillatt' });

  const body = req.body || {};
  const name    = String(body.name || '').trim();
  const email   = String(body.email || '').trim();
  const company = String(body.company || '').trim();
  const phone   = String(body.phone || '').trim();
  const pakke   = String(body.pakke || '').trim();
  const brief   = body.brief && typeof body.brief === 'object' ? body.brief : {};
  let   html    = typeof body.html === 'string' ? body.html : '';

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

  const leadEmail = process.env.LEAD_EMAIL || 'post@scalemedia.no';
  const fromAddr  = process.env.SMTP_FROM  || smtpUser;

  if (html.length > MAX_ATTACH_CHARS) html = html.slice(0, MAX_ATTACH_CHARS);

  const attachments = html
    ? [{ filename: `forhandsvisning-${slug(company || brief.bedriftsnavn || 'nettside')}.html`, content: html, contentType: 'text/html; charset=utf-8' }]
    : [];

  const briefRows = [
    ['Bedriftsnavn', brief.bedriftsnavn],
    ['Bransje',      brief.bransje],
    ['Beskrivelse',  brief.beskrivelse],
    ['Sidetype',     brief.sidetype],
    ['Mål',          brief.maal],
    ['Stil',         brief.stil],
    ['Farger',       brief.farger],
    ['Tjenester',    brief.tjenester]
  ].filter(([, v]) => v && String(v).trim());

  const briefHtml = briefRows
    .map(([k, v]) => `<div class="field"><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(v))}</div>`)
    .join('');

  const internalHtml = `
<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color:#1e1b4b; background:#f5f4ff; margin:0; padding:0; }
  .wrap { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:32px; color:#fff; }
  .header h1 { margin:0; font-size:22px; }
  .header p { margin:8px 0 0; opacity:.85; font-size:14px; }
  .body { padding:32px; }
  .field { margin-bottom:10px; font-size:15px; line-height:1.5; }
  .field strong { color:#6366f1; }
  .box { background:#f5f4ff; border-left:4px solid #6366f1; padding:16px; border-radius:0 8px 8px 0; margin:20px 0; }
  .pakke { display:inline-block; background:#6366f1; color:#fff; font-weight:700; padding:8px 16px; border-radius:8px; margin-bottom:16px; }
  .footer { background:#f5f4ff; padding:20px 32px; font-size:12px; color:#6b7280; }
</style></head><body>
  <div class="wrap">
    <div class="header">
      <h1>Ny lead fra nettside-generatoren</h1>
      <p>En besøkende har laget en forhåndsvisning og ber om oppfølging.</p>
    </div>
    <div class="body">
      ${pakke ? `<div class="pakke">${escapeHtml(pakke)}</div>` : ''}
      <div class="field"><strong>Navn:</strong> ${escapeHtml(name)}</div>
      <div class="field"><strong>E-post:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
      ${company ? `<div class="field"><strong>Bedrift:</strong> ${escapeHtml(company)}</div>` : ''}
      ${phone   ? `<div class="field"><strong>Telefon:</strong> <a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></div>` : ''}
      ${briefHtml ? `<div class="box"><strong style="display:block;margin-bottom:8px;">Brief brukeren fylte ut:</strong>${briefHtml}</div>` : ''}
      <p style="font-size:14px;color:#6b7280;">${attachments.length ? 'Den genererte forhåndsvisningen ligger vedlagt som HTML-fil.' : 'Ingen forhåndsvisning ble vedlagt.'}</p>
      <p style="font-size:14px;color:#6b7280;">Personen har samtykket til oppfølging fra ScaleMedia AS.</p>
    </div>
    <div class="footer">ScaleMedia AS · Kokstadvegen 41, 5257 Kokstad · post@scalemedia.no</div>
  </div>
</body></html>`;

  try {
    await transporter.sendMail({
      from:    `"ScaleMedia nettside-generator" <${fromAddr}>`,
      to:      leadEmail,
      replyTo: email,
      subject: `Ny generator-lead: ${name}${company ? ' (' + company + ')' : ''}`,
      html:    internalHtml,
      attachments
    });
  } catch (err) {
    console.error('E-postsending feilet:', err.message);
    return res.status(500).json({ error: 'Kunne ikke sende akkurat nå. Kontakt oss direkte på post@scalemedia.no' });
  }

  // Best-effort kopi til den besøkende - om dette feiler, regnes leaden likevel
  // som vellykket (varselet til ScaleMedia er det viktige).
  try {
    await transporter.sendMail({
      from:    `"ScaleMedia" <${fromAddr}>`,
      to:      email,
      replyTo: leadEmail,
      subject: 'Forhåndsvisningen av nettsiden din – fra ScaleMedia',
      html:    visitorHtml(name, attachments.length > 0),
      attachments
    });
  } catch (err) {
    console.error('Kopi til besøkende feilet (ignorert):', err.message);
  }

  return res.status(200).json({ success: true });
};

function visitorHtml(name, hasAttachment) {
  return `
<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; color:#1e1b4b; background:#f5f4ff; margin:0; padding:0; }
  .wrap { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#6366f1,#8b5cf6); padding:32px; color:#fff; }
  .header h1 { margin:0; font-size:22px; }
  .body { padding:32px; font-size:15px; line-height:1.6; color:#374151; }
  .btn { display:inline-block; margin-top:20px; background:#6366f1; color:#fff !important; text-decoration:none; font-weight:700; padding:14px 28px; border-radius:50px; }
  .footer { background:#f5f4ff; padding:20px 32px; font-size:12px; color:#6b7280; }
</style></head><body>
  <div class="wrap">
    <div class="header"><h1>Takk, ${escapeHtml(name)}!</h1></div>
    <div class="body">
      <p>Her er forhåndsvisningen du laget med ScaleMedias nettside-generator.
      ${hasAttachment ? 'Den ligger vedlagt som en HTML-fil du kan åpne i nettleseren.' : ''}</p>
      <p>Dette er et utgangspunkt – vi tar gjerne en uforpliktende prat om å gjøre den
      til en ferdig, publisert nettside skreddersydd for deg.</p>
      <a class="btn" href="https://scalemedia.no/index.html#kontakt">Book et gratis møte</a>
      <p style="margin-top:24px;font-size:13px;color:#6b7280;">Eller svar på denne e-posten – vi leser alt selv.</p>
    </div>
    <div class="footer">ScaleMedia AS · Kokstadvegen 41, 5257 Kokstad · post@scalemedia.no · 55 09 50 90</div>
  </div>
</body></html>`;
}

function slug(s) {
  return String(s).toLowerCase()
    .replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'nettside';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
