'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Enkel per-IP rate limiting (in-memory, glidende timesvindu).

   Hvert Claude-kall koster penger, så vi begrenser antall genereringer/
   iterasjoner per IP per time. Standardgrenser kan overstyres via miljøvariabler.

   VIKTIG om produksjon:
   In-memory-telleren lever i én serverless-instans. På Vercel kan flere
   instanser kjøre parallelt, og hver har sin egen teller - så den reelle
   grensen kan bli litt høyere enn satt. For SEO/lead-magnet-bruk er det godt
   nok som et kostnadsgjerde. Trenger man hard global grense, bytt ut Map-en
   under med Vercel KV eller Upstash Redis (samme funksjonssignatur).
   ──────────────────────────────────────────────────────────────────────────── */

const WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || String(24 * 60 * 60 * 1000), 10); // 1 døgn

// Standardgrenser - kan overstyres i .env. Hver IP får 2 sider per døgn.
const LIMIT_GENERER = parseInt(process.env.RATE_LIMIT_GENERER || '2', 10);
const LIMIT_ITERER  = parseInt(process.env.RATE_LIMIT_ITERER  || '8', 10);

// ip -> { generer: number[], iterer: number[] }  (lister med tidsstempler)
const hits = new Map();

// Rydd vekk gamle oppføringer av og til så Map-en ikke vokser i det uendelige.
let lastSweep = Date.now();
function sweep(now) {
  if (now - lastSweep < WINDOW_MS) return;
  lastSweep = now;
  for (const [ip, rec] of hits) {
    rec.generer = rec.generer.filter(t => now - t < WINDOW_MS);
    rec.iterer  = rec.iterer.filter(t => now - t < WINDOW_MS);
    if (rec.generer.length === 0 && rec.iterer.length === 0) hits.delete(ip);
  }
}

/**
 * Sjekker og registrerer et treff for en IP og en gitt handling.
 * @param {string} ip
 * @param {'generer'|'iterer'} action
 * @returns {{ allowed: boolean, remaining: number, retryAfterSec: number, limit: number }}
 */
function checkRateLimit(ip, action) {
  const now = Date.now();
  sweep(now);

  const limit = action === 'iterer' ? LIMIT_ITERER : LIMIT_GENERER;

  if (!hits.has(ip)) hits.set(ip, { generer: [], iterer: [] });
  const rec = hits.get(ip);

  // Behold kun tidsstempler innenfor vinduet.
  rec[action] = rec[action].filter(t => now - t < WINDOW_MS);

  if (rec[action].length >= limit) {
    const oldest = rec[action][0];
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec, limit };
  }

  rec[action].push(now);
  return { allowed: true, remaining: limit - rec[action].length, retryAfterSec: 0, limit };
}

module.exports = { checkRateLimit, LIMIT_GENERER, LIMIT_ITERER };
