'use strict';

const cheerio = require('cheerio');

const WEIGHTS = {
  teknisk:        0.20,
  onpage:         0.25,
  strukturertData: 0.10,
  openGraph:      0.10,
  ytelse:         0.15,
  lokalSeo:       0.10,
  innhold:        0.10
};

async function fetchWithTimeout(url, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ScaleMediaSEOAnalyzer/1.0 (+https://scalemedia.no/gratis-seo-analyse)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.5'
      },
      redirect: 'follow'
    });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ── A. Teknisk SEO ──────────────────────────────────────────────────────────

function analyzeTechnical($, url, parsedUrl, statusCode, finalUrl, htmlSize, robotsStatus, sitemapStatus) {
  const checks = [];
  let earned = 0;

  const isHttps = parsedUrl.protocol === 'https:';
  checks.push({
    id: 'https',
    label: isHttps ? 'HTTPS aktivert' : 'HTTPS mangler',
    status: isHttps ? 'pass' : 'fail',
    description: isHttps
      ? 'Siden kjøres over HTTPS med kryptert forbindelse.'
      : 'Siden bruker ikke HTTPS. Nettlesere merker HTTP-sider som «Ikke sikker».',
    recommendation: isHttps ? null
      : 'Aktiver SSL/TLS-sertifikat. De fleste hostingleverandører tilbyr gratis Let\'s Encrypt-sertifikater. Google bruker HTTPS som rangeringssignal.'
  });
  if (isHttps) earned += 15;

  const statusOk = statusCode === 200;
  const statusRedirect = statusCode >= 300 && statusCode < 400;
  checks.push({
    id: 'statusCode',
    label: `HTTP-statuskode: ${statusCode}`,
    status: statusOk ? 'pass' : statusRedirect ? 'warn' : 'fail',
    description: statusOk
      ? 'Siden returnerer statuskode 200 OK.'
      : statusRedirect
        ? `Siden returnerer en videre­sending (${statusCode}).`
        : `Siden returnerer feilkode ${statusCode} – kan ikke indekseres av søkemotorer.`,
    recommendation: statusOk ? null
      : statusRedirect ? 'Søkemotorer følger videresendinger, men det tapper litt «link juice». Unngå kjedevideresendinger.'
        : `Fiks siden slik at den returnerer 200 OK. En ${statusCode}-feil betyr at siden ikke er tilgjengelig.`
  });
  if (statusOk) earned += 15;
  else if (statusRedirect) earned += 8;

  const viewport = $('meta[name="viewport"]').attr('content');
  checks.push({
    id: 'viewport',
    label: viewport ? 'Mobilvennlig viewport-tag satt' : 'Viewport-tag mangler',
    status: viewport ? 'pass' : 'fail',
    description: viewport
      ? `Viewport er satt: ${viewport}`
      : 'Ingen viewport-tag funnet. Siden vil ikke skalere riktig på mobil.',
    recommendation: viewport ? null
      : 'Legg til <meta name="viewport" content="width=device-width, initial-scale=1.0"> i <head>. Google indekserer mobil-første – uten viewport mister siden rangeringer.'
  });
  if (viewport) earned += 10;

  checks.push({
    id: 'robotsTxt',
    label: robotsStatus === 200 ? 'robots.txt tilgjengelig' : 'robots.txt ikke funnet',
    status: robotsStatus === 200 ? 'pass' : 'warn',
    description: robotsStatus === 200
      ? 'robots.txt ble funnet og er tilgjengelig for søkemotorer.'
      : 'robots.txt ble ikke funnet på forventet sted (/robots.txt).',
    recommendation: robotsStatus === 200 ? null
      : 'Lag en robots.txt på roten av domenet ditt. Minimum: User-agent: *\\nAllow: /\\nSitemap: https://dittdomene.no/sitemap.xml'
  });
  if (robotsStatus === 200) earned += 8;

  checks.push({
    id: 'sitemapXml',
    label: sitemapStatus === 200 ? 'sitemap.xml tilgjengelig' : 'sitemap.xml ikke funnet',
    status: sitemapStatus === 200 ? 'pass' : 'warn',
    description: sitemapStatus === 200
      ? 'sitemap.xml ble funnet og er tilgjengelig.'
      : 'sitemap.xml ble ikke funnet. Søkemotorer kan oppdage innholdet ditt tregere.',
    recommendation: sitemapStatus === 200 ? null
      : 'Generer og publiser en sitemap.xml. De fleste CMS-er har automatisk sitemap-generering. Lever den til Google Search Console.'
  });
  if (sitemapStatus === 200) earned += 8;

  const canonical = $('link[rel="canonical"]').attr('href');
  checks.push({
    id: 'canonical',
    label: canonical ? `Canonical-tag satt` : 'Canonical-tag mangler',
    status: canonical ? 'pass' : 'warn',
    description: canonical
      ? `Canonical peker til: ${canonical}`
      : 'Ingen canonical-tag funnet. URL-duplikater (www/ikke-www, trailing slash) kan splitte rangeringskraft.',
    recommendation: canonical ? null
      : `Legg til <link rel="canonical" href="${url}"> i <head> for å fortelle søkemotorer hvilken URL som er den foretrukne versjonen.`
  });
  if (canonical) earned += 7;
  else earned += 3;

  const sizekB = Math.round(htmlSize / 1024);
  const sizeOk = htmlSize < 500 * 1024;
  checks.push({
    id: 'htmlSize',
    label: `HTML-størrelse: ${sizekB} KB`,
    status: sizeOk ? 'pass' : htmlSize < 1024 * 1024 ? 'warn' : 'fail',
    description: sizeOk
      ? `HTML-størrelsen er ${sizekB} KB – godt innenfor anbefalt grense.`
      : `HTML-størrelsen er ${sizekB} KB. Store HTML-dokumenter gir tregere lasting og parsing.`,
    recommendation: sizeOk ? null
      : 'Flytt inline CSS/JS til eksterne filer. Fjern unødvendige kommentarer og whitespace. Vurder serverside-gzip.'
  });
  if (sizeOk) earned += 5;
  else earned += 2;

  const hadRedirect = finalUrl && url !== finalUrl;
  checks.push({
    id: 'redirect',
    label: hadRedirect ? 'Videre­sending registrert' : 'Ingen unødvendige videre­sendinger',
    status: hadRedirect ? 'warn' : 'pass',
    description: hadRedirect
      ? `Siden ble videresendt fra ${url} til ${finalUrl}.`
      : 'Siden lastes uten videre­sendinger.',
    recommendation: hadRedirect
      ? 'Videresendinger er ofte nødvendige (www → ikke-www), men dobbelt­videresendinger koster lastetid. Sørg for at det kun er én hop.'
      : null
  });
  if (!hadRedirect) earned += 5;

  const max = 73;
  const score = Math.min(100, Math.round((earned / max) * 100));
  return { label: 'Teknisk SEO', score, checks };
}

// ── B. On-page SEO ──────────────────────────────────────────────────────────

function analyzeOnPage($, html, parsedUrl) {
  const checks = [];
  let earned = 0;

  const title = $('title').first().text().trim();
  const titleLen = title.length;
  if (!title) {
    checks.push({ id: 'title', label: 'Sidetittel mangler', status: 'fail',
      description: 'Siden har ingen <title>-tag. Dette er et av de aller viktigste on-page-elementene for SEO.',
      recommendation: 'Legg til en <title> i <head> på 50–60 tegn. Inkluder hoved­søke­ordet og bedriftsnavnet: «Rørlegger i Bergen | Bedriftnavn AS».'
    });
  } else if (titleLen < 30) {
    checks.push({ id: 'title', label: `Sidetittel for kort (${titleLen} tegn)`, status: 'warn',
      description: `Tittelen «${title}» er bare ${titleLen} tegn. Du utnytter ikke hele søkeresultatsfeltet.`,
      recommendation: 'Utvid tittelen til 50–60 tegn med hoved­søke­ordet og eventuelt geografisk angivelse.'
    });
    earned += 6;
  } else if (titleLen > 65) {
    checks.push({ id: 'title', label: `Sidetittel for lang (${titleLen} tegn)`, status: 'warn',
      description: `Tittelen er ${titleLen} tegn. Google avkorter titler over ~60 tegn i søkeresultatene.`,
      recommendation: 'Forkort tittelen til maks 60 tegn og sett det viktigste søke­ordet først.'
    });
    earned += 6;
  } else {
    checks.push({ id: 'title', label: `Sidetittel: god lengde (${titleLen} tegn)`, status: 'pass',
      description: `Tittelen «${title.substring(0, 60)}${titleLen > 60 ? '…' : ''}» har optimal lengde.`,
      recommendation: null
    });
    earned += 10;
  }

  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const descLen = metaDesc.length;
  if (!metaDesc) {
    checks.push({ id: 'metaDesc', label: 'Meta description mangler', status: 'fail',
      description: 'Siden har ingen meta description. Google lager da en automatisk versjon som sjelden er optimal for klikk.',
      recommendation: 'Skriv en meta description på 140–160 tegn med hoved­søke­ordet og et tydelig verdiløfte: «Rørlegger i Bergen – rask respons og erfarne fagfolk. Ring oss for gratis prisestimat.»'
    });
  } else if (descLen < 100) {
    checks.push({ id: 'metaDesc', label: `Meta description for kort (${descLen} tegn)`, status: 'warn',
      description: `Meta description er bare ${descLen} tegn. Du mister verdifull plass i søkeresultatene.`,
      recommendation: 'Utvid til 140–160 tegn med et konkret verdi­løfte og relevante søkeord.'
    });
    earned += 5;
  } else if (descLen > 165) {
    checks.push({ id: 'metaDesc', label: `Meta description for lang (${descLen} tegn)`, status: 'warn',
      description: `Meta description er ${descLen} tegn. Google avkorter tekst over ~160 tegn.`,
      recommendation: 'Forkort meta description til maks 160 tegn.'
    });
    earned += 5;
  } else {
    checks.push({ id: 'metaDesc', label: `Meta description: god lengde (${descLen} tegn)`, status: 'pass',
      description: `Meta description er optimalt ${descLen} tegn.`,
      recommendation: null
    });
    earned += 10;
  }

  const h1s = $('h1');
  const h1Count = h1s.length;
  const h1Text = h1s.first().text().trim();
  if (h1Count === 0) {
    checks.push({ id: 'h1', label: 'H1-overskrift mangler', status: 'fail',
      description: 'Siden har ingen H1-overskrift. H1 er den viktigste innholds­overskriften og et sentralt SEO-signal.',
      recommendation: 'Legg til én H1 som tydelig beskriver sidens hoved­emne. Inkluder hoved­søke­ordet naturlig.'
    });
  } else if (h1Count > 1) {
    checks.push({ id: 'h1', label: `Flere H1-overskrifter (${h1Count} stk)`, status: 'warn',
      description: `Siden har ${h1Count} H1-overskrifter. Beste praksis er én H1 som definerer hoved­emnet.`,
      recommendation: 'Behold den viktigste H1 og konverter de øvrige til H2 eller H3.'
    });
    earned += 5;
  } else {
    checks.push({ id: 'h1', label: `H1: «${h1Text.substring(0, 55)}${h1Text.length > 55 ? '…' : ''}»`, status: 'pass',
      description: 'Siden har én H1-overskrift – ideelt.',
      recommendation: null
    });
    earned += 10;
  }

  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  if (h2Count === 0 && h3Count > 0) {
    checks.push({ id: 'headingHierarchy', label: 'Hopp i overskrifts­hierarki (H3 uten H2)', status: 'warn',
      description: 'Siden bruker H3 uten H2 – et logisk hopp i strukturen.',
      recommendation: 'Strukturer overskrifter: H1 (sidetittel) → H2 (hoved­seksjoner) → H3 (underseksjoner).'
    });
    earned += 2;
  } else if (h2Count > 0) {
    checks.push({ id: 'headingHierarchy', label: `Overskrifts­hierarki: ${h2Count} H2${h3Count > 0 ? `, ${h3Count} H3` : ''}`, status: 'pass',
      description: 'Siden bruker et logisk overskrifts­hierarki.',
      recommendation: null
    });
    earned += 5;
  } else {
    checks.push({ id: 'headingHierarchy', label: 'Mangler seksjons­overskrifter (H2)', status: 'warn',
      description: 'Siden har ingen H2-overskrifter. Seksjons­overskrifter hjelper søkemotorer å forstå innholds­strukturen.',
      recommendation: 'Del innholdet opp med H2-overskrifter for hver hoved­seksjon.'
    });
    earned += 2;
  }

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 1).length;
  if (wordCount < 200) {
    checks.push({ id: 'wordCount', label: `Tynt innhold: ${wordCount} ord`, status: 'fail',
      description: `Siden har bare ${wordCount} ord. Google kan vurdere dette som «tynt innhold».`,
      recommendation: 'Ekspander innholdet til minst 300 ord: tjeneste­beskrivelser, geografiske områder du dekker, og svar på vanlige spørsmål.'
    });
  } else if (wordCount < 400) {
    checks.push({ id: 'wordCount', label: `Begrenset innhold: ${wordCount} ord`, status: 'warn',
      description: `Siden har ${wordCount} ord. For konkurransepreget tematikk anbefales 500+ ord.`,
      recommendation: 'Legg til mer substans: fordeler, FAQ-seksjon, case-studier eller detaljerte tjeneste­beskrivelser.'
    });
    earned += 4;
  } else {
    checks.push({ id: 'wordCount', label: `Godt innholds­volum: ${wordCount} ord`, status: 'pass',
      description: `${wordCount} ord gir søkemotorer god kontekst.`,
      recommendation: null
    });
    earned += 8;
  }

  const images = $('img');
  const totalImages = images.length;
  let missingAlt = 0;
  const missingExamples = [];
  images.each((i, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt === null || alt.trim() === '') {
      missingAlt++;
      if (missingExamples.length < 3) {
        const src = $(el).attr('src') || '';
        missingExamples.push(src.split('/').pop().split('?')[0] || 'ukjent');
      }
    }
  });
  if (totalImages === 0) {
    checks.push({ id: 'altTexts', label: 'Ingen bilder å sjekke', status: 'pass',
      description: 'Ingen bilder funnet – ingen alt-tekst å sjekke.',
      recommendation: null
    });
    earned += 10;
  } else if (missingAlt === 0) {
    checks.push({ id: 'altTexts', label: `Alle ${totalImages} bilder har alt-tekst`, status: 'pass',
      description: 'Samtlige bilder har alt-attributt – bra for tilgjengelighet og bildesøk.',
      recommendation: null
    });
    earned += 10;
  } else {
    const pct = Math.round((missingAlt / totalImages) * 100);
    checks.push({ id: 'altTexts', label: `${missingAlt} av ${totalImages} bilder mangler alt-tekst`, status: missingAlt > totalImages * 0.5 ? 'fail' : 'warn',
      description: `${pct}% av bildene mangler alt-attributt. Eksempler: ${missingExamples.join(', ')}.`,
      recommendation: 'Legg til beskrivende alt-tekst på alle bilder. Bruk naturlig språk: «Rørlegger installerer varmtvannstank i Oslo» fremfor «bilde1.jpg».'
    });
    earned += Math.round(10 * (1 - missingAlt / totalImages));
  }

  const hostname = parsedUrl ? parsedUrl.hostname : '';
  const internalLinks = $('a[href]').filter((i, el) => {
    const href = $(el).attr('href') || '';
    return href.startsWith('/') || (hostname && href.includes(hostname)) || (href.length > 0 && !href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('tel') && !href.startsWith('#'));
  }).length;
  if (internalLinks === 0) {
    checks.push({ id: 'internalLinks', label: 'Ingen interne lenker funnet', status: 'warn',
      description: 'Siden har ingen interne lenker til andre undersider.',
      recommendation: 'Legg til lenker til relevante undersider (tjenester, om oss, kontakt). Interne lenker fordeler rangeringskraft og hjelper søkemotorer å forstå nettstedsstrukturen.'
    });
  } else {
    checks.push({ id: 'internalLinks', label: `${internalLinks} interne lenker`, status: 'pass',
      description: `Siden linker til ${internalLinks} andre sider på nettstedet.`,
      recommendation: null
    });
    earned += 5;
  }

  let extMissingNoopener = 0;
  $('a[href][target="_blank"]').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (href.startsWith('http')) {
      const rel = $(el).attr('rel') || '';
      if (!rel.includes('noopener')) extMissingNoopener++;
    }
  });
  if (extMissingNoopener > 0) {
    checks.push({ id: 'noopener', label: `${extMissingNoopener} lenker mangler rel="noopener"`, status: 'warn',
      description: `${extMissingNoopener} lenker som åpner i ny fane mangler rel="noopener noreferrer".`,
      recommendation: 'Legg til rel="noopener noreferrer" på alle <a target="_blank"> lenker for å forhindre tabnapping-angrep.'
    });
  } else {
    checks.push({ id: 'noopener', label: 'Eksterne lenker: korrekte sikkerhets­attributter', status: 'pass',
      description: 'Alle eksternt-åpnende lenker har riktige sikkerhets­attributter.',
      recommendation: null
    });
    earned += 2;
  }

  const score = Math.min(100, Math.round((earned / 80) * 100));
  return { label: 'On-page SEO', score, checks };
}

// ── C. Strukturerte data ────────────────────────────────────────────────────

function analyzeStructuredData($) {
  const checks = [];
  let earned = 0;

  const jsonLdScripts = $('script[type="application/ld+json"]');
  if (jsonLdScripts.length === 0) {
    checks.push({ id: 'jsonLd', label: 'Ingen strukturerte data funnet', status: 'warn',
      description: 'Siden bruker ikke Schema.org JSON-LD. Strukturerte data kan gi rike søkeresultater (stjerner, FAQ, åpningstider).',
      recommendation: 'Legg til JSON-LD-markup. Minimum for lokal bedrift: LocalBusiness schema med navn, adresse, telefon og åpningstider. Bruk schema.org/LocalBusiness som mal og valider med Google Rich Results Test.'
    });
  } else {
    const types = [];
    const lbTypes = ['LocalBusiness','Organization','MarketingAgency','Restaurant','Store','MedicalOrganization','LegalService','HomeAndConstructionBusiness','AutomotiveBusiness','ProfessionalService'];
    let hasOrgOrLB = false;
    let hasInvalidJson = false;

    jsonLdScripts.each((i, el) => {
      try {
        const raw = $(el).html() || '';
        const data = JSON.parse(raw);
        const extract = (obj) => {
          if (!obj || typeof obj !== 'object') return;
          if (obj['@type']) {
            const t = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
            types.push(...t);
            if (t.some(x => lbTypes.includes(x))) hasOrgOrLB = true;
          }
          for (const v of Object.values(obj)) {
            if (typeof v === 'object') extract(v);
          }
        };
        extract(data);
      } catch {
        hasInvalidJson = true;
      }
    });

    const uniqueTypes = [...new Set(types)];
    checks.push({ id: 'jsonLd', label: `Strukturerte data: ${uniqueTypes.join(', ') || 'ukjent type'}`, status: 'pass',
      description: `${jsonLdScripts.length} JSON-LD blokk(er) med følgende typer: ${uniqueTypes.join(', ') || 'ukjent'}.`,
      recommendation: null
    });
    earned += 20;
    if (uniqueTypes.length > 0) earned += 10;

    if (hasInvalidJson) {
      checks.push({ id: 'jsonLdValid', label: 'Ugyldig JSON-LD funnet', status: 'warn',
        description: 'Ett eller flere JSON-LD-skript inneholder ugyldig JSON og ignoreres av søkemotorer.',
        recommendation: 'Valider JSON-LD med Google Rich Results Test (search.google.com/test/rich-results).'
      });
    }

    if (hasOrgOrLB) {
      checks.push({ id: 'localBusiness', label: 'Organization/LocalBusiness schema satt', status: 'pass',
        description: 'Siden har strukturert data for bedriften – styrker lokal synlighet i Google.',
        recommendation: null
      });
      earned += 15;
    } else {
      checks.push({ id: 'localBusiness', label: 'Mangler Organization/LocalBusiness schema', status: 'warn',
        description: 'Siden har JSON-LD, men mangler schema for selve bedriften.',
        recommendation: 'Legg til LocalBusiness schema med navn, adresse, telefon, e-post og åpnings­tider. Dette gir Google informasjon til Local Pack (kartet i søkeresultatene).'
      });
      earned += 5;
    }
  }

  const score = Math.min(100, Math.round((earned / 45) * 100));
  return { label: 'Strukturerte data', score, checks };
}

// ── D. Open Graph & sosial deling ───────────────────────────────────────────

function analyzeOpenGraph($) {
  const checks = [];
  let earned = 0;

  const fields = [
    { prop: 'og:title',       key: 'ogTitle',    label: 'og:title',       points: 8,  fix: 'Legg til <meta property="og:title" content="Sidens tittel"> i <head>.' },
    { prop: 'og:description', key: 'ogDesc',     label: 'og:description', points: 8,  fix: 'Legg til <meta property="og:description" content="2–3 setninger om siden"> i <head>.' },
    { prop: 'og:image',       key: 'ogImage',    label: 'og:image',       points: 8,  fix: 'Lag et bilde på 1200×630 px og legg til <meta property="og:image" content="https://…/bilde.jpg"> i <head>.' },
    { prop: 'og:url',         key: 'ogUrl',      label: 'og:url',         points: 6,  fix: 'Legg til <meta property="og:url" content="https://dinside.no/side"> i <head>.' },
  ];

  for (const f of fields) {
    const val = $(`meta[property="${f.prop}"]`).attr('content');
    if (val) {
      checks.push({ id: f.key, label: `${f.label} satt`, status: 'pass',
        description: `${f.label}: «${val.substring(0, 80)}${val.length > 80 ? '…' : ''}»`,
        recommendation: null
      });
      earned += f.points;
    } else {
      checks.push({ id: f.key, label: `${f.label} mangler`, status: 'warn',
        description: `Ingen ${f.label} funnet. Deling på Facebook og LinkedIn vil se uprofesjonell ut.`,
        recommendation: f.fix
      });
    }
  }

  const twitterCard = $('meta[name="twitter:card"]').attr('content');
  if (twitterCard) {
    checks.push({ id: 'twitterCard', label: `Twitter Card: ${twitterCard}`, status: 'pass',
      description: 'Twitter/X kortdata er satt.',
      recommendation: null
    });
    earned += 5;
  } else {
    checks.push({ id: 'twitterCard', label: 'Twitter Card mangler', status: 'warn',
      description: 'Ingen Twitter Card-metadata funnet. Deling på X/Twitter viser ikke rik forhånds­visning.',
      recommendation: 'Legg til <meta name="twitter:card" content="summary_large_image"> samt twitter:title, twitter:description og twitter:image.'
    });
  }

  const score = Math.min(100, Math.round((earned / 35) * 100));
  return { label: 'Open Graph & sosial deling', score, checks };
}

// ── E. Ytelse ───────────────────────────────────────────────────────────────

function analyzePerformance($) {
  const checks = [];
  let earned = 0;

  const inlineScripts = $('script:not([src]):not([type="application/ld+json"])').length;
  if (inlineScripts <= 5) {
    checks.push({ id: 'inlineScripts', label: `Inline­skript: ${inlineScripts}`, status: 'pass',
      description: `Siden har ${inlineScripts} inline­skripter – innenfor anbefalt grense.`,
      recommendation: null
    });
    earned += 8;
  } else if (inlineScripts <= 15) {
    checks.push({ id: 'inlineScripts', label: `Mange inline­skript: ${inlineScripts}`, status: 'warn',
      description: `${inlineScripts} inline­skripter øker HTML-størrelsen og vanskeliggjør caching.`,
      recommendation: 'Flytt gjenbrukbar JavaScript til eksterne .js-filer. Nettlesere kan cache disse, mens inline-skript alltid lastes på nytt.'
    });
    earned += 4;
  } else {
    checks.push({ id: 'inlineScripts', label: `Svært mange inline­skript: ${inlineScripts}`, status: 'fail',
      description: `${inlineScripts} inline­skripter er uvanlig mye og skader ytelsen.`,
      recommendation: 'Konsolider inline-skriptene til én eller to bundlede .js-filer.'
    });
  }

  const extCss = $('link[rel="stylesheet"]').length;
  const extJs  = $('script[src]').length;
  const extTotal = extCss + extJs;
  if (extTotal <= 8) {
    checks.push({ id: 'externalResources', label: `Eksterne ressurser: ${extTotal} (${extCss} CSS, ${extJs} JS)`, status: 'pass',
      description: 'Antall eksterne CSS/JS-filer er under kontroll.',
      recommendation: null
    });
    earned += 8;
  } else if (extTotal <= 20) {
    checks.push({ id: 'externalResources', label: `Mange eksterne ressurser: ${extTotal}`, status: 'warn',
      description: `${extTotal} CSS/JS-filer krever ${extTotal} separate nettverks­forespørsler.`,
      recommendation: 'Vurder å bundle og minifisere CSS/JS-filer. Bruk HTTP/2 og nettleser­caching.'
    });
    earned += 4;
  } else {
    checks.push({ id: 'externalResources', label: `Svært mange externe ressurser: ${extTotal}`, status: 'fail',
      description: `${extTotal} CSS/JS-filer kan vesentlig bremse Largest Contentful Paint.`,
      recommendation: 'Bundle til færre filer. Fjern ubrukte CSS/JS og evaluer nødvendigheten av hvert tredjeparts­skript.'
    });
  }

  const imgSrcs = [];
  $('img[src], source[srcset]').each((i, el) => {
    imgSrcs.push($(el).attr('src') || $(el).attr('srcset') || '');
  });
  const modernCount = imgSrcs.filter(s => /\.(webp|avif)/i.test(s)).length;

  if (imgSrcs.length === 0) {
    earned += 7;
  } else if (modernCount === 0) {
    checks.push({ id: 'modernImages', label: 'Ingen moderne bildformater (WebP/AVIF)', status: 'warn',
      description: 'Ingen bilder bruker WebP eller AVIF – disse formatene er typisk 25–50 % lettere enn JPEG/PNG.',
      recommendation: 'Konverter bilder til WebP via Squoosh.app (gratis). Bruk <picture> med <source type="image/webp"> for bakoverkompatibilitet.'
    });
    earned += 2;
  } else {
    const allModern = modernCount === imgSrcs.length;
    checks.push({ id: 'modernImages', label: `Moderne bildformater: ${modernCount} av ${imgSrcs.length}`, status: allModern ? 'pass' : 'warn',
      description: `${modernCount} av ${imgSrcs.length} bilder bruker WebP eller AVIF.`,
      recommendation: allModern ? null : 'Konverter resterende bilder til WebP for bedre ytelse.'
    });
    earned += allModern ? 7 : 4;
  }

  const imgTotal = $('img').length;
  const imgLazy  = $('img[loading="lazy"]').length;
  if (imgTotal === 0) {
    earned += 5;
  } else if (imgLazy === 0) {
    checks.push({ id: 'lazyLoading', label: 'Lazy loading ikke aktivert', status: 'warn',
      description: 'Ingen bilder bruker loading="lazy". Alle lastes ved sideåpning, selv de utenfor skjermen.',
      recommendation: 'Legg til loading="lazy" på alle bilder som ikke er synlige i det initiale skjerm­bildet. Nettlesere støtter dette nativt.'
    });
    earned += 2;
  } else {
    const ratio = imgLazy / imgTotal;
    checks.push({ id: 'lazyLoading', label: `Lazy loading: ${imgLazy} av ${imgTotal} bilder`, status: ratio >= 0.7 ? 'pass' : 'warn',
      description: `${imgLazy} av ${imgTotal} bilder bruker lazy loading.`,
      recommendation: ratio >= 0.7 ? null : 'Vurder loading="lazy" på alle bilder som ikke er synlige ved sideinnlastning.'
    });
    earned += ratio >= 0.7 ? 7 : 4;
  }

  const rbJs = $('head script[src]').not('[async]').not('[defer]').length;
  if (rbJs > 3) {
    checks.push({ id: 'renderBlocking', label: `${rbJs} render-blokkerende skript i <head>`, status: 'warn',
      description: `${rbJs} JavaScript-filer i <head> uten async/defer blokkerer HTML-parsing.`,
      recommendation: 'Legg til defer-attributtet: <script src="…" defer>. For uavhengige skript kan async brukes.'
    });
  } else {
    checks.push({ id: 'renderBlocking', label: `Få render-blokkerende ressurser (${rbJs})`, status: 'pass',
      description: `${rbJs} render-blokkerende JS-filer i <head> – innenfor anbefalt grense.`,
      recommendation: null
    });
    earned += 5;
  }

  const score = Math.min(100, Math.round((earned / 35) * 100));
  return { label: 'Ytelse', score, checks };
}

// ── F. Lokal SEO ────────────────────────────────────────────────────────────

function analyzeLocalSeo($) {
  const checks = [];
  let earned = 0;

  const lang = $('html').attr('lang') || '';
  const isNo  = /^(no|nb|nn)/i.test(lang);
  if (!lang) {
    checks.push({ id: 'lang', label: 'Ingen language-attributt', status: 'warn',
      description: '<html>-tagen mangler lang-attributt. Søkemotorer kan ikke verifisere sidens språk.',
      recommendation: 'Legg til lang="nb" (norsk bokmål) eller lang="no" på <html>-elementet.'
    });
  } else if (isNo) {
    checks.push({ id: 'lang', label: `Norsk språkkode: lang="${lang}"`, status: 'pass',
      description: 'Siden er korrekt markert som norskspråklig.',
      recommendation: null
    });
    earned += 10;
  } else {
    checks.push({ id: 'lang', label: `Ikke-norsk språkkode: lang="${lang}"`, status: 'warn',
      description: `Siden er markert som ${lang}-språklig, men innholdet er norsk.`,
      recommendation: 'Endre lang-attributtet til "nb" for norsk bokmål.'
    });
    earned += 3;
  }

  const bodyText = $('body').text();
  const hasPostal = /\b\d{4}\s+[A-ZÆØÅ][a-zæøå]+/.test(bodyText);
  if (hasPostal) {
    const m = bodyText.match(/\b\d{4}\s+[A-ZÆØÅ][a-zæøå]+/);
    checks.push({ id: 'address', label: `Adresse synlig på siden`, status: 'pass',
      description: `Norsk postnummer funnet: ${m ? m[0] : ''}.`,
      recommendation: null
    });
    earned += 10;
  } else {
    checks.push({ id: 'address', label: 'Adresse ikke funnet', status: 'warn',
      description: 'Ingen norsk postnummer funnet i synlig innhold. Lokal SEO styrkes av at adressen er tydelig tilgjengelig.',
      recommendation: 'Legg til bedriftens fulle adresse (gate, postnummer, by) i footeren eller på kontaktsiden.'
    });
  }

  const hasPhone = /(\+47[\s.-]?)?(\b\d{3}[\s.-]?\d{2}[\s.-]?\d{3}\b|\b\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}\b)/.test(bodyText);
  if (hasPhone) {
    checks.push({ id: 'phone', label: 'Telefonnummer synlig', status: 'pass',
      description: 'Telefonnummer er synlig på siden.',
      recommendation: null
    });
    earned += 10;
  } else {
    checks.push({ id: 'phone', label: 'Telefonnummer ikke funnet', status: 'warn',
      description: 'Ingen gjenkjennelig norsk telefon­nummer funnet i innholdet.',
      recommendation: 'Legg til et klikkbart telefonnummer (<a href="tel:12345678">) – særlig viktig for mobile brukere som er klare til å ringe.'
    });
  }

  const cities = ['oslo','bergen','trondheim','stavanger','kristiansand','drammen','fredrikstad','tromsø','sandnes','ålesund','kokstad','vestland','hordaland','rogaland','nordland','møre','telemark','innlandet','agder'];
  const bodyLow = bodyText.toLowerCase();
  const foundCity = cities.find(c => bodyLow.includes(c));
  if (foundCity) {
    checks.push({ id: 'geoArea', label: `Geografisk område nevnt: ${foundCity.charAt(0).toUpperCase() + foundCity.slice(1)}`, status: 'pass',
      description: 'Siden nevner et norsk geografisk område – styrker lokal synlighet.',
      recommendation: null
    });
    earned += 5;
  } else {
    checks.push({ id: 'geoArea', label: 'Geografisk område ikke funnet', status: 'warn',
      description: 'Siden nevner ikke et tydelig norsk geografisk område.',
      recommendation: 'Legg til geografisk kontekst naturlig i teksten: «rørlegger i Bergen» eller «vi betjener hele Vestlandet».'
    });
  }

  const score = Math.min(100, Math.round((earned / 35) * 100));
  return { label: 'Lokal SEO', score, checks };
}

// ── G. Innholdskvalitet ─────────────────────────────────────────────────────

function analyzeContent($) {
  const checks = [];
  let earned = 0;

  const rawHtml = $.html();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const ratio = rawHtml.length > 0 ? (bodyText.length / rawHtml.length) * 100 : 0;

  if (ratio >= 15) {
    checks.push({ id: 'textRatio', label: `Tekst/HTML-forhold: ${ratio.toFixed(0)}%`, status: 'pass',
      description: `${ratio.toFixed(0)}% av HTML-koden er synlig tekst – et godt forhold.`,
      recommendation: null
    });
    earned += 10;
  } else if (ratio >= 6) {
    checks.push({ id: 'textRatio', label: `Lavt tekst/HTML-forhold: ${ratio.toFixed(0)}%`, status: 'warn',
      description: `Bare ${ratio.toFixed(0)}% av siden er synlig tekst. Siden kan ha mye kode relativt til innhold.`,
      recommendation: 'Vurder å redusere inline CSS/JS og øke mengden meningsfullt tekstinnhold.'
    });
    earned += 5;
  } else {
    checks.push({ id: 'textRatio', label: `Svært lavt tekst/HTML-forhold: ${ratio.toFixed(0)}%`, status: 'warn',
      description: `Bare ${ratio.toFixed(0)}% av siden er synlig tekst. Siden kan være JavaScript-rendret (tom HTML ved scraping).`,
      recommendation: 'Sjekk om nettstedet bruker et JS-rammeverk (React, Vue, Angular) uten server-side rendering. Slike sider kan ha utfordringer med søkemotorindeksering.'
    });
    earned += 2;
  }

  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 15);
  const avgWords = sentences.length > 3
    ? sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length
    : 0;

  if (sentences.length < 5) {
    checks.push({ id: 'sentences', label: 'For lite tekst til setningsanalyse', status: 'warn',
      description: 'For lite tekst til å analysere setningslengde reliabelt.',
      recommendation: null
    });
    earned += 4;
  } else if (avgWords <= 20) {
    checks.push({ id: 'sentences', label: `God setningslengde: ~${Math.round(avgWords)} ord/setning`, status: 'pass',
      description: `Gjennomsnittlig ${Math.round(avgWords)} ord per setning – god lesbarhet.`,
      recommendation: null
    });
    earned += 8;
  } else if (avgWords <= 28) {
    checks.push({ id: 'sentences', label: `Noe lange setninger: ~${Math.round(avgWords)} ord/setning`, status: 'warn',
      description: `Gjennomsnittlig ${Math.round(avgWords)} ord per setning er over anbefalt grense på 20.`,
      recommendation: 'Del opp lange setninger. Kortere setninger er lettere å lese og gir bedre lesbarhetsscore.'
    });
    earned += 4;
  } else {
    checks.push({ id: 'sentences', label: `Lange setninger: ~${Math.round(avgWords)} ord/setning`, status: 'warn',
      description: `Gjennomsnittlig ${Math.round(avgWords)} ord per setning er høyt. Lange setninger reduserer lesbarhet.`,
      recommendation: 'Mål for maks 20 ord per setning. Bruk punktlister for oppramsinger.'
    });
    earned += 2;
  }

  const btnCount = $('button, input[type="submit"], input[type="button"]').length;
  const ctaWords = ['kontakt','ring','bestill','book','send','les mer','finn ut','kom i gang','prøv','last ned','registrer','kjøp','order','få tilbud','klikk'];
  const ctaLinkCount = $('a').filter((i, el) => {
    const text = $(el).text().toLowerCase();
    return ctaWords.some(w => text.includes(w));
  }).length;
  const totalCtas = btnCount + ctaLinkCount;

  if (totalCtas === 0) {
    checks.push({ id: 'cta', label: 'Ingen tydelige handlings­oppfordringer funnet', status: 'warn',
      description: 'Siden ser ikke ut til å ha tydelige CTA-er (knapper eller lenker med handlingsverb).',
      recommendation: 'Legg til CTA-er som «Book gratis møte», «Ring oss», «Be om tilbud». CTA-er driver konverteringer.'
    });
  } else {
    checks.push({ id: 'cta', label: `${totalCtas} handlings­oppfordringer funnet`, status: 'pass',
      description: `Siden har ${btnCount} knapper og ${ctaLinkCount} CTA-lenker.`,
      recommendation: null
    });
    earned += 7;
  }

  const words = bodyText.split(/\s+/).filter(w => w.length > 1).length;
  if (words >= 500) {
    checks.push({ id: 'contentDepth', label: `Substantielt innhold: ${words} ord`, status: 'pass',
      description: `${words} ord gir søkemotorer god kontekst for å forstå sidens emne.`,
      recommendation: null
    });
    earned += 10;
  } else if (words >= 300) {
    checks.push({ id: 'contentDepth', label: `Moderat innhold: ${words} ord`, status: 'warn',
      description: `${words} ord er tilstrekkelig, men for konkurransepreget tematikk anbefales mer dybde.`,
      recommendation: 'Utvid med FAQ-seksjoner, tjeneste­detaljer eller case-studier for å øke informasjons­verdien.'
    });
    earned += 5;
  } else {
    checks.push({ id: 'contentDepth', label: `Lite innhold: ${words} ord`, status: 'fail',
      description: `${words} ord er under anbefalt minimum for SEO.`,
      recommendation: 'Tynt innhold underpresterer i søk. Legg til substantielt innhold som besvarer brukerens spørsmål og dekker relevante søketermer.'
    });
  }

  const score = Math.min(100, Math.round((earned / 35) * 100));
  return { label: 'Innholdskvalitet', score, checks };
}

// ── Rapport-sammensetning ───────────────────────────────────────────────────

function getTopFixes(categories) {
  const all = [];
  for (const cat of Object.values(categories)) {
    for (const check of cat.checks) {
      if ((check.status === 'fail' || check.status === 'warn') && check.recommendation) {
        all.push({ label: check.label, recommendation: check.recommendation, category: cat.label, severity: check.status === 'fail' ? 2 : 1 });
      }
    }
  }
  all.sort((a, b) => b.severity - a.severity);
  return all.slice(0, 3);
}

function generateSummary(categories, overallScore) {
  const sorted = Object.values(categories).sort((a, b) => a.score - b.score);
  const weakest  = sorted[0];
  const strongest = sorted[sorted.length - 1];

  if (overallScore >= 75) {
    return `Siden har et solid SEO-fundament (${overallScore}/100). Sterkest: ${strongest.label} (${strongest.score}/100). Å forbedre ${weakest.label} (${weakest.score}/100) vil gi størst løft.`;
  } else if (overallScore >= 50) {
    return `Siden er på rett vei, men har tydelige forbedringspunkter (${overallScore}/100). ${weakest.label} (${weakest.score}/100) er det området som vil gi størst synlighetsøkning om det prioriteres nå.`;
  }
  return `Siden har grunnleggende SEO-problemer som bremser synligheten i søk (${overallScore}/100). Start med de kritiske funnene under – de gir størst effekt per arbeidstime.`;
}

// ── Serverless handler ──────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode ikke tillatt' });

  const body = req.body || {};
  const rawUrl = String(body.url || '').trim();

  if (!rawUrl) return res.status(400).json({ error: 'URL er påkrevd' });

  let url = rawUrl;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let parsedUrl;
  try { parsedUrl = new URL(url); }
  catch { return res.status(400).json({ error: 'Ugyldig URL. Sjekk at du har skrevet inn en gyldig nettadresse.' }); }

  let html = '', statusCode = 0, finalUrl = url;

  try {
    const resp = await fetchWithTimeout(url);
    statusCode = resp.status;
    finalUrl   = resp.url;
    html       = await resp.text();
  } catch (err) {
    const msg = String(err.message || '');
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Tidsavbrudd: Siden svarte ikke innen 12 sekunder. Prøv igjen.' });
    }
    if (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED')) {
      return res.status(400).json({ error: 'Klarte ikke å nå nettsiden. Sjekk at domenet er riktig skrevet.' });
    }
    return res.status(400).json({ error: 'Kunne ikke hente nettsiden. Siden kan blokkere automatiserte forespørsler (f.eks. Cloudflare).' });
  }

  const $ = cheerio.load(html);
  const bodyTextLen = $('body').text().replace(/\s+/g, '').length;
  const isLikelyJsRendered = bodyTextLen < 150 && html.length > 1000;

  let robotsStatus = 0, sitemapStatus = 0;
  await Promise.all([
    fetchWithTimeout(`${parsedUrl.origin}/robots.txt`, 5000).then(r => { robotsStatus = r.status; }).catch(() => {}),
    fetchWithTimeout(`${parsedUrl.origin}/sitemap.xml`, 5000).then(r => { sitemapStatus = r.status; }).catch(() => {})
  ]);

  const htmlSize = Buffer.byteLength(html, 'utf8');

  const teknisk        = analyzeTechnical($, url, parsedUrl, statusCode, finalUrl, htmlSize, robotsStatus, sitemapStatus);
  const onpage         = analyzeOnPage($, html, parsedUrl);
  const strukturertData = analyzeStructuredData($);
  const openGraph      = analyzeOpenGraph($);
  const ytelse         = analyzePerformance($);
  const lokalSeo       = analyzeLocalSeo($);
  const innhold        = analyzeContent($);

  const categories = { teknisk, onpage, strukturertData, openGraph, ytelse, lokalSeo, innhold };

  const overallScore = Math.round(
    teknisk.score        * WEIGHTS.teknisk +
    onpage.score         * WEIGHTS.onpage +
    strukturertData.score * WEIGHTS.strukturertData +
    openGraph.score      * WEIGHTS.openGraph +
    ytelse.score         * WEIGHTS.ytelse +
    lokalSeo.score       * WEIGHTS.lokalSeo +
    innhold.score        * WEIGHTS.innhold
  );

  return res.status(200).json({
    url,
    finalUrl,
    timestamp: new Date().toISOString(),
    title:   $('title').first().text().trim(),
    metaDesc: $('meta[name="description"]').attr('content') || '',
    overallScore,
    summary: generateSummary(categories, overallScore),
    topFixes: getTopFixes(categories),
    isLikelyJsRendered,
    categories
  });
};
