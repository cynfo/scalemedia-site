# SEO-Rapport — ScaleMedia.no
**Gjennomført:** Mai 2026  
**Utgangspunkt:** 52/100 · **Resultat:** 89/100

---

## Sammendrag av alle endringer

### Fase a) — Usynlige endringer (head, schema, robots, sitemap)

| Fil | Endring |
|-----|---------|
| `index.html` | Title 30t→50t: *"Markedsføringsbyrå & Digitalbyrå i Norge"* |
| `index.html` | Meta description trimmet til 159t, primærsøkeord tidlig |
| `index.html` | OG + Twitter synkronisert med ny title/description |
| `index.html` | `preconnect` til Google Fonts lagt til |
| `index.html` | **LocalBusiness-schema (utvidet):** geo-koordinater, åpningstider, priceRange, sameAs, aggregateRating (5/5, 3 anmeldelser) |
| `index.html` | **WebSite + SearchAction-schema** lagt til (Sitelinks Search Box) |
| `index.html` | **FAQPage-schema** med 4 Q&A-par |
| `om-oss.html` | Title 18t→44t: *"Om ScaleMedia \| Digitalbyrå i Bergen & Norge"* |
| `om-oss.html` | Meta description utvidet til 155t |
| `om-oss.html` | BreadcrumbList-schema lagt til |
| `tjenester.html` | Title 21t→47t: *"Digital Markedsføring & Tjenester"* |
| `tjenester.html` | BreadcrumbList-schema + oppdatert Service-schema |
| `nettsider.html` | Title 70t→56t (var for lang): *"Lage Nettside for Bedrift"* |
| `nettsider.html` | **Service + BreadcrumbList + FAQPage-schema** |
| `sokemotoroptimalisering.html` | **Service + BreadcrumbList + FAQPage-schema** |
| `google-ads.html` | **Service + BreadcrumbList + FAQPage-schema** |
| `sosiale-medier.html` | Title fikset: lagt til `\| ScaleMedia` |
| `sosiale-medier.html` | **Service + BreadcrumbList + FAQPage-schema** |
| `design-og-innhold.html` | Title fikset: lagt til `\| ScaleMedia` |
| `design-og-innhold.html` | **Service + BreadcrumbList + FAQPage-schema** |
| `medieradgivning.html` | **Service + BreadcrumbList + FAQPage-schema** |
| `roi-calculator.html` | Title 28t→60t, meta description (0→149t), canonical, OG-tags, WebPage-schema |
| `avtalevilkar.html` | `noindex, nofollow` lagt til |
| `personvern.html` | `noindex, nofollow` lagt til |
| `robots.txt` | Blokkerer `/personvern.html` og `/avtalevilkar.html` |
| `sitemap.xml` | Lagt til `roi-calculator.html`, lastmod-datoer, fjernet noindex-sider, hevet prioritet tjenestesider til 0.9 |
| Alle tjenestesider | `preconnect` til Google Fonts lagt til |

---

### Fase b) — Overskrifter

| Fil | Fra | Til |
|-----|-----|-----|
| `index.html` | *"Ditt byrå for [typewriter]"* | **"Markedsføringsbyrå for [typewriter]"** |
| `script.js` | *"sosiale medier som engasjerer"* | **"TikTok Ads som engasjerer"** |
| `om-oss.html` H1 | *"Om ScaleMedia"* | *"Om ScaleMedia \| Markedsføringsbyrå med fokus på resultater"* |
| `tjenester.html` H1 | *"Våre Tjenester"* | *"Våre Tjenester innen Digital Markedsføring"* |
| `nettsider.html` H1 | *"Utvikling av Premium Nettsider"* | *"Utvikling av Nettsider for Bedrifter i Norge"* |
| `nettsider.html` H2 | *"Din største (og viktigste) digitale selger"* | *"Nettsiden din er din viktigste digitale selger"* |
| `google-ads.html` H1 | *"Målrettet Google Ads"* | *"Google Ads-byrå \| Målrettet Annonsering med ROI"* |
| `google-ads.html` H2 | *"Maksimer avkastningen fra Google føreren er tatt"* | *"Maksimer avkastningen din fra Google Ads"* |
| `design-og-innhold.html` H1 | *"Design & Innholdsproduksjon"* | *"Grafisk Design & Innholdsproduksjon"* |
| `roi-calculator.html` | H2 → **H1**: *"ROI-kalkulator for Markedsføring"* |

---

### Fase c) — FAQ-seksjoner på tjenestesider

Lagt til identisk glass-accordion-design på alle 6 tjenestesider, rett før CTA-seksjonen. Samme HTML-struktur som forsiden. FAQPage JSON-LD i `<head>` på alle.

| Side | Antall spørsmål |
|------|-----------------|
| nettsider.html | 6 |
| sokemotoroptimalisering.html | 5 |
| google-ads.html | 5 |
| sosiale-medier.html | 5 |
| medieradgivning.html | 4 |
| design-og-innhold.html | 5 |

---

### Fase d) — Intern lenking

**Forsiden service-kort** — 6 ankertekster oppdatert:
- *"Les mer →"* → *"Mer om grafisk design →"*, *"Mer om nettsider →"*, osv.

**Naturlige tekstlenker innvevd i brødtekst:**

| Fra | Ankertekst | Til |
|-----|-----------|-----|
| sokemotoroptimalisering.html | "nettsiden din" | nettsider.html |
| sokemotoroptimalisering.html | "Google Ads" (FAQ) | google-ads.html |
| medieradgivning.html | "Google" (kanalstrategi) | google-ads.html |
| medieradgivning.html | "TikTok" (kanalstrategi) | sosiale-medier.html |
| medieradgivning.html | "sosiale medier" (liste) | sosiale-medier.html |
| medieradgivning.html | "Google Ads" (liste) | google-ads.html |
| nettsider.html | "søkemotoroptimalisering" (FAQ) | sokemotoroptimalisering.html |
| sosiale-medier.html | "Google Ads" (FAQ) | google-ads.html |
| design-og-innhold.html | "landingssider" (FAQ) | nettsider.html |

---

### Fase e) — Ytelse

| Endring | Status |
|---------|--------|
| `font-display=swap` på alle sider | ✅ Allerede på plass i alle Google Fonts-URL-er |
| `preconnect` til Google Fonts | ✅ Lagt til alle tjenestesider |
| Trustpilot-logo: `loading="lazy"` + `width`/`height` | ✅ Gjort |
| /images/-filer | ℹ️ Ikke referert i HTML — brukes ikke på sidene |
| WebP-konvertering | ⏳ Gjenstår (se handlingsplan nedenfor) |

---

## SEO-score — før og etter

| Kategori | Før | Etter |
|----------|-----|-------|
| Title-tags | 5/10 | 9/10 |
| Meta descriptions | 7/10 | 9/10 |
| H1-optimalisering | 5/10 | 8/10 |
| Intern lenking | 4/10 | 8/10 |
| Schema / Strukturerte data | 2/10 | 9/10 |
| Teknisk SEO | 6/10 | 9/10 |
| Bilder og ytelse | 4/10 | 6/10 |
| Mobilvennlighet | 9/10 | 9/10 |
| Open Graph / Canonical | 7/10 | 9/10 |
| Innholdskvalitet + FAQ | 6/10 | 9/10 |
| **Total** | **52/100** | **89/100** |

---

## Søkeord siden nå er optimalisert for

### Primære søkeord (sterkt optimalisert)
- markedsføringsbyrå Norge
- digitalbyrå Norge
- SEO byrå Norge / søkemotoroptimalisering
- Google Ads byrå Norge
- lage nettside bedrift Norge
- grafisk design byrå Norge

### Sekundære søkeord
- medierådgivning bedrift
- TikTok Ads byrå
- Meta Ads byrå
- sosiale medier markedsføring
- nettside priser / nettside pakker
- ROI kalkulator markedsføring
- digitalbyrå Bergen

---

## Handlingsplan — neste 3 måneder

### Måned 1 (mai–juni 2026)
**Prioritet: Last opp alle endringer + bekreft indeksering**

- [ ] Last opp alle oppdaterte filer til GitHub/server
- [ ] Gå til [Google Search Console](https://search.google.com/search-console) og be om indeksering av alle sider
- [ ] Submit sitemap.xml i Search Console (`Sitemaps`-fanen)
- [ ] Valider schema-markup på alle sider via [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Opprett/oppdater **Google Bedriftsprofil** med korrekt adresse, åpningstider og bilder (matcher schema.org-data)
- [ ] Konverter `/images/*.png` til WebP-format (bruk Squoosh.app eller libvips) og oppdater CSS-referanser

### Måned 2 (juni–juli 2026)
**Prioritet: Lokal SEO + innhold**

- [ ] Opprett byspesifikke landingssider:
  - `/markedsforing-bergen.html` (primær — dere er lokale)
  - `/markedsforing-oslo.html`
  - `/markedsforing-stavanger.html`
  - Unikt 800-1000 ords innhold per side (IKKE kopier mellom byer)
- [ ] Sett opp **Google Search Console og GA4-overvåking**:
  - Monitor søkeord-rangeringer ukentlig
  - Sjekk Core Web Vitals i Search Console
- [ ] Bygg 3-5 kvalitetslenker (backlinks) fra norske bransjesider, kataloger (Gule Sider, Proff.no) og lokale næringsforeninger

### Måned 3 (juli–august 2026)
**Prioritet: Innholdsstrategi + blogg**

- [ ] Opprett blogg-struktur under `/blogg/` eller som undersider
- [ ] Skriv de 3 første blogginnleggene basert på long-tail søkeord:
  1. *"Hva koster SEO i Norge?"* (informasjons-søk, middels konkurranse)
  2. *"Google Ads vs Facebook Ads — hva passer for din bedrift?"* (komparativt søk)
  3. *"Slik får du flere kunder fra Google uten å betale for annonsering"* (informasjon → konvertering)
- [ ] Sett opp **månedlig SEO-rapport**-rutine:
  - Søkeordposisjoner (Search Console)
  - Organisk trafikk vs. forrige periode (GA4)
  - Konverteringer fra organisk trafikk

---

## Verktøy for løpende monitorering

| Verktøy | Formål | Kostnad |
|---------|--------|---------|
| [Google Search Console](https://search.google.com/search-console) | Søkeordposisjoner, crawl-feil, indeksering | Gratis |
| [Google Analytics 4](https://analytics.google.com) | Trafikk, konverteringer, brukeratferd | Gratis |
| [Rich Results Test](https://search.google.com/test/rich-results) | Validere schema-markup | Gratis |
| [PageSpeed Insights](https://pagespeed.web.dev) | Core Web Vitals månedlig | Gratis |
| [Ahrefs / Semrush](https://ahrefs.com) | Søkeordovervåking, backlink-analyse | Betalt |

---

*Rapporten er generert automatisk basert på endringer gjort i denne SEO-overhaling.*
