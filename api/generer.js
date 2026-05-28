'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/generer

   Tar imot en wizard-brief, bygger en prompt og strømmer en komplett, generert
   nettside (HTML) tilbake til nettleseren via Server-Sent Events.

   Feil før strømmen starter (feil metode, tom brief, manglende nøkkel, rate
   limit) returneres som vanlig JSON med riktig statuskode. Selve genereringen
   strømmes med SSE (se lib/sse.js).
   ──────────────────────────────────────────────────────────────────────────── */

const { sanitizeBrief, getClientIp } = require('../lib/sanitize');
const { buildGeneratePrompt, SYSTEM_PROMPT } = require('../lib/prompt');
const { checkRateLimit } = require('../lib/rate-limit');
const { runStream } = require('../lib/sse');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Metode ikke tillatt' });
  }

  const brief = sanitizeBrief(req.body || {});

  // Minimumskrav: bedriftsnavn + en beskrivelse (steg 1 i wizard-en).
  if (!brief.bedriftsnavn || brief.beskrivelse.length < 10) {
    return sendJson(res, 400, {
      error: 'Vi trenger minst bedriftsnavn og en kort beskrivelse (noen ord) for å lage en god side.'
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 503, {
      error: 'Generatoren er ikke ferdig konfigurert ennå. Ta kontakt på post@scalemedia.no.'
    });
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(ip, 'generer');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return sendJson(res, 429, {
      error: `Du har brukt dine ${rl.limit} gratis sider. Vil du ha mer? Book et gratis møte, så bygger vi siden ferdig sammen.`,
      retryAfterSec: rl.retryAfterSec,
      rateLimited: true
    });
  }

  const userContent = buildGeneratePrompt(brief);
  await runStream(res, { action: 'generer', system: SYSTEM_PROMPT, userContent, ip });
};

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}
