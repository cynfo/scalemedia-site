'use strict';

/* ────────────────────────────────────────────────────────────────────────────
   Frontend for nettside-generatoren.

   Ansvar:
     - Multi-step wizard (state, navigasjon, validering, valgkort)
     - Strømming fra /api/generer og /api/iterer via Server-Sent Events
     - Vise resultatet i en sandboxed iframe med desktop/mobil-veksling
     - Iterasjon med grense på 4 gratis endringer per sesjon
     - Lead-fangst via /api/lead

   Ingen API-nøkler eller hemmeligheter finnes her - alt mot Claude går gjennom
   backend.
   ──────────────────────────────────────────────────────────────────────────── */

(function () {

  // ── DOM ──────────────────────────────────────────────────────────────────
  const sections = {
    wizard:  document.getElementById('wizard-section'),
    loading: document.getElementById('loading-section'),
    result:  document.getElementById('result-section')
  };

  const wizardForm   = document.getElementById('wizard-form');
  const progressFill = document.getElementById('wiz-progress-fill');
  const dots         = Array.from(document.querySelectorAll('.wiz-dot'));
  const steps        = Array.from(document.querySelectorAll('.wiz-step'));

  const bransjeSelect = document.getElementById('wiz-bransje');
  const bransjeAnnet  = document.getElementById('wiz-bransje-annet');
  const beskrivelse   = document.getElementById('wiz-beskrivelse');
  const beskrivCount  = document.getElementById('beskrivelse-count');

  const genStatus   = document.getElementById('gen-status');
  const genProgress = document.getElementById('gen-progress-fill');
  const genErrorBox = document.getElementById('gen-error-box');
  const genErrorMsg = document.getElementById('gen-error-msg');
  const genRetryBtn = document.getElementById('gen-retry-btn');

  const iframe       = document.getElementById('preview-iframe');
  const deviceFrame  = document.getElementById('device-frame');
  const deviceUrl    = document.getElementById('device-url');
  const previewOpen  = document.getElementById('preview-open-btn');

  const iterateForm    = document.getElementById('iterate-form');
  const iterateInput   = document.getElementById('iterate-input');
  const iterateBtn     = document.getElementById('iterate-btn');
  const iterateStatus  = document.getElementById('iterate-status');
  const iterateError   = document.getElementById('iterate-error');
  const iterateCounter = document.getElementById('iterate-counter');
  const iterateNudge   = document.getElementById('iterate-nudge');
  const iterateChips   = Array.from(document.querySelectorAll('.iterate-chip'));

  const leadForm    = document.getElementById('lead-form');
  const leadError   = document.getElementById('lead-error');
  const leadSuccess = document.getElementById('lead-success');
  const restartBtn  = document.getElementById('restart-btn');

  // ── State ────────────────────────────────────────────────────────────────
  const MAX_ITERATIONS = 4;
  const EXPECTED_CHARS = 42000; // for fremdriftsestimat (matcher server)

  let currentStep   = 1;
  let selections    = {};          // { sidetype, maal, stil, farger }
  let currentHtml   = '';          // siste genererte side
  let lastBrief     = null;        // brief for retry
  let iterationsUsed = 0;
  let busy          = false;       // hindrer doble kall
  let blobUrl       = null;

  // ── Hjelpere ───────────────────────────────────────────────────────────────
  function showSection(name) {
    Object.keys(sections).forEach(k => sections[k].classList.toggle('active', k === name));
  }
  function scrollTop() {
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 30);
  }

  // ── Wizard: bransje "Annet" ────────────────────────────────────────────────
  if (bransjeSelect) {
    bransjeSelect.addEventListener('change', () => {
      const annet = bransjeSelect.value === 'Annet';
      bransjeAnnet.classList.toggle('show', annet);
      if (annet) bransjeAnnet.focus();
    });
  }

  if (beskrivelse) {
    beskrivelse.addEventListener('input', () => {
      beskrivCount.textContent = String(beskrivelse.value.length);
    });
  }

  // ── Wizard: valgkort (sidetype / mål / stil / farger) ──────────────────────
  document.querySelectorAll('[data-field]').forEach(group => {
    const field = group.getAttribute('data-field');
    const choiceSelector = '.wiz-choice, .wiz-style, .wiz-color';
    group.querySelectorAll(choiceSelector).forEach(btn => {
      btn.addEventListener('click', () => {
        group.querySelectorAll(choiceSelector).forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selections[field] = btn.getAttribute('data-value');
      });
    });
  });

  // ── Wizard: navigasjon ─────────────────────────────────────────────────────
  function goToStep(n) {
    currentStep = n;
    steps.forEach(s => s.classList.toggle('active', Number(s.getAttribute('data-step')) === n));
    dots.forEach(d => {
      const ds = Number(d.getAttribute('data-step'));
      d.classList.toggle('active', ds === n);
      d.classList.toggle('done', ds < n);
    });
    // Fyll fremdriftslinjen (4 steg -> 0 / 33 / 66 / 100 %).
    progressFill.style.width = ((n - 1) / (steps.length - 1) * 100) + '%';
    scrollTop();
  }

  function validateStep1() {
    const navn = document.getElementById('wiz-bedriftsnavn').value.trim();
    const bransjeOk = bransjeSelect.value && (bransjeSelect.value !== 'Annet' || bransjeAnnet.value.trim());
    const beskr = beskrivelse.value.trim();
    const errBox = document.getElementById('wiz-error-1');

    let msg = '';
    if (!navn) msg = 'Skriv inn bedriftsnavnet.';
    else if (!bransjeOk) msg = 'Velg en bransje (eller skriv inn din egen).';
    else if (beskr.length < 10) msg = 'Skriv noen ord om hva bedriften gjør.';

    if (msg) {
      errBox.textContent = msg;
      errBox.classList.add('active');
      return false;
    }
    errBox.classList.remove('active');
    return true;
  }

  document.querySelectorAll('.wiz-next').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = Number(btn.getAttribute('data-next'));
      if (currentStep === 1 && !validateStep1()) return;
      goToStep(next);
    });
  });
  document.querySelectorAll('.wiz-back').forEach(btn => {
    btn.addEventListener('click', () => goToStep(Number(btn.getAttribute('data-back'))));
  });

  // ── Bygg brief fra skjemaet ──────────────────────────────────────────────────
  function collectBrief() {
    const bransje = bransjeSelect.value === 'Annet'
      ? bransjeAnnet.value.trim()
      : bransjeSelect.value;

    const tlf  = document.getElementById('wiz-telefon').value.trim();
    const post = document.getElementById('wiz-epost').value.trim();
    const adr  = document.getElementById('wiz-adresse').value.trim();
    const kontaktDeler = [];
    if (tlf)  kontaktDeler.push('Telefon: ' + tlf);
    if (post) kontaktDeler.push('E-post: ' + post);
    if (adr)  kontaktDeler.push('Adresse/område: ' + adr);

    return {
      bedriftsnavn: document.getElementById('wiz-bedriftsnavn').value.trim(),
      bransje:      bransje,
      beskrivelse:  beskrivelse.value.trim(),
      sidetype:     selections.sidetype || '',
      maal:         selections.maal || '',
      stil:         selections.stil || '',
      farger:       selections.farger || '',
      tjenester:    document.getElementById('wiz-tjenester').value.trim(),
      kontaktinfo:  kontaktDeler.join(', ')
    };
  }

  // ── SSE-strømming (felles for generer + iterer) ────────────────────────────
  async function streamRequest(url, payload, cb) {
    let resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch {
      cb.onError('Klarte ikke å koble til tjenesten. Sjekk internett­forbindelsen og prøv igjen.');
      return;
    }

    // Feil før strømmen starter kommer som vanlig JSON.
    if (!resp.ok || !resp.body) {
      let err = {};
      try { err = await resp.json(); } catch {}
      cb.onError(err.error || `Noe gikk galt (${resp.status}). Prøv igjen.`, err);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '', finished = false;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const line = frame.split('\n').find(l => l.indexOf('data:') === 0);
          if (!line) continue;
          let evt;
          try { evt = JSON.parse(line.slice(5).trim()); } catch { continue; }

          if (evt.type === 'status') {
            cb.onStatus && cb.onStatus(evt.message);
          } else if (evt.type === 'delta') {
            full += evt.text;
            cb.onProgress && cb.onProgress(full.length);
          } else if (evt.type === 'done') {
            finished = true;
            cb.onDone && cb.onDone(evt.html, evt.usage);
          } else if (evt.type === 'error') {
            finished = true;
            cb.onError && cb.onError(evt.message);
          }
        }
      }
      if (!finished) cb.onError && cb.onError('Tilkoblingen ble brutt før siden var ferdig. Prøv igjen.');
    } catch {
      if (!finished) cb.onError && cb.onError('Tilkoblingen ble brutt. Prøv igjen.');
    }
  }

  // ── Forhåndsvisning (iframe) ─────────────────────────────────────────────────
  function renderPreview(html) {
    currentHtml = html;
    iframe.srcdoc = html;
    if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} blobUrl = null; }
  }

  // ── Generering ───────────────────────────────────────────────────────────────
  function startGeneration(brief) {
    lastBrief = brief;
    busy = true;
    genErrorBox.classList.remove('active');
    genStatus.textContent = 'Tolker briefen din …';
    genProgress.style.width = '2%';
    showSection('loading');
    scrollTop();

    streamRequest('/api/generer', brief, {
      onStatus: (msg) => {
        genStatus.style.opacity = '0';
        setTimeout(() => { genStatus.textContent = msg; genStatus.style.opacity = '1'; }, 150);
      },
      onProgress: (chars) => {
        const pct = Math.min(99, Math.round(chars / EXPECTED_CHARS * 100));
        genProgress.style.width = Math.max(2, pct) + '%';
      },
      onDone: (html) => {
        busy = false;
        genProgress.style.width = '100%';
        renderPreview(html);
        setupResult(brief);
        showSection('result');
        scrollTop();
      },
      onError: (msg) => {
        busy = false;
        genErrorMsg.textContent = msg;
        genErrorBox.classList.add('active');
      }
    });
  }

  if (wizardForm) {
    wizardForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (busy) return;
      if (!validateStep1()) { goToStep(1); return; }
      startGeneration(collectBrief());
    });
  }

  if (genRetryBtn) {
    genRetryBtn.addEventListener('click', () => {
      if (busy || !lastBrief) return;
      startGeneration(lastBrief);
    });
  }

  // ── Oppsett av resultat-seksjonen ────────────────────────────────────────────
  const PAKKER = {
    onepage:      { name: 'One Page', price: '10 990,-' },
    landingsside: { name: 'One Page', price: '10 990,-' },
    bedrift:      { name: 'Business', price: '15 990,-' },
    booking:      { name: 'Business', price: '15 990,-' },
    nettbutikk:   { name: 'Premium',  price: '22 990,-' }
  };

  function setupResult(brief) {
    // Anbefalt pakke basert på sidetype.
    const pakke = PAKKER[brief.sidetype] || { name: 'Business', price: '15 990,-' };
    document.getElementById('pakke-name').textContent = pakke.name;
    document.getElementById('pakke-price').textContent = pakke.price;

    // URL-felt i device-rammen.
    if (brief.bedriftsnavn) {
      const slug = brief.bedriftsnavn.toLowerCase()
        .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
        .replace(/[^a-z0-9]+/g, '').slice(0, 24);
      deviceUrl.textContent = (slug || 'forhandsvisning') + '.no';
    }

    // Nullstill iterasjonstilstand for ny side.
    iterationsUsed = 0;
    updateIterationUi();

    // Nullstill lead-skjema.
    if (leadForm) leadForm.style.display = '';
    if (leadSuccess) leadSuccess.classList.remove('active');
    if (leadError) leadError.classList.remove('active');
  }

  // ── Device-veksling ───────────────────────────────────────────────────────────
  document.querySelectorAll('.device-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const device = btn.getAttribute('data-device');
      deviceFrame.setAttribute('data-device', device);
      document.querySelectorAll('.device-btn').forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  });

  if (previewOpen) {
    previewOpen.addEventListener('click', () => {
      if (!currentHtml) return;
      try {
        const blob = new Blob([currentHtml], { type: 'text/html' });
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener');
      } catch {
        const w = window.open('', '_blank', 'noopener');
        if (w) { w.document.open(); w.document.write(currentHtml); w.document.close(); }
      }
    });
  }

  // ── Iterasjon ──────────────────────────────────────────────────────────────────
  function updateIterationUi() {
    const left = MAX_ITERATIONS - iterationsUsed;
    if (left > 0) {
      iterateCounter.textContent = `${left} gratis ${left === 1 ? 'endring' : 'endringer'} igjen`;
      iterateCounter.classList.remove('spent');
      iterateNudge.classList.remove('active');
      iterateInput.disabled = false;
      iterateBtn.disabled = false;
      iterateChips.forEach(c => c.disabled = false);
    } else {
      iterateCounter.textContent = 'Ingen gratis endringer igjen';
      iterateCounter.classList.add('spent');
      iterateNudge.classList.add('active');
      iterateInput.disabled = true;
      iterateBtn.disabled = true;
      iterateChips.forEach(c => c.disabled = true);
    }
  }

  function runIteration(endring) {
    if (busy || !currentHtml || iterationsUsed >= MAX_ITERATIONS) return;
    busy = true;
    iterateError.classList.remove('active');
    iterateStatus.classList.add('active');
    iterateStatus.innerHTML = '<span class="mini-spin"></span> Oppdaterer siden …';
    iterateBtn.disabled = true;
    iterateInput.disabled = true;
    iterateChips.forEach(c => c.disabled = true);

    streamRequest('/api/iterer', { html: currentHtml, endring }, {
      onStatus: (msg) => { iterateStatus.innerHTML = '<span class="mini-spin"></span> ' + esc(msg); },
      onDone: (html) => {
        busy = false;
        renderPreview(html);
        iterationsUsed++;
        iterateInput.value = '';
        iterateStatus.classList.remove('active');
        updateIterationUi();
      },
      onError: (msg) => {
        busy = false;
        iterateStatus.classList.remove('active');
        iterateError.textContent = msg;
        iterateError.classList.add('active');
        // Endringen "telte" ikke – la brukeren prøve igjen.
        iterateInput.disabled = false;
        iterateBtn.disabled = false;
        iterateChips.forEach(c => c.disabled = false);
      }
    });
  }

  if (iterateForm) {
    iterateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = iterateInput.value.trim();
      if (!val) { iterateInput.focus(); return; }
      runIteration(val);
    });
  }
  iterateChips.forEach(chip => {
    chip.addEventListener('click', () => runIteration(chip.getAttribute('data-change')));
  });

  // ── Lead-fangst ────────────────────────────────────────────────────────────────
  if (leadForm) {
    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = leadForm.querySelector('[type="submit"]');
      const field = n => { const el = leadForm.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };

      const name = field('lead-name');
      const email = field('lead-email');
      if (!name || !email) { leadError.textContent = 'Fyll inn navn og e-post.'; leadError.classList.add('active'); return; }

      leadError.classList.remove('active');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sender …';

      const pakkeNavn = document.getElementById('pakke-name').textContent;
      const pakkePris = document.getElementById('pakke-price').textContent;

      const payload = {
        name, email,
        company: field('lead-company'),
        phone:   field('lead-phone'),
        brief:   lastBrief || {},
        html:    currentHtml,
        pakke:   `${pakkeNavn} – ${pakkePris}`
      };

      try {
        const resp = await fetch('/api/lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (resp.ok) {
          leadForm.style.display = 'none';
          leadSuccess.classList.add('active');
        } else {
          const err = await resp.json().catch(() => ({}));
          leadError.textContent = err.error || 'Noe gikk galt. Prøv igjen.';
          leadError.classList.add('active');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send meg forhåndsvisningen →';
        }
      } catch {
        leadError.textContent = 'Klarte ikke å sende. Kontakt oss på post@scalemedia.no';
        leadError.classList.add('active');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send meg forhåndsvisningen →';
      }
    });
  }

  // ── Start på nytt ──────────────────────────────────────────────────────────────
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      currentHtml = '';
      iframe.srcdoc = '';
      if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch {} blobUrl = null; }
      goToStep(1);
      showSection('wizard');
      scrollTop();
    });
  }

  // ── Util ────────────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
