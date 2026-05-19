'use strict';

// Enkel lokal dev-server for å teste SEO-analyseverktøyet
// Kjør med: node dev-server.js
// Åpne: http://localhost:3000/gratis-seo-analyse.html

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
  '.webmanifest': 'application/manifest+json'
};

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API-ruter ────────────────────────────────────────────────────────────

  if (pathname === '/api/seo-analyse' && req.method === 'POST') {
    const body = await readBody(req);
    const handler = require('./api/seo-analyse');
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
    const mockReq = { method: 'POST', body };
    try {
      await handler(mockReq, mockRes);
    } catch (err) {
      console.error('API-feil:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Intern serverfeil: ' + err.message }));
    }
    return;
  }

  if (pathname === '/api/send-lead' && req.method === 'POST') {
    const body = await readBody(req);
    const handler = require('./api/send-lead');
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
    const mockReq = { method: 'POST', body };
    try {
      await handler(mockReq, mockRes);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Intern serverfeil: ' + err.message }));
    }
    return;
  }

  // ── Statiske filer ────────────────────────────────────────────────────────

  let filePath = path.join(ROOT, pathname === '/' ? '/index.html' : pathname);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n✓ Dev-server kjører på http://localhost:${PORT}`);
  console.log(`  → Åpne: http://localhost:${PORT}/gratis-seo-analyse.html\n`);
});
