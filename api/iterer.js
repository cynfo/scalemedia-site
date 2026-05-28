'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   POST /api/iterer

   Tar imot en eksisterende generert side + et endringsønske, og strømmer en
   oppdatert versjon tilbake via SSE.

   Iterasjonsgrensen ("maks 4 gratis iterasjoner per sesjon") håndheves i
   frontend per sesjon. Her beskytter vi kostnaden med per-IP rate limiting og
   en øvre grense på hvor stor side vi tar imot.
   ──────────────────────────────────────────────────────────────────────────── */

const { cleanField, getClientIp } = require('../lib/sanitize');
const { buildIteratePrompt, SYSTEM_PROMPT } = require('../lib/prompt');
const { checkRateLimit } = require('../lib/rate-limit');
const { runStream } = require('../lib/sse');

const MAX_HTML_CHARS = 200000; // øvre grense på innsendt side (kostnadskontroll)

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

  const body = req.body || {};
  let html = typeof body.html === 'string' ? body.html : '';
  const endring = cleanField(body.endring, 'endring');

  if (!html || !/<html|<!doctype html/i.test(html)) {
    return sendJson(res, 400, { error: 'Mangler en gyldig side å endre. Generer en side først.' });
  }
  if (html.length > MAX_HTML_CHARS) {
    return sendJson(res, 413, { error: 'Siden er for stor til å endres automatisk. Book et møte, så tar vi den videre manuelt.' });
  }
  if (!endring) {
    return sendJson(res, 400, { error: 'Skriv kort hva du vil endre.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return sendJson(res, 503, {
      error: 'Generatoren er ikke ferdig konfigurert ennå. Ta kontakt på post@scalemedia.no.'
    });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, 'iterer');
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return sendJson(res, 429, {
      error: `Du har gjort mange endringer den siste timen. Book et gratis møte, så fullfører vi siden sammen.`,
      retryAfterSec: rl.retryAfterSec,
      rateLimited: true
    });
  }

  const userContent = buildIteratePrompt(html, endring);
  await runStream(res, { action: 'iterer', system: SYSTEM_PROMPT, userContent, ip });
};

function sendJson(res, status, obj) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(obj));
}
