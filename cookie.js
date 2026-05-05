/* ─────────────────────────────────────────────────────────────
   ScaleMedia – GDPR Cookie Consent + Google Consent Mode V2
   Lagrer valg i localStorage i 12 måneder (versjon 1.0)
───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var CONSENT_KEY     = 'cookie_consent';
    var CONSENT_VERSION = '1.0';
    var EXPIRY_DAYS     = 365;

    /* ── Lagring ── */
    function saveConsent(analytics) {
        var data = {
            version:   CONSENT_VERSION,
            timestamp: new Date().toISOString(),
            analytics: analytics
        };
        try { localStorage.setItem(CONSENT_KEY, JSON.stringify(data)); } catch (_) {}
    }

    function loadConsent() {
        try {
            var raw = localStorage.getItem(CONSENT_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (data.version !== CONSENT_VERSION) { localStorage.removeItem(CONSENT_KEY); return null; }
            var ageDays = (Date.now() - new Date(data.timestamp).getTime()) / 86400000;
            if (ageDays > EXPIRY_DAYS)             { localStorage.removeItem(CONSENT_KEY); return null; }
            return data;
        } catch (_) { return null; }
    }

    /* ── Google Consent Mode V2 ── */
    function updateGA(analytics) {
        if (typeof window.gtag !== 'function') return;
        window.gtag('consent', 'update', {
            analytics_storage: analytics ? 'granted' : 'denied'
        });
    }

    /* ── Banner HTML ── */
    function makeBanner() {
        var el = document.createElement('div');
        el.id = 'cookie-banner';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Cookie-samtykke');
        el.innerHTML =
            '<div class="cb-inner">' +
                '<div class="cb-text">' +
                    '<p class="cb-title">Vi bruker informasjonskapsler</p>' +
                    '<p class="cb-desc">Vi bruker cookies for å analysere besøkstrafikk og forbedre opplevelsen din. Du velger selv hva du tillater. ' +
                    '<a href="personvern.html" class="cb-link">Les mer</a></p>' +
                '</div>' +
                '<div class="cb-actions">' +
                    '<button class="cb-btn cb-btn--outline"    id="cb-customize">Tilpass</button>' +
                    '<button class="cb-btn cb-btn--secondary"  id="cb-reject">Kun nødvendige</button>' +
                    '<button class="cb-btn cb-btn--primary"    id="cb-accept">Godta alle</button>' +
                '</div>' +
            '</div>';
        return el;
    }

    /* ── Innstillingspanel HTML ── */
    function makePanel() {
        var el = document.createElement('div');
        el.id = 'cookie-overlay';
        el.innerHTML =
            '<div class="cp-panel" role="dialog" aria-modal="true" aria-label="Cookie-innstillinger">' +
                '<div class="cp-header">' +
                    '<h2 class="cp-title">Cookie-innstillinger</h2>' +
                    '<button class="cp-close" id="cp-close" aria-label="Lukk">' +
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                    '</button>' +
                '</div>' +
                '<div class="cp-body">' +
                    '<p class="cp-intro">Velg hvilke informasjonskapsler du vil tillate. Nødvendige cookies er alltid aktive og sikrer at nettsiden fungerer som den skal.</p>' +
                    '<div class="cp-category">' +
                        '<div class="cp-cat-row">' +
                            '<div class="cp-cat-info">' +
                                '<span class="cp-cat-name">Nødvendige</span>' +
                                '<span class="cp-cat-desc">Kreves for at nettsiden skal fungere korrekt – inkluderer sesjonshåndtering og sikkerhet. Kan ikke slås av.</span>' +
                            '</div>' +
                            '<div class="cp-always-on">Alltid på</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cp-category">' +
                        '<div class="cp-cat-row">' +
                            '<div class="cp-cat-info">' +
                                '<span class="cp-cat-name">Analyse og statistikk</span>' +
                                '<span class="cp-cat-desc">Hjelper oss å forstå hvordan besøkende bruker siden via Google Analytics. Ingen personlig identifiserbar informasjon lagres.</span>' +
                            '</div>' +
                            '<label class="cp-switch" aria-label="Aktiver analyse-cookies">' +
                                '<input type="checkbox" id="cp-analytics">' +
                                '<span class="cp-slider"></span>' +
                            '</label>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="cp-footer">' +
                    '<button class="cb-btn cb-btn--outline"  id="cp-reject">Kun nødvendige</button>' +
                    '<button class="cb-btn cb-btn--primary"  id="cp-save">Lagre valg</button>' +
                '</div>' +
            '</div>';
        return el;
    }

    /* ── Vis/skjul – inline style vinner alltid over CSS ── */
    function showBanner() {
        var b = document.getElementById('cookie-banner');
        if (b) b.style.display = 'block';
    }
    function hideBanner() {
        var b = document.getElementById('cookie-banner');
        if (b) b.style.display = 'none';
    }
    function showPanel() {
        var o = document.getElementById('cookie-overlay');
        if (!o) return;
        var chk = document.getElementById('cp-analytics');
        var saved = loadConsent();
        if (chk) chk.checked = saved ? !!saved.analytics : false;
        o.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        var first = o.querySelector('button, [href], input');
        if (first) setTimeout(function () { first.focus(); }, 50);
    }
    function hidePanel(reopenBanner) {
        var o = document.getElementById('cookie-overlay');
        if (o) o.style.display = 'none';
        document.body.style.overflow = '';
        if (reopenBanner && !loadConsent()) showBanner();
    }

    /* ── Handlinger ── */
    function acceptAll() {
        saveConsent(true);
        updateGA(true);
        hideBanner();
        hidePanel(false);
    }
    function rejectAll() {
        saveConsent(false);
        updateGA(false);
        hideBanner();
        hidePanel(false);
    }
    function saveCustom() {
        var chk = document.getElementById('cp-analytics');
        var analytics = chk ? chk.checked : false;
        saveConsent(analytics);
        updateGA(analytics);
        hideBanner();
        hidePanel(false);
    }

    /* ── Init ── */
    function init() {
        document.body.appendChild(makeBanner());
        document.body.appendChild(makePanel());

        /* Apply saved consent immediately on load */
        var saved = loadConsent();
        if (saved) {
            updateGA(saved.analytics);
        } else {
            /* First visit – show banner after slight delay */
            setTimeout(showBanner, 700);
        }

        /* Banner buttons */
        document.getElementById('cb-accept').addEventListener('click', acceptAll);
        document.getElementById('cb-reject').addEventListener('click', rejectAll);
        document.getElementById('cb-customize').addEventListener('click', function () {
            hideBanner();
            showPanel();
        });

        /* Panel buttons */
        document.getElementById('cp-close').addEventListener('click', function () { hidePanel(true); });
        document.getElementById('cp-reject').addEventListener('click', rejectAll);
        document.getElementById('cp-save').addEventListener('click', saveCustom);

        /* Click outside panel */
        document.getElementById('cookie-overlay').addEventListener('click', function (e) {
            if (e.target === this) hidePanel(true);
        });

        /* Escape key */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var o = document.getElementById('cookie-overlay');
                if (o && o.classList.contains('cp-visible')) hidePanel(true);
            }
        });

        /* Footer "Cookie-innstillinger" link – delegated */
        document.addEventListener('click', function (e) {
            if (e.target && e.target.id === 'open-cookie-settings') {
                e.preventDefault();
                showPanel();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
