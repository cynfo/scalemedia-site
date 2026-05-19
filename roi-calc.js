(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var slider        = document.getElementById('budget-slider');
  if (!slider) return;

  var budgetDisp    = document.getElementById('budget-display');
  var trackFill     = document.getElementById('track-fill');
  var mLeads        = document.getElementById('metric-leads');
  var mRev          = document.getElementById('metric-revenue');
  var mRoi          = document.getElementById('metric-roi');
  var leadsBigCount = document.getElementById('leads-big-count');
  var leadsGrid     = document.getElementById('leads-grid');
  var insightQuote  = document.getElementById('leads-insight-quote');
  var insBudget     = document.getElementById('ins-budget');
  var insLeads      = document.getElementById('ins-leads');
  var insRevenue    = document.getElementById('ins-revenue');
  var insRoi        = document.getElementById('ins-roi');

  function fmtNOK(n) {
    return Math.round(n).toLocaleString('nb-NO').replace(/ /g, ' ');
  }
  function fmtROI(n) { return n.toFixed(1) + 'x'; }

  function calc(b) {
    var leads   = b / 500;
    var revenue = leads * 3000;
    return { leads: leads, revenue: revenue, roi: revenue / b };
  }

  function animateVal(el, from, to, duration, fmt) {
    if (REDUCED) { el.textContent = fmt(to); return; }
    var start = performance.now();
    function step(now) {
      var t  = Math.min((now - start) / duration, 1);
      var et = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(from + (to - from) * et);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateTrack(val) {
    var pct = (val - 5000) / 45000;
    trackFill.style.width = (pct * 100) + '%';
  }

  var dotEls = null;

  function buildGrid() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 100; i++) {
      var dot = document.createElement('div');
      dot.className = 'lead-dot';
      dot.setAttribute('aria-hidden', 'true');
      if (!REDUCED) {
        dot.style.transitionDelay = Math.min(i * 8, 400) + 'ms';
      }
      frag.appendChild(dot);
    }
    leadsGrid.appendChild(frag);
    dotEls = leadsGrid.querySelectorAll('.lead-dot');
  }

  function updateGrid(leads) {
    var active = Math.min(Math.round(leads), 100);
    leadsGrid.setAttribute('aria-label', active + ' av 100 mulige leads visualisert som rutenett');
    for (var i = 0; i < 100; i++) {
      if (i < active) { dotEls[i].classList.add('active'); }
      else            { dotEls[i].classList.remove('active'); }
    }
  }

  function updateInsightQuote(leads) {
    var n = Math.round(leads);
    insightQuote.innerHTML =
      'Med <strong>' + n + '</strong> leads i måneden får annonsene dine ' +
      'nok signal til at algoritmen optimaliserer skikkelig. De fleste bedrifter ' +
      'kjører en brøkdel av dette — og derfor stopper veksten opp.';
  }

  var prev = calc(+slider.value);

  function update(animate) {
    var budget = +slider.value;
    var cur    = calc(budget);

    updateTrack(budget);
    slider.setAttribute('aria-valuenow',  budget);
    slider.setAttribute('aria-valuetext', fmtNOK(budget) + ' kroner');
    budgetDisp.textContent = fmtNOK(budget) + ' NOK';

    if (animate) {
      animateVal(mLeads,        prev.leads,   cur.leads,   400, function(v){ return Math.round(v).toString(); });
      animateVal(mRev,          prev.revenue, cur.revenue, 400, function(v){ return fmtNOK(v) + ' NOK'; });
      animateVal(mRoi,          prev.roi,     cur.roi,     400, fmtROI);
      animateVal(leadsBigCount, prev.leads,   cur.leads,   400, function(v){ return Math.round(v).toString(); });
    } else {
      mLeads.textContent        = Math.round(cur.leads).toString();
      mRev.textContent          = fmtNOK(cur.revenue) + ' NOK';
      mRoi.textContent          = fmtROI(cur.roi);
      leadsBigCount.textContent = Math.round(cur.leads).toString();
    }

    updateGrid(cur.leads);
    updateInsightQuote(cur.leads);

    insBudget.textContent  = fmtNOK(budget) + ' NOK';
    insLeads.textContent   = Math.round(cur.leads) + ' leads';
    insRevenue.textContent = fmtNOK(cur.revenue) + ' NOK';
    insRoi.textContent     = fmtROI(cur.roi);

    prev = cur;
  }

  buildGrid();
  update(false);

  slider.addEventListener('input',  function(){ update(true); });
  slider.addEventListener('change', function(){ update(true); });

}());
