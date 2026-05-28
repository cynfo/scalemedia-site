# ScaleMedia – verktøy & lead-magneter

Dette repoet inneholder ScaleMedias nettside (statiske sider) pluss to AI-/serverside-drevne lead-magneter:

1. **Nettside-generator** – `lag-din-nettside.html`: besøkende beskriver bedriften sin og får en ekte, kjørende nettside-forhåndsvisning generert i sanntid med Claude.
2. **Gratis SEO-analyse** – `gratis-seo-analyse.html`: sanntids SEO-analyse av en hvilken som helst nettside.

Alt kjører som vanilla HTML/CSS/JS i frontend og Node-serverless-funksjoner i `api/`. Ingen byggesteg, ingen frontend-rammeverk.

---

## Nettside-generatoren

### Filer

| Fil | Beskrivelse |
|-----|-------------|
| `lag-din-nettside.html` | Frontend: wizard, generering, forhåndsvisning, iterasjon, konvertering |
| `lag-din-nettside.css` | Sidespesifikke stiler (arver `style.css`) |
| `lag-din-nettside.js` | Wizard-state, SSE-strømming, iframe-preview, iterasjon, lead-fangst |
| `api/generer.js` | `POST /api/generer` – brief → generert side (SSE-streaming) |
| `api/iterer.js` | `POST /api/iterer` – eksisterende side + endring → oppdatert side (SSE) |
| `api/lead.js` | `POST /api/lead` – kontaktinfo + forhåndsvisning → e-post til post@scalemedia.no |
| `lib/prompt.js` | System-prompt + bygging av bruker-prompt (generering & iterasjon) |
| `lib/anthropic.js` | Claude API-klient (fetch + streaming) + kostnadslogging |
| `lib/sse.js` | Felles SSE-strømming til nettleseren |
| `lib/sanitize.js` | Sanitering av brukerinput (prompt injection) + HTML-uttrekk |
| `lib/rate-limit.js` | Per-IP rate limiting (kostnadskontroll) |

### Slik fungerer det

```
Wizard (4 steg) ──▶ POST /api/generer ──▶ Claude (streaming) ──▶ SSE ──▶ sandboxed <iframe>
                                                                            │
   "Mørkere", "Bytt fargetema", fritekst ──▶ POST /api/iterer ─────────────┘
                                                                            │
   "Send på e-post" / "Book møte" ──▶ POST /api/lead ──▶ e-post + kopi til besøkende
```

- Brukeren fyller ut en kort brief (kun bedriftsnavn + bransje + beskrivelse er obligatorisk).
- Backend bygger en prompt og strømmer en komplett, selvstendig HTML-side fra Claude tilbake via Server-Sent Events. Kuraterte statusmeldinger følger faktisk fremdrift.
- Den ferdige siden vises i en **sandboxed iframe** (ingen tilgang til parent, cookies eller backend), med desktop/mobil-veksling.
- Maks 4 gratis iterasjoner per sesjon; deretter nudges brukeren mot å booke et møte.
- **API-nøkkelen ligger kun på serveren** (miljøvariabel `ANTHROPIC_API_KEY`) og sendes aldri til frontend.

---

## Kjøre lokalt

```bash
# 1. Installer avhengigheter
npm install

# 2. Kopier og fyll inn miljøvariabler (minst ANTHROPIC_API_KEY)
cp .env.example .env

# 3a. Enkleste vei – innebygd dev-server (statiske filer + alle API-ruter + SSE)
npm run dev
#    → http://localhost:3000/lag-din-nettside.html

# 3b. Alternativt med Vercel CLI (matcher prod 1:1)
npm install -g vercel
vercel dev
```

`npm run dev` (`node dev-server.js`) laster `.env` automatisk og ruter både statiske filer og API-ene, inkludert streaming.

> Uten `ANTHROPIC_API_KEY` svarer generatoren med en vennlig konfig-feilmelding i stedet for å krasje.

---

## Deploye til Vercel

```bash
vercel          # første gang
vercel --prod   # produksjon
```

Vercel oppdager `api/`-mappen automatisk og deployer funksjonene som serverless endpoints. `vercel.json` setter `maxDuration` til 60 s for generer/iterer (streaming kan ta tid). På Vercel Hobby er 60 s maks; Pro tillater opptil 300 s. Statiske filer serveres fra prosjektroten.

---

## Miljøvariabler

Sett disse i Vercel-dashbordet (Settings → Environment Variables) eller i `.env` lokalt.

### Claude (generatoren)

| Variabel | Standard | Beskrivelse |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | – | **Påkrevd.** Nøkkel fra console.anthropic.com. Forlater aldri backend. |
| `ANTHROPIC_MODEL` | `claude-opus-4-7` | Modell. Opus = maks kvalitet (~2-4 min/side, **krever Vercel Pro**). `claude-sonnet-4-6` = premium (~90-130s, Pro). `claude-haiku-4-5` = rask (~30s, passer gratis Hobby, enklere sider). |
| `MAX_TOKENS` | `18000` | Maks tokens i svaret. Øk hvis sider avkuttes; senk hvis det tar for lang tid. |
| `GENERER_TIMEOUT_MS` | `290000` | Timeout mot Claude i ms. Hold under `maxDuration` i vercel.json (Pro: 300000, Hobby: 60000). |
| `PRICE_IN_PER_MTOK` | `5` | USD per million input-tokens (kun for kostnadslogging; Opus-pris). |
| `PRICE_OUT_PER_MTOK` | `25` | USD per million output-tokens (kun for kostnadslogging; Opus-pris). |
| `RATE_LIMIT_GENERER` | `8` | Maks genereringer per IP per time. |
| `RATE_LIMIT_ITERER` | `20` | Maks iterasjoner per IP per time. |

### SMTP (lead-varsling, delt med SEO-verktøyet)

| Variabel | Eksempel | Beskrivelse |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.sendgrid.net` | SMTP-server |
| `SMTP_PORT` | `587` | SMTP-port (587 for TLS) |
| `SMTP_SECURE` | `false` | `true` for port 465 |
| `SMTP_USER` | `apikey` | SMTP-brukernavn |
| `SMTP_PASS` | `SG.xxx…` | SMTP-passord / API-nøkkel |
| `SMTP_FROM` | `post@scalemedia.no` | Avsender-adresse |
| `LEAD_EMAIL` | `post@scalemedia.no` | Mottaker for leads |

Gratis SMTP-tier: **SendGrid** (100/dag), **Resend** (3 000/mnd), **Brevo** (300/dag).

---

## Justere generatoren

Alt som styrer *hva* og *hvordan* Claude genererer ligger i **`lib/prompt.js`**:

- **Design, tone, struktur, regler** → rediger `SYSTEM_PROMPT`. Her ligger kravene om én selvstendig HTML-fil, 2026-design, ekte norsk salgstekst, bildestrategi (CSS/SVG/gradienter + `picsum.photos` som garantert-trygt fotografi) og injection-forsvar.
- **Hvordan wizard-valgene tolkes** → rediger `SIDETYPE`-, `MAL`- og `STIL`-objektene. Tekstene der mates rett inn i prompten.
- **Bildestrategi** → se «BILDER»-avsnittet i `SYSTEM_PROMPT`.

Andre knapper:

- **Modell / lengde / pris** → miljøvariabler (tabell over) – ingen kodeendring.
- **Rate-grenser** → `RATE_LIMIT_GENERER` / `RATE_LIMIT_ITERER`.
- **Antall gratis iterasjoner** → `MAX_ITERATIONS` øverst i `lag-din-nettside.js`.
- **Anbefalt pakke per sidetype** → `PAKKER`-objektet i `lag-din-nettside.js`.
- **Farger, fonter, knappestiler** → arves fra `style.css` via CSS-variabler (`--primary`, `--secondary` osv.).

---

## Sikkerhet & kostnadskontroll

- **Sandboxed forhåndsvisning**: generert HTML kjøres i `<iframe sandbox="allow-scripts allow-popups">` uten `allow-same-origin` – ingen tilgang til parent, cookies eller backend.
- **Prompt injection**: all brukerinput renses i `lib/sanitize.js` og pakkes i en `<bruker_brief>`-blokk som system-prompten eksplisitt behandler som data, ikke instruksjoner.
- **Rate limiting**: per-IP, glidende timesvindu (`lib/rate-limit.js`). In-memory – godt nok som kostnadsgjerde. For hard global grense på tvers av instanser, bytt Map-en mot Vercel KV / Upstash Redis (samme signatur).
- **Iterasjonsgrense**: maks 4 per sesjon (frontend) + per-IP-grense (backend).
- **Kostnadslogging**: hvert Claude-kall logger én JSON-linje (`tag:"claude-usage"`) med modell, token-bruk, estimert USD-kostnad og varighet – fanges opp i Vercel-loggene.
- **Robusthet**: API-timeout/-feil → retry-knapp; tom/ugyldig brief → vennlig krav om minimum; rate limit → nudge mot møtebooking. Ingen stack traces vises til sluttbruker.

---

## Gratis SEO-analyse

| Fil | Beskrivelse |
|-----|-------------|
| `gratis-seo-analyse.html` / `seo-analyse.css` / `seo-analyse.js` | Frontend |
| `api/seo-analyse.js` | Serverside-analyse (Cheerio), 7 kategorier, ~45 sjekker |
| `api/send-lead.js` | E-post til leads |

Analysen kjøres server-side: normaliserer URL, henter siden + `robots.txt`/`sitemap.xml`, parser HTML med Cheerio, kjører 7 vektede kategorier (On-page 25 %, Teknisk 20 %, Ytelse 15 %, Strukturerte data / Open Graph / Lokal SEO / Innhold 10 % hver) og returnerer norsk JSON. Juster anbefalinger og vekter i `api/seo-analyse.js`.
