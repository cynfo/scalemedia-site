'use strict';

(function () {

  /* ── DOM-referanser ─────────────────────────────────────────────────────── */

  const urlForm       = document.getElementById('seo-url-form');
  const urlInput      = document.getElementById('seo-url-input');
  const analyseBtn    = document.getElementById('seo-analyse-btn');

  const inputSection  = document.getElementById('input-section');
  const loadingSection= document.getElementById('loading-section');
  const reportSection = document.getElementById('report-section');
  const errorBox      = document.getElementById('error-box');
  const errorMsg      = document.getElementById('error-msg');

  const scoreFill     = document.getElementById('score-fill');
  const scoreNum      = document.getElementById('score-num');
  const summaryText   = document.getElementById('summary-text');
  const jsNotice      = document.getElementById('js-render-notice');
  const topFixesList  = document.getElementById('top-fixes-list');
  const catContainer  = document.getElementById('cat-container');

  const leadForm      = document.getElementById('lead-form');
  const leadSuccess   = document.getElementById('lead-success');
  const leadError     = document.getElementById('lead-error');

  /* ── Hjelpefunksjoner ───────────────────────────────────────────────────── */

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function scoreColor(s) {
    if (s >= 75) return '#22c55e';
    if (s >= 50) return '#f59e0b';
    return '#ef4444';
  }

  function scoreClass(s) {
    if (s >= 75) return 'green';
    if (s >= 50) return 'yellow';
    return 'red';
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Loading-steg ───────────────────────────────────────────────────────── */

  const STEPS = [
    'Henter nettsiden …',
    'Analyserer teknisk SEO …',
    'Sjekker meta-data og innhold …',
    'Måler ytelse …',
    'Genererer rapport …'
  ];

  const STEP_DURATIONS = [1800, 2000, 1800, 1500, 1200]; // ms per steg
  const MIN_SHOW_MS = 500; // minimum tid hvert steg vises

  let stepIntervalId = null;

  function buildLoadingSteps() {
    const ul = document.getElementById('loading-steps');
    ul.innerHTML = '';
    STEPS.forEach((text, i) => {
      const li = document.createElement('li');
      li.className = 'loading-step';
      li.id = `step-${i}`;
      li.innerHTML = `<span class="step-icon">${i + 1}</span><span>${esc(text)}</span>`;
      ul.appendChild(li);
    });
  }

  function activateStep(index) {
    STEPS.forEach((_, i) => {
      const el = document.getElementById(`step-${i}`);
      if (!el) return;
      el.classList.remove('active', 'done');
      if (i < index) {
        el.classList.add('done');
        el.querySelector('.step-icon').textContent = '✓';
      } else if (i === index) {
        el.classList.add('active');
        el.querySelector('.step-icon').textContent = String(i + 1);
      } else {
        el.querySelector('.step-icon').textContent = String(i + 1);
      }
    });
  }

  async function runStepsUntilDone(doneSignal) {
    let i = 0;
    activateStep(0);
    while (i < STEPS.length - 1) {
      await sleep(STEP_DURATIONS[i]);
      if (doneSignal.done && i >= STEPS.length - 2) break;
      i++;
      activateStep(i);
    }
    // Hold siste steg så lenge API-kallet ikke er ferdig
    while (!doneSignal.done) {
      await sleep(200);
    }
    // Marker alle som ferdige
    STEPS.forEach((_, idx) => {
      const el = document.getElementById(`step-${idx}`);
      if (!el) return;
      el.classList.remove('active');
      el.classList.add('done');
      el.querySelector('.step-icon').textContent = '✓';
    });
    await sleep(MIN_SHOW_MS);
  }

  /* ── Seksjons-synlighet ─────────────────────────────────────────────────── */

  function showSection(name) {
    inputSection.classList.toggle('active', name === 'input');
    loadingSection.classList.toggle('active', name === 'loading');
    reportSection.classList.toggle('active',  name === 'report');
    errorBox.classList.remove('active');
  }

  function showError(msg) {
    showSection('input');
    errorMsg.textContent = msg;
    errorBox.classList.add('active');
    analyseBtn.disabled = false;
    analyseBtn.querySelector('.btn-text').textContent = 'Analyser nettsiden';
  }

  /* ── Rapport-rendering ──────────────────────────────────────────────────── */

  const CATEGORY_ICONS = {
    teknisk:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    onpage:          `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    strukturertData: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    openGraph:       `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
    ytelse:          `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
    lokalSeo:        `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
    innhold:         `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`
  };

  const STATUS_ICONS = {
    pass: '✓',
    warn: '!',
    fail: '✕'
  };

  function renderScoreBanner(data) {
    const s = data.overallScore;
    const col = scoreColor(s);

    // Animér donut (circumference ≈ 408 for r=65)
    const CIRC = 408;
    const offset = CIRC * (1 - s / 100);
    setTimeout(() => {
      scoreFill.style.strokeDashoffset = offset;
      scoreFill.style.stroke = col;
    }, 200);

    scoreNum.textContent = s;
    scoreNum.className = `score-number score-${scoreClass(s)}`;
    summaryText.textContent = data.summary;

    if (data.isLikelyJsRendered) {
      jsNotice.classList.add('active');
    }
  }

  function renderTopFixes(fixes) {
    if (!fixes || fixes.length === 0) {
      topFixesList.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Ingen kritiske funn – bra jobbet!</p>';
      return;
    }
    topFixesList.innerHTML = fixes.map((fix, i) => `
      <div class="fix-item">
        <div class="fix-number">${i + 1}</div>
        <div class="fix-content">
          <div class="fix-category">${esc(fix.category)}</div>
          <div class="fix-title">${esc(fix.label)}</div>
          ${fix.recommendation ? `<div class="fix-rec">${esc(fix.recommendation)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderCategories(categories) {
    catContainer.innerHTML = '';
    const catOrder = ['teknisk','onpage','strukturertData','openGraph','ytelse','lokalSeo','innhold'];

    catOrder.forEach(key => {
      const cat = categories[key];
      if (!cat) return;

      const col   = scoreColor(cat.score);
      const klass = scoreClass(cat.score);
      const icon  = CATEGORY_ICONS[key] || '';

      const failCount = cat.checks.filter(c => c.status === 'fail').length;
      const warnCount = cat.checks.filter(c => c.status === 'warn').length;

      let badgeParts = [];
      if (failCount > 0) badgeParts.push(`<span style="color:#ef4444;font-weight:700">${failCount} kritisk${failCount > 1 ? 'e' : ''}</span>`);
      if (warnCount > 0) badgeParts.push(`<span style="color:#f59e0b;font-weight:600">${warnCount} advarsel${warnCount > 1 ? 'er' : ''}</span>`);

      const checksHtml = cat.checks.map(check => `
        <div class="check-item ${check.status}">
          <div class="check-status-icon ${check.status}">${STATUS_ICONS[check.status] || '?'}</div>
          <div class="check-content">
            <div class="check-label">${esc(check.label)}</div>
            <div class="check-desc">${esc(check.description)}</div>
            ${check.recommendation ? `<div class="check-rec">${esc(check.recommendation)}</div>` : ''}
          </div>
        </div>
      `).join('');

      const card = document.createElement('div');
      card.className = 'cat-card';
      card.innerHTML = `
        <div class="cat-header" role="button" tabindex="0" aria-expanded="false">
          <div class="cat-icon">${icon}</div>
          <div class="cat-title-wrap">
            <div class="cat-title">${esc(cat.label)}</div>
            ${badgeParts.length ? `<div style="font-size:0.78rem;margin-top:2px;">${badgeParts.join(' · ')}</div>` : ''}
          </div>
          <div class="cat-score-wrap">
            <div class="cat-score-bar-bg">
              <div class="cat-score-bar bar-${klass}" style="width:${cat.score}%"></div>
            </div>
            <div class="cat-score-num score-${klass}">${cat.score}/100</div>
          </div>
          <svg class="cat-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="cat-body">
          <div class="checks-list">${checksHtml}</div>
        </div>
      `;

      // Accordion toggle
      const header = card.querySelector('.cat-header');
      const body   = card.querySelector('.cat-body');
      header.addEventListener('click', () => toggleCard(card, header));
      header.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(card, header); }
      });

      catContainer.appendChild(card);
    });

    // Åpne det svakeste kortet automatisk
    const allCards = catContainer.querySelectorAll('.cat-card');
    if (allCards.length > 0) {
      const weakestKey = Object.keys(categories)
        .filter(k => CATEGORY_ICONS[k])
        .sort((a, b) => categories[a].score - categories[b].score)[0];
      const weakestIndex = ['teknisk','onpage','strukturertData','openGraph','ytelse','lokalSeo','innhold'].indexOf(weakestKey);
      if (weakestIndex >= 0 && allCards[weakestIndex]) {
        openCard(allCards[weakestIndex], allCards[weakestIndex].querySelector('.cat-header'));
      }
    }
  }

  function toggleCard(card, header) {
    if (card.classList.contains('open')) {
      card.classList.remove('open');
      header.setAttribute('aria-expanded', 'false');
    } else {
      openCard(card, header);
    }
  }

  function openCard(card, header) {
    card.classList.add('open');
    header.setAttribute('aria-expanded', 'true');
  }

  function renderReport(data) {
    renderScoreBanner(data);
    renderTopFixes(data.topFixes);
    renderCategories(data.categories);

    // Oppdater rapportens overskrift med nettstedets URL
    const reportTitle = document.getElementById('report-title');
    if (reportTitle) {
      const display = (data.finalUrl || data.url).replace(/^https?:\/\//, '').replace(/\/$/, '');
      reportTitle.textContent = `SEO-rapport: ${display}`;
    }

    showSection('report');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  /* ── Analyse-kall ───────────────────────────────────────────────────────── */

  async function startAnalysis(rawUrl) {
    errorBox.classList.remove('active');
    analyseBtn.disabled = true;
    analyseBtn.querySelector('.btn-text').textContent = 'Analyserer …';
    buildLoadingSteps();
    showSection('loading');
    setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, 20);

    const doneSignal = { done: false };

    const stepsPromise = runStepsUntilDone(doneSignal);

    let apiResult = null;
    let apiError  = null;

    try {
      const resp = await fetch('/api/seo-analyse', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: rawUrl })
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        apiError = errData.error || `Serverfeil (${resp.status}). Prøv igjen.`;
      } else {
        apiResult = await resp.json();
      }
    } catch {
      apiError = 'Klarte ikke å koble til analysetjenesten. Sjekk internettforbindelsen din.';
    }

    doneSignal.done = true;
    await stepsPromise;

    analyseBtn.disabled = false;
    analyseBtn.querySelector('.btn-text').textContent = 'Analyser nettsiden';

    if (apiError) {
      showError(apiError);
    } else if (apiResult) {
      renderReport(apiResult);
      window._lastReportData = apiResult;
    }
  }

  /* ── Skjema-submit ──────────────────────────────────────────────────────── */

  if (urlForm) {
    urlForm.addEventListener('submit', e => {
      e.preventDefault();
      const val = urlInput.value.trim();
      if (!val) {
        urlInput.focus();
        return;
      }
      startAnalysis(val);
    });
  }

  /* ── Lead-skjema ────────────────────────────────────────────────────────── */

  if (leadForm) {
    leadForm.addEventListener('submit', async e => {
      e.preventDefault();
      const submitBtn = leadForm.querySelector('[type="submit"]');
      if (!submitBtn) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sender …';
      if (leadError) leadError.classList.remove('active');

      const field = name => {
        const el = leadForm.querySelector(`[name="${name}"]`);
        return el ? el.value.trim() : '';
      };

      const data = window._lastReportData || {};
      const payload = {
        name:         field('lead-name'),
        email:        field('lead-email'),
        company:      field('lead-company'),
        phone:        field('lead-phone'),
        analyzedUrl:  data.url || '',
        overallScore: data.overallScore || null,
        summary:      data.summary || ''
      };

      try {
        const resp = await fetch('/api/send-lead', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload)
        });

        if (resp.ok) {
          if (leadSuccess) leadSuccess.classList.add('active');
          leadForm.style.display = 'none';
        } else {
          const err = await resp.json().catch(() => ({}));
          if (leadError) {
            leadError.textContent = err.error || 'Noe gikk galt. Prøv igjen.';
            leadError.classList.add('active');
          }
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send forespørsel';
        }
      } catch {
        if (leadError) {
          leadError.textContent = 'Klarte ikke å sende. Kontakt oss på post@scalemedia.no';
          leadError.classList.add('active');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send forespørsel';
      }
    });
  }

  /* ── URL-input: formatér automatisk ─────────────────────────────────────── */

  if (urlInput) {
    urlInput.addEventListener('paste', () => {
      setTimeout(() => { urlInput.value = urlInput.value.trim(); }, 0);
    });
  }

  /* ── Auto-start fra ?url= queryparameter (videresendt fra forsiden) ──────── */

  (function () {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get('url');
      if (urlParam && urlInput) {
        urlInput.value = urlParam;
        // Liten forsinkelse for at DOM-et er klart
        setTimeout(() => startAnalysis(urlParam), 300);
      }
    } catch (e) {}
  })();

})();
