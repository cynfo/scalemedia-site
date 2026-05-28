'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Per-IP rate limiting (kostnadskontroll).

   To lag:
   1. PERSISTENT (anbefalt i produksjon): Vercel KV / Upstash Redis via REST.
      En delt teller som holder "X sider per IP per døgn" på tvers av ALLE
      serverless-instanser. Aktiveres automatisk når KV-miljøvariablene finnes
      (KV_REST_API_URL/TOKEN eller UPSTASH_REDIS_REST_URL/TOKEN).
   2. IN-MEMORY (fallback): brukes hvis KV ikke er konfigurert, eller hvis KV
      midlertidig feiler. Lever per instans og nullstilles - en myk bremsekloss,
      ikke vanntett på Vercel.

   Den harde garantien mot å tømme saldoen er uansett Anthropic sin månedlige
   utgiftsgrense (sett den i console.anthropic.com).
   ──────────────────────────────────────────────────────────────────────────── */

const WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || String(24 * 60 * 60 * 1000), 10); // 1 døgn

// Standardgrenser - kan overstyres i .env. Hver IP får 2 sider per døgn.
const LIMIT_GENERER = parseInt(process.env.RATE_LIMIT_GENERER || '2', 10);
const LIMIT_ITERER  = parseInt(process.env.RATE_LIMIT_ITERER  || '8', 10);

function limitFor(action) {
  return action === 'iterer' ? LIMIT_ITERER : LIMIT_GENERER;
}

// ── KV (Upstash Redis REST) ───────────────────────────────────────────────────

function kvCreds() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function kvFetch(creds, path, body) {
  const resp = await fetch(`${creds.url}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${creds.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!resp.ok) throw new Error(`KV ${resp.status}`);
  return resp.json();
}

/**
 * Persistent rate-sjekk via Redis. Inkrementerer en teller med fast tidsvindu
 * (EXPIRE NX = vinduet starter ved første treff). Returnerer samme form som
 * in-memory-varianten.
 */
async function checkKV(creds, ip, action) {
  const limit = limitFor(action);
  const windowSec = Math.max(1, Math.ceil(WINDOW_MS / 1000));
  const key = `rl:${action}:${ip}`;

  // Ett kall: INCR + sett utløp kun hvis ikke satt (NX).
  const data = await kvFetch(creds, '/pipeline', [
    ['INCR', key],
    ['EXPIRE', key, String(windowSec), 'NX']
  ]);
  const count = (data && data[0] && typeof data[0].result === 'number') ? data[0].result : 1;

  if (count > limit) {
    let retryAfterSec = windowSec;
    try {
      const ttl = await kvFetch(creds, `/ttl/${encodeURIComponent(key)}`);
      if (ttl && ttl.result > 0) retryAfterSec = ttl.result;
    } catch { /* behold standard */ }
    return { allowed: false, remaining: 0, retryAfterSec, limit, store: 'kv' };
  }
  return { allowed: true, remaining: Math.max(0, limit - count), retryAfterSec: 0, limit, store: 'kv' };
}

// ── In-memory fallback ────────────────────────────────────────────────────────

// ip -> { generer: number[], iterer: number[] }  (lister med tidsstempler)
const hits = new Map();
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

function checkMemory(ip, action) {
  const now = Date.now();
  sweep(now);
  const limit = limitFor(action);

  if (!hits.has(ip)) hits.set(ip, { generer: [], iterer: [] });
  const rec = hits.get(ip);
  rec[action] = rec[action].filter(t => now - t < WINDOW_MS);

  if (rec[action].length >= limit) {
    const oldest = rec[action][0];
    const retryAfterSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, remaining: 0, retryAfterSec, limit, store: 'memory' };
  }
  rec[action].push(now);
  return { allowed: true, remaining: limit - rec[action].length, retryAfterSec: 0, limit, store: 'memory' };
}

// ── Offentlig API ─────────────────────────────────────────────────────────────

/**
 * Sjekker og registrerer et treff for en IP og en handling.
 * Bruker KV hvis konfigurert (vanntett på tvers av instanser), ellers minne.
 * Faller tilbake til minne hvis KV feiler, slik at en KV-nedetid ikke blokkerer
 * legitime brukere.
 * @returns {Promise<{allowed,remaining,retryAfterSec,limit,store}>}
 */
async function checkRateLimit(ip, action) {
  const creds = kvCreds();
  if (creds) {
    try {
      return await checkKV(creds, ip, action);
    } catch (err) {
      console.error('KV rate-limit feilet, faller tilbake til minne:', err.message);
    }
  }
  return checkMemory(ip, action);
}

module.exports = { checkRateLimit, LIMIT_GENERER, LIMIT_ITERER, WINDOW_MS };
