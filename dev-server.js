'use strict';

// Lokal dev-server for å teste verktøyene (SEO-analyse + nettside-generator)
// uten Vercel. Kjør med: node dev-server.js  (eller: npm run dev)
// Åpne:  http://localhost:3000/lag-din-nettside.html
//
// Laster .env automatisk og ruter både statiske filer og API-endepunktene.
// Genererings-endepunktene strømmer (SSE), så de får den ekte responsen direkte;
// de øvrige bruker en liten res-wrapper med status()/json()-hjelpere.

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ── Last .env (enkel parser, ingen avhengighet) ──────────────────────────────
(function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = val;
  }
})();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.avif': 'image/avif', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

// Endepunkter som strømmer (raw res sendes rett inn i handleren).
const STREAMING = new Set(['/api/generer', '/api/iterer']);
// Endepunkter med vanlig JSON-svar (bruker res-wrapper).
const JSON_ROUTES = {
  '/api/seo-analyse': './api/seo-analyse',
  '/api/send-lead':   './api/send-lead',
  '/api/lead':        './api/lead'
};

const server = http.createServer(async (req, res) => {
  const pathname = url.parse(req.url, true).pathname;

  // ── Strømmende endepunkter ──────────────────────────────────────────────
  if (STREAMING.has(pathname)) {
    if (req.method !== 'POST' && req.method !== 'OPTIONS') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Metode ikke tillatt' }));
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    req.body = body;
    const handler = require(pathname === '/api/generer' ? './api/generer' : './api/iterer');
    try {
      await handler(req, res); // handleren skriver SSE / JSON direkte på res
    } catch (err) {
      console.error('API-feil:', err && err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Intern serverfeil.' }));
      } else {
        try { res.end(); } catch {}
      }
    }
    return;
  }

  // ── JSON-endepunkter (res-wrapper) ──────────────────────────────────────
  if (JSON_ROUTES[pathname]) {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const handler = require(JSON_ROUTES[pathname]);
    const mockRes = {
      _status: 200, _headers: {},
      status(code) { this._status = code; return this; },
      setHeader(k, v) { this._headers[k] = v; },
      json(data) {
        res.writeHead(this._status, { 'Content-Type': 'application/json', ...this._headers });
        res.end(JSON.stringify(data));
      },
      end() { res.writeHead(this._status, this._headers); res.end(); }
    };
    try {
      await handler({ method: req.method, body, headers: req.headers, socket: req.socket }, mockRes);
    } catch (err) {
      console.error('API-feil:', err && err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Intern serverfeil: ' + (err && err.message) }));
    }
    return;
  }

  // ── Statiske filer ──────────────────────────────────────────────────────
  const filePath = path.join(ROOT, pathname === '/' ? '/index.html' : decodeURIComponent(pathname));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n✓ Dev-server kjører på http://localhost:${PORT}`);
  console.log(`  → SEO-analyse:        http://localhost:${PORT}/gratis-seo-analyse.html`);
  console.log(`  → Nettside-generator: http://localhost:${PORT}/lag-din-nettside.html`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('\n  ⚠  ANTHROPIC_API_KEY mangler – generatoren vil svare med en konfig-feil.');
    console.log('     Legg nøkkelen i .env (se .env.example) og start på nytt.\n');
  } else {
    console.log('');
  }
});
