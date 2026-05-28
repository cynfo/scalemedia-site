'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Claude API-klient (server-side, native fetch - ingen SDK-avhengighet).

   ALLE kall til Claude skjer her, på serveren. API-nøkkelen leses kun fra
   miljøvariabelen ANTHROPIC_API_KEY og forlater aldri backend.

   Eksponerer:
     - streamMessage(opts)  : async generator som yield-er tekst-deltas
     - estimateCostUsd(...) : grov kostnadsberegning fra token-bruk
     - logUsage(...)        : strukturert logglinje for kostnadsovervåking
     - getConfig()          : gjeldende modell/innstillinger
   ──────────────────────────────────────────────────────────────────────────── */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

function getConfig() {
  return {
    // Standard: Opus 4.7 - maks kvalitet. Tregere (~2-4 min/side) og dyrere, så
    // dette KREVER Vercel Pro (maxDuration opptil 300s, satt i vercel.json).
    // For gratis Hobby: sett ANTHROPIC_MODEL=claude-haiku-4-5 + MAX_TOKENS=9000
    // + GENERER_TIMEOUT_MS=55000 (rask, men enklere sider).
    model:     process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
    maxTokens: parseInt(process.env.MAX_TOKENS || '18000', 10),
    // Pris per million tokens (USD). Standard ~ Opus 4.7. Juster i .env ved behov.
    inUsdPerMtok:  parseFloat(process.env.PRICE_IN_PER_MTOK  || '5'),
    outUsdPerMtok: parseFloat(process.env.PRICE_OUT_PER_MTOK || '25'),
    // Under Vercel Pro sin 300s-grense, med litt margin.
    timeoutMs: parseInt(process.env.GENERER_TIMEOUT_MS || '290000', 10)
  };
}

class ApiKeyMissingError extends Error {}
class ClaudeApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

/**
 * Strømmer et svar fra Claude. Yield-er tekstbiter etter hvert som de kommer.
 * Token-bruk skrives inn i usageRef underveis (mutert), slik at kalleren kan
 * logge kostnad etterpå.
 *
 * @param {object}   opts
 * @param {string}   opts.system        system-prompt
 * @param {string}   opts.userContent   user-melding (selve briefen/iterasjonen)
 * @param {object}   [opts.usageRef]    mottar { inputTokens, outputTokens, model }
 * @param {AbortSignal} [opts.signal]   ekstern abort (valgfri)
 * @yields {string}  tekst-deltas
 */
async function* streamMessage({ system, userContent, usageRef = {}, signal }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ApiKeyMissingError('ANTHROPIC_API_KEY mangler i miljøvariablene.');
  }

  const cfg = getConfig();
  usageRef.model = cfg.model;
  usageRef.inputTokens = 0;
  usageRef.outputTokens = 0;

  // Egen timeout + ev. ekstern abort.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort);

  let resp;
  try {
    resp = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        stream: true,
        system,
        messages: [{ role: 'user', content: userContent }]
      })
    });
  } catch (err) {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    if (err.name === 'AbortError') throw new ClaudeApiError('Tidsavbrudd mot Claude API.', 504);
    throw new ClaudeApiError('Klarte ikke å nå Claude API.', 502);
  }

  if (!resp.ok) {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    let detail = '';
    try { const j = await resp.json(); detail = j && j.error ? j.error.message : ''; } catch {}
    throw new ClaudeApiError(detail || `Claude API svarte ${resp.status}.`, resp.status);
  }

  // Les og parse Anthropic sin SSE-strøm.
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE-rammer skilles med dobbelt linjeskift.
      let sep;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        // Plukk ut "data:"-linjen(e) i rammen.
        const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json || json === '[DONE]') continue;

        let evt;
        try { evt = JSON.parse(json); } catch { continue; }

        if (evt.type === 'message_start' && evt.message && evt.message.usage) {
          usageRef.inputTokens = evt.message.usage.input_tokens || 0;
        } else if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
          yield evt.delta.text;
        } else if (evt.type === 'message_delta' && evt.usage) {
          usageRef.outputTokens = evt.usage.output_tokens || usageRef.outputTokens;
        } else if (evt.type === 'error') {
          const msg = evt.error && evt.error.message ? evt.error.message : 'Ukjent feil fra Claude API.';
          throw new ClaudeApiError(msg, 502);
        }
      }
    }
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
    try { reader.releaseLock(); } catch {}
  }
}

/**
 * Grov kostnadsberegning i USD ut fra token-bruk.
 */
function estimateCostUsd(usage) {
  const cfg = getConfig();
  const inUsd  = (usage.inputTokens  || 0) / 1e6 * cfg.inUsdPerMtok;
  const outUsd = (usage.outputTokens || 0) / 1e6 * cfg.outUsdPerMtok;
  return +(inUsd + outUsd).toFixed(5);
}

/**
 * Skriver én strukturert logglinje til konsollet (fanges opp av Vercel-logger).
 * Gjør det enkelt for ScaleMedia å overvåke forbruk og kostnad.
 */
function logUsage({ action, ip, usage, ms, ok, error }) {
  const line = {
    tag: 'claude-usage',
    action,
    ts: new Date().toISOString(),
    ip,
    model: usage.model,
    inputTokens: usage.inputTokens || 0,
    outputTokens: usage.outputTokens || 0,
    estCostUsd: estimateCostUsd(usage),
    ms,
    ok
  };
  if (error) line.error = String(error).slice(0, 200);
  try { console.log(JSON.stringify(line)); } catch {}
}

module.exports = {
  streamMessage,
  estimateCostUsd,
  logUsage,
  getConfig,
  ApiKeyMissingError,
  ClaudeApiError
};
