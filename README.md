# ScaleMedia – Gratis SEO-analysetjeneste

Sanntids SEO-analyseverktøy for scalemedia.no. Fungerer som en leadmagnet og leverer reell, handlingsorientert verdi uten e-postvegg.

## Hva er inkludert

| Fil | Beskrivelse |
|-----|-------------|
| `gratis-seo-analyse.html` | Frontend-side |
| `seo-analyse.css` | Stiler for analysesiden |
| `seo-analyse.js` | Frontend-JavaScript |
| `api/seo-analyse.js` | Serverless-funksjon: analyse-API |
| `api/send-lead.js` | Serverless-funksjon: e-post til leads |
| `package.json` | Node.js-avhengigheter |
| `vercel.json` | Vercel-konfigurasjon |
| `.env.example` | Mal for miljøvariabler |

## Kjøre lokalt

```bash
# Installer avhengigheter
npm install

# Installer Vercel CLI (én gang)
npm install -g vercel

# Kopier og fyll inn miljøvariabler
cp .env.example .env

# Start dev-server (håndterer både statiske filer og API-ruter)
vercel dev
```

Åpne `http://localhost:3000/gratis-seo-analyse.html`

## Deploye til Vercel

```bash
# Første gang
vercel

# Produksjon
vercel --prod
```

Vercel oppdager automatisk `api/`-mappen og deployer funksjonene som serverless endpoints.
Statiske filer serveres fra prosjektroten.

## Miljøvariabler

Sett disse i Vercel-dashboardet (Settings → Environment Variables):

| Variabel | Eksempel | Beskrivelse |
|----------|---------|-------------|
| `SMTP_HOST` | `smtp.sendgrid.net` | SMTP-server for utgående e-post |
| `SMTP_PORT` | `587` | SMTP-port (vanligvis 587 for TLS) |
| `SMTP_SECURE` | `false` | `true` for port 465, ellers `false` |
| `SMTP_USER` | `apikey` | SMTP-brukernavn |
| `SMTP_PASS` | `SG.xxx...` | SMTP-passord eller API-nøkkel |
| `SMTP_FROM` | `post@scalemedia.no` | Avsender-adresse |
| `LEAD_EMAIL` | `post@scalemedia.no` | Mottaker-adresse for leads |

### Anbefalte SMTP-leverandører (gratis tier)

- **SendGrid** – 100 e-poster/dag gratis. Bruk `apikey` som SMTP_USER og API-nøkkelen som SMTP_PASS.
- **Resend** – 3 000 e-poster/mnd gratis. SMTP eller direkte API.
- **Brevo (Sendinblue)** – 300 e-poster/dag gratis.

## Koble til fra forsiden

Legg til en CTA i `index.html` for å lenke til analysetjenesten:

```html
<a href="gratis-seo-analyse.html" class="btn btn-primary">
  Få gratis SEO-analyse →
</a>
```

Legg gjerne til en ny nav-lenke:

```html
<li><a href="gratis-seo-analyse.html">SEO-analyse</a></li>
```

## Endre tekster og branding

- **Sidetittel / meta-tekster**: øverst i `gratis-seo-analyse.html`
- **Anbefalings­tekster i analysen**: i `api/seo-analyse.js` – søk etter `recommendation:`
- **Score-vekter**: `WEIGHTS`-objektet øverst i `api/seo-analyse.js`
- **Farger og typografi**: arves fra `style.css` via CSS-variabler (`--primary`, `--secondary`, osv.)

## Slik fungerer analysen

Analysen kjøres helt server-side for å unngå CORS og beskytte logikken. Den:

1. Normaliserer og validerer URL-en
2. Henter siden med en User-Agent som identifiserer seg som ScaleMedias bot
3. Henter `robots.txt` og `sitemap.xml` parallelt
4. Parser HTML med Cheerio
5. Kjører 7 analyse-kategorier med totalt ~45 enkeltsjekk
6. Beregner vektet score og genererer norsk oppsummering
7. Returnerer strukturert JSON til frontend

**Kategorier og vekter:**

| Kategori | Vekt |
|----------|------|
| On-page SEO | 25% |
| Teknisk SEO | 20% |
| Ytelse | 15% |
| Strukturerte data | 10% |
| Open Graph | 10% |
| Lokal SEO | 10% |
| Innholdskvalitet | 10% |
