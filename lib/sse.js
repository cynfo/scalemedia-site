'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Felles SSE-strømming til nettleseren for /api/generer og /api/iterer.

   Protokoll (hver linje er "data: <json>\n\n"):
     { type: 'status', message }      - kuratert statusmelding
     { type: 'delta',  text }         - bit av generert HTML (driver fremdrift)
     { type: 'done',   html, usage }  - ferdig, renset HTML + token-bruk
     { type: 'error',  message }      - vennlig norsk feilmelding

   Pre-stream-feil (rate limit, ugyldig input, manglende nøkkel) returneres som
   vanlig JSON med riktig statuskode FØR strømmen starter - se selve handlerne.
   ──────────────────────────────────────────────────────────────────────────── */

const { streamMessage, logUsage, ApiKeyMissingError } = require('./anthropic');
const { extractHtml } = require('./sanitize');

// Kuraterte statusmeldinger som vises etter hvert som genereringen skrider frem.
// Knyttes til faktisk fremdrift (andel mottatte tegn), ikke en falsk timer.
const STATUS_MILESTONES = [
  { at: 0.00, message: 'Tolker briefen din …' },
  { at: 0.08, message: 'Velger fargepalett og typografi …' },
  { at: 0.22, message: 'Skriver overbevisende tekst …' },
  { at: 0.45, message: 'Bygger struktur og seksjoner …' },
  { at: 0.72, message: 'Finpusser design og animasjoner …' },
  { at: 0.90, message: 'Setter sammen siden …' }
];

// Grovt anslag på forventet svarlengde (tegn) for å regne ut fremdrift.
const EXPECTED_CHARS = 42000;

/**
 * Kjører en strømmende generering og skriver SSE til res.
 * @param {object} res                Node-respons (rå - støtter write/end)
 * @param {object} opts
 * @param {string} opts.action        'generer' | 'iterer' (for logging)
 * @param {string} opts.system        system-prompt
 * @param {string} opts.userContent   user-melding
 * @param {string} opts.ip            klient-IP (for logging)
 */
async function runStream(res, { action, system, userContent, ip }) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // Hindrer at proxyer (f.eks. nginx) buffrer strømmen.
    'X-Accel-Buffering': 'no'
  });

  const send = (obj) => {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* klient lukket */ }
  };

  const usage = {};
  const t0 = Date.now();
  let full = '';
  let nextMilestone = 0;

  send({ type: 'status', message: STATUS_MILESTONES[0].message });
  nextMilestone = 1;

  try {
    for await (const text of streamMessage({ system, userContent, usageRef: usage })) {
      full += text;
      send({ type: 'delta', text });

      // Send neste kuraterte statusmelding når vi passerer terskelen.
      const progress = Math.min(0.99, full.length / EXPECTED_CHARS);
      while (nextMilestone < STATUS_MILESTONES.length && progress >= STATUS_MILESTONES[nextMilestone].at) {
        send({ type: 'status', message: STATUS_MILESTONES[nextMilestone].message });
        nextMilestone++;
      }
    }

    const html = extractHtml(full);
    if (!html || !/<html|<!doctype html/i.test(html)) {
      logUsage({ action, ip, usage, ms: Date.now() - t0, ok: false, error: 'ugyldig html' });
      send({ type: 'error', message: 'AI-en klarte ikke å lage en gyldig side denne gangen. Prøv igjen.' });
    } else {
      logUsage({ action, ip, usage, ms: Date.now() - t0, ok: true });
      send({
        type: 'done',
        html,
        usage: { inputTokens: usage.inputTokens || 0, outputTokens: usage.outputTokens || 0 }
      });
    }
  } catch (err) {
    logUsage({ action, ip, usage, ms: Date.now() - t0, ok: false, error: err.message });
    let message = 'Noe gikk galt under genereringen. Prøv gjerne igjen.';
    if (err instanceof ApiKeyMissingError) {
      message = 'Generatoren er ikke ferdig konfigurert ennå. Ta kontakt på post@scalemedia.no.';
    } else if (err.status === 504) {
      message = 'Det tok for lang tid å generere siden. Prøv igjen, eller forenkle beskrivelsen litt.';
    } else if (err.status === 429) {
      message = 'AI-tjenesten er svært travel akkurat nå. Vent et lite øyeblikk og prøv igjen.';
    } else if (err.status === 401 || err.status === 403) {
      message = 'Generatoren mangler gyldig tilgang. Ta kontakt på post@scalemedia.no.';
    }
    send({ type: 'error', message });
  } finally {
    try { res.end(); } catch { /* allerede lukket */ }
  }
}

module.exports = { runStream };
