'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Bilde-resolver for genererte sider.

   Modellen skriver IKKE bilde-URLer direkte. I stedet skriver den plassholdere:
       <img src="{{IMG:modern dental clinic}}" ...>
   Her byttes hver plassholder ut med et EKTE, RELEVANT bilde basert på
   nøkkelordene, slik at bildene faktisk passer bedriften/tjenesten.

   To kilder:
   1. Unsplash API (anbefalt – proff kvalitet) hvis UNSPLASH_ACCESS_KEY er satt.
      Gratis nøkkel: https://unsplash.com/developers
   2. Fallback uten nøkkel: LoremFlickr (nøkkelord-baserte foto, ingen nøkkel).

   Uansett legger system-prompten en CSS-gradient bak hvert bilde + onerror, så
   en side aldri viser et knust bilde.
   ──────────────────────────────────────────────────────────────────────────── */

const TOKEN_RE = /\{\{\s*IMG:\s*([^}]+?)\s*\}\}/gi;

// Enkel, stabil hash slik at samme nøkkelord gir samme bilde (unngår at bildet
// "hopper" mellom ulike motiv).
function hashNum(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 100000;
}

// Nøkkelord -> LoremFlickr-URL (nøkkelord-relevante foto, ingen API-nøkkel).
function loremflickrUrl(keywords) {
  const tags = String(keywords)
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, '')
    .trim()
    .replace(/\s+/g, ',')
    .replace(/,+/g, ',')
    .slice(0, 60) || 'business,office';
  return `https://loremflickr.com/1200/800/${tags}?lock=${hashNum(keywords)}`;
}

// Nøkkelord -> Unsplash-foto via API. Returnerer null ved feil (kaller faller
// tilbake til LoremFlickr).
async function unsplashUrl(keywords, accessKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const q = encodeURIComponent(String(keywords).slice(0, 100));
    const resp = await fetch(
      `https://api.unsplash.com/search/photos?query=${q}&per_page=1&orientation=landscape&content_filter=high`,
      {
        signal: controller.signal,
        headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' }
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const hit = data && data.results && data.results[0];
    if (!hit || !hit.urls) return null;
    // Trigg Unsplash sin "download"-sporing (krav i API-retningslinjene), uten å vente.
    if (hit.links && hit.links.download_location) {
      fetch(`${hit.links.download_location}`, {
        headers: { Authorization: `Client-ID ${accessKey}` }
      }).catch(() => {});
    }
    return `${hit.urls.regular}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bytter alle {{IMG:...}}-plassholdere i HTML-en med ekte bilde-URLer.
 * Robust: hvis noe feiler, faller den tilbake til LoremFlickr (aldri en
 * gjenstående plassholder i sluttresultatet).
 * @param {string} html
 * @returns {Promise<string>}
 */
async function resolveImages(html) {
  if (!html || html.indexOf('{{') === -1) return html;

  // Unike nøkkelord.
  const keywords = [...new Set(
    [...html.matchAll(TOKEN_RE)].map(m => m[1].trim()).filter(Boolean)
  )];
  if (keywords.length === 0) return html;

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const urlByKeyword = {};

  await Promise.all(keywords.map(async (kw) => {
    let url = null;
    if (accessKey) {
      try { url = await unsplashUrl(kw, accessKey); } catch { url = null; }
    }
    urlByKeyword[kw] = url || loremflickrUrl(kw);
  }));

  return html.replace(TOKEN_RE, (_, kw) => urlByKeyword[kw.trim()] || loremflickrUrl(kw.trim()));
}

module.exports = { resolveImages };
