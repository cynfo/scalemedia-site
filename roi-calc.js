(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
             || window.matchMedia('(max-width: 768px)').matches;

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



  var dotEls = null;
  var lastActive = -1;

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
    if (active === lastActive) return;

    leadsGrid.setAttribute('aria-label', active + ' av 100 mulige leads visualisert som rutenett');
    
    if (lastActive === -1) {
      for (var i = 0; i < 100; i++) {
        if (i < active) { dotEls[i].classList.add('active'); }
        else            { dotEls[i].classList.remove('active'); }
      }
    } else {
      var start = Math.min(lastActive, active);
      var end = Math.max(lastActive, active);
      for (var i = start; i < end; i++) {
        if (i < active) { dotEls[i].classList.add('active'); }
        else            { dotEls[i].classList.remove('active'); }
      }
    }
    lastActive = active;
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
    // 1. Calculations & Readings (No layout reads)
    var budget = +slider.value;
    var cur    = calc(budget);
    
    var formattedBudget = fmtNOK(budget) + ' NOK';
    var ariaText = fmtNOK(budget) + ' kroner';
    var trackPct = (budget - 5000) / 45000;
    
    var leadsVal = Math.round(cur.leads);
    var formattedLeads = leadsVal.toString();
    var formattedRev = fmtNOK(cur.revenue) + ' NOK';
    var formattedRoi = fmtROI(cur.roi);

    // 2. DOM Writes (Batched)
    trackFill.style.width = (trackPct * 100) + '%';
    slider.setAttribute('aria-valuenow',  budget);
    slider.setAttribute('aria-valuetext', ariaText);
    budgetDisp.textContent = formattedBudget;

    if (animate) {
      animateVal(mLeads,        prev.leads,   cur.leads,   400, function(v){ return Math.round(v).toString(); });
      animateVal(mRev,          prev.revenue, cur.revenue, 400, function(v){ return fmtNOK(v) + ' NOK'; });
      animateVal(mRoi,          prev.roi,     cur.roi,     400, fmtROI);
      animateVal(leadsBigCount, prev.leads,   cur.leads,   400, function(v){ return Math.round(v).toString(); });
    } else {
      mLeads.textContent        = formattedLeads;
      mRev.textContent          = formattedRev;
      mRoi.textContent          = formattedRoi;
      leadsBigCount.textContent = formattedLeads;
    }

    updateGrid(cur.leads);
    updateInsightQuote(cur.leads);

    insBudget.textContent  = formattedBudget;
    insLeads.textContent   = leadsVal + ' leads';
    insRevenue.textContent = formattedRev;
    insRoi.textContent     = formattedRoi;

    prev = cur;
  }

  buildGrid();
  update(false);

  var rafId = null;
  slider.addEventListener('input', function () {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      update(false);
      rafId = null;
    });
  }, { passive: true });

  slider.addEventListener('change', function () {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      update(false);
      rafId = null;
    });
  }, { passive: true });

}());

