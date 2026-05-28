'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Sanitering av brukerinput og uttrekk av generert HTML.

   Brukerinput fra wizard-en flettes inn i prompten til Claude. Selv om vi pakker
   den i tydelige <bruker_brief>-delimitere og instruerer modellen om at innholdet
   er DATA (ikke instruksjoner), gjør vi i tillegg en lett rensing her for å:
     - kappe lengder (kostnadskontroll + hindrer at noen fyller konteksten)
     - fjerne kontrolltegn
     - nøytralisere de mest åpenbare "ignorer instruksjonene over"-forsøkene
   ──────────────────────────────────────────────────────────────────────────── */

// Maks tegnlengde per felt - romslig nok for ekte bruk, stramt nok mot misbruk.
const FIELD_LIMITS = {
  bedriftsnavn:  120,
  bransje:       80,
  beskrivelse:   1200,
  sidetype:      40,
  maal:          40,
  stil:          40,
  farger:        80,
  tjenester:     800,
  kontaktinfo:   400,
  endring:       600
};

// Fraser som nesten utelukkende dukker opp i prompt-injection-forsøk.
// Vi fjerner dem heller enn å avvise hele forespørselen, slik at ekte brukere
// med uskyldig formulering ikke blir blokkert.
const INJECTION_PATTERNS = [
  /ignore (all |the )?(previous|above|prior) (instructions|prompts?)/gi,
  /disregard (all |the )?(previous|above|prior)/gi,
  /ignorer (alle |de )?(tidligere|forrige|over)/gi,
  /system prompt/gi,
  /\byou are now\b/gi,
  /\bdu er nå\b/gi,
  /<\/?(system|assistant|user)>/gi,
  /\[\/?(INST|SYSTEM|ASSISTANT|USER)\]/gi
];

/**
 * Renser ett enkelt tekstfelt: trimmer, kapper lengde, fjerner kontrolltegn
 * og nøytraliserer kjente injection-fraser.
 * @param {*} value  rå verdi (kan være hva som helst)
 * @param {string} field  feltnavn (bestemmer lengdegrense)
 * @returns {string}
 */
function cleanField(value, field) {
  let str = typeof value === 'string' ? value : (value == null ? '' : String(value));

  // Fjern null-bytes og andre kontrolltegn (behold linjeskift og tab).
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Kollaps overdrevne linjeskift (maks to på rad).
  str = str.replace(/\n{3,}/g, '\n\n');

  // Nøytraliser injection-mønstre.
  for (const re of INJECTION_PATTERNS) {
    str = str.replace(re, '[fjernet]');
  }

  str = str.trim();

  const limit = FIELD_LIMITS[field] || 200;
  if (str.length > limit) str = str.slice(0, limit).trim();

  return str;
}

/**
 * Renser et helt brief-objekt felt for felt. Ukjente felter ignoreres.
 * @param {object} raw
 * @returns {object} renset brief
 */
function sanitizeBrief(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  return {
    bedriftsnavn: cleanField(b.bedriftsnavn, 'bedriftsnavn'),
    bransje:      cleanField(b.bransje, 'bransje'),
    beskrivelse:  cleanField(b.beskrivelse, 'beskrivelse'),
    sidetype:     cleanField(b.sidetype, 'sidetype'),
    maal:         cleanField(b.maal, 'maal'),
    stil:         cleanField(b.stil, 'stil'),
    farger:       cleanField(b.farger, 'farger'),
    tjenester:    cleanField(b.tjenester, 'tjenester'),
    kontaktinfo:  cleanField(b.kontaktinfo, 'kontaktinfo')
  };
}

/**
 * Trekker ut ren HTML fra modellens svar. Claude blir bedt om å returnere kun
 * HTML, men vi rydder defensivt vekk markdown-kodegjerder og innledende prat.
 * @param {string} text
 * @returns {string} HTML-dokument
 */
function extractHtml(text) {
  if (!text) return '';
  let html = String(text).trim();

  // Fjern ```html ... ``` eller ``` ... ``` -gjerder hvis modellen la dem til.
  const fence = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) html = fence[1].trim();

  // Hvis det finnes tekst før <!doctype> eller <html>, kutt den vekk.
  const docIdx = html.search(/<!doctype html|<html[\s>]/i);
  if (docIdx > 0) html = html.slice(docIdx);

  return html.trim();
}

/**
 * Henter en rimelig klient-IP fra request-headere (Vercel/proxy-vennlig).
 * @param {object} req
 * @returns {string}
 */
function getClientIp(req) {
  const xff = req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']);
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'ukjent';
}

module.exports = { sanitizeBrief, cleanField, extractHtml, getClientIp, FIELD_LIMITS };
