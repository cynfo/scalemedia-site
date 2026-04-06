// ── Global Particle Canvas ────────────────────────────────────
(function () {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const COLORS = ['#7B5EA7', '#4A90D9', '#A855F7'];

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const COUNT     = isMobile ? 25 : 60;
    const LINK_DIST = isMobile ? 0  : 150;   // no lines on mobile
    const LINK_DIST_SQ = LINK_DIST * LINK_DIST;
    const SPEED     = isMobile ? 0.18 : 0.25;

    let W, H, particles;

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }

    function rand(min, max) { return Math.random() * (max - min) + min; }

    function createParticle() {
        return {
            x:     rand(0, W),
            y:     rand(0, H),
            vx:    rand(-SPEED, SPEED),
            vy:    rand(-SPEED, SPEED),
            r:     rand(2, isMobile ? 3 : 4),
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        };
    }

    function init() {
        resize();
        particles = Array.from({ length: COUNT }, createParticle);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Update positions
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < -p.r)    p.x = W + p.r;
            if (p.x > W + p.r) p.x = -p.r;
            if (p.y < -p.r)    p.y = H + p.r;
            if (p.y > H + p.r) p.y = -p.r;
        }

        // Connecting lines (desktop only)
        if (LINK_DIST > 0) {
            for (let i = 0; i < COUNT; i++) {
                for (let j = i + 1; j < COUNT; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < LINK_DIST_SQ) {
                        const alpha = (1 - distSq / LINK_DIST_SQ) * 0.15;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(123, 94, 167, ${alpha})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }
        }

        // Draw particles
        for (const p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color + '99';
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        for (const p of particles) {
            p.x = Math.min(p.x, W);
            p.y = Math.min(p.y, H);
        }
    });

    init();
    requestAnimationFrame(draw);
})();

// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        document.body.classList.toggle('menu-open');
        // Toggle animation for hamburger
        const spans = mobileMenuBtn.querySelectorAll('span');
        if (navLinks.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        } else {
            spans.forEach(span => span.style.transform = 'none');
            spans[1].style.opacity = '1';
        }
    });

    // Close mobile menu when clicking a link
    function closeMenu() {
        navLinks.classList.remove('active');
        document.body.classList.remove('menu-open');
        const spans = mobileMenuBtn.querySelectorAll('span');
        spans.forEach(span => span.style.transform = 'none');
        spans[1].style.opacity = '1';
    }

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navLinks.classList.contains('active') &&
            !navLinks.contains(e.target) &&
            !mobileMenuBtn.contains(e.target)) {
            closeMenu();
        }
    });

    // ── Scroll Animation System ──────────────────────────────────
    const hero = document.querySelector('.premium-hero');

    function isInHero(el) {
        return hero && hero.contains(el);
    }

    function assignAnimations() {
        // Section headings → fade up
        document.querySelectorAll('.section-heading').forEach(el => {
            if (isInHero(el)) return;
            el.setAttribute('data-sa', 'fade-up');
        });

        // Service cards → fade up with 0.1s stagger
        document.querySelectorAll('#tjenester .card, .services .card').forEach((el, i) => {
            if (isInHero(el)) return;
            el.setAttribute('data-sa', 'fade-up');
            el.style.setProperty('--sa-delay', (i * 0.1) + 's');
        });

        // Project cards → alternate left/right
        document.querySelectorAll('.project-card').forEach((el, i) => {
            el.setAttribute('data-sa', i % 2 === 0 ? 'from-left' : 'from-right');
        });

        // Pricing cards → fade from bottom with 0.15s stagger
        document.querySelectorAll('.pricing-card').forEach((el, i) => {
            el.setAttribute('data-sa', 'fade-bottom');
            el.style.setProperty('--sa-delay', (i * 0.15) + 's');
        });

        // Trustpilot review cards → alternate sides
        document.querySelectorAll('.review-card').forEach((el, i) => {
            el.setAttribute('data-sa', i % 2 === 0 ? 'from-left' : 'from-right');
            el.style.setProperty('--sa-delay', (i * 0.1) + 's');
        });

        // Customer quote cards → alternate sides
        document.querySelectorAll('.cr-card').forEach((el, i) => {
            el.setAttribute('data-sa', i % 2 === 0 ? 'from-left' : 'from-right');
            el.style.setProperty('--sa-delay', (i * 0.1) + 's');
        });

        // Stat items → fade up with stagger
        document.querySelectorAll('.stat-item').forEach((el, i) => {
            el.setAttribute('data-sa', 'fade-up');
            el.style.setProperty('--sa-delay', (i * 0.1) + 's');
        });

        // FAQ, contact, CTA sections → fade up
        document.querySelectorAll('.faq-accordion, .contact-container, .mid-cta-inner, .cta-banner-inner, .pricing-toggle-wrap').forEach(el => {
            el.setAttribute('data-sa', 'fade-up');
        });

        // SEO content, seo badge → fade up
        document.querySelectorAll('.seo-content .container').forEach(el => {
            el.setAttribute('data-sa', 'fade-up');
        });

        // Mid-CTA trust markers
        document.querySelectorAll('.mid-cta-trust span').forEach((el, i) => {
            el.setAttribute('data-sa', 'fade-up');
            el.style.setProperty('--sa-delay', (i * 0.1) + 's');
        });
    }

    assignAnimations();

    // Single observer for all [data-sa] elements
    const saObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('sa-visible');
                saObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('[data-sa]').forEach(el => saObserver.observe(el));

    // Legacy .animate-on-scroll support
    const legacyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                legacyObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.animate-on-scroll').forEach(el => legacyObserver.observe(el));

    // FAQ Accordion Logikk
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const questionBtn = item.querySelector('.faq-question');
        questionBtn.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Lukk alle andre
            faqItems.forEach(faq => {
                faq.classList.remove('active');
                faq.querySelector('.faq-answer').style.maxHeight = null;
            });

            // Åpne denne hvis den ikke var åpen
            if (!isActive) {
                item.classList.add('active');
                const answer = item.querySelector('.faq-answer');
                answer.style.maxHeight = answer.scrollHeight + 'px';
            }
        });
    });

    // Cursor glow follow
    const glow = document.querySelector('.interactive-glow');
    window.addEventListener('mousemove', (e) => {
        if (glow) {
            glow.style.left = `${e.clientX}px`;
            glow.style.top  = `${e.clientY}px`;
        }
    });

    // Number Counter Animation for 'Kundeinteraksjoner'
    const counterElement = document.getElementById('counter-number');
    if (counterElement) {
        const targetNumber = 1204;
        const duration = 4500; // 4.5 seconds (slower)
        let startTime = null;

        function updateCounter(currentTime) {
            if (!startTime) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out function for a smooth finish
            const easeOutProgress = 1 - Math.pow(1 - progress, 4);
            const currentNumber = Math.floor(easeOutProgress * targetNumber);
            
            // Format number with comma (1,200)
            counterElement.textContent = currentNumber.toLocaleString('en-US');

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            } else {
                counterElement.textContent = targetNumber.toLocaleString('en-US');
            }
        }
        
        // Short delay to wait for the floating animation to appear
        setTimeout(() => {
            requestAnimationFrame(updateCounter);
        }, 1000);
    }
});

// ── Pricing Toggle ─────────────────────────────────────────────
function setPricing(type) {
    const engangEls  = document.querySelectorAll('.price-engang');
    const monthlyEls = document.querySelectorAll('.price-monthly');
    const btnEngang  = document.getElementById('toggle-engang');
    const btnMonthly = document.getElementById('toggle-monthly');

    if (type === 'engang') {
        engangEls.forEach(el => { el.style.display = ''; });
        monthlyEls.forEach(el => { el.style.display = 'none'; });
        btnEngang.classList.add('active');
        btnMonthly.classList.remove('active');
    } else {
        engangEls.forEach(el => { el.style.display = 'none'; });
        monthlyEls.forEach(el => { el.style.display = ''; });
        btnMonthly.classList.add('active');
        btnEngang.classList.remove('active');
    }

    // Trigger fade animation
    const all = document.querySelectorAll('.price-engang, .price-monthly');
    all.forEach(el => {
        if (el.style.display !== 'none') {
            el.style.animation = 'none';
            el.offsetHeight; // reflow
            el.style.animation = 'priceFade 0.3s ease';
        }
    });
}

// ── Stats Counter Animation ────────────────────────────────────
(function () {
    const counters = document.querySelectorAll('[data-counter]');
    if (!counters.length) return;

    const easeOut = t => 1 - Math.pow(1 - t, 3); // cubic ease-out

    function animateCounter(el) {
        const target   = parseInt(el.dataset.counter, 10);
        const prefix   = el.dataset.prefix  || '';
        const suffix   = el.dataset.suffix  || '';
        const duration = 2000; // ms
        const start    = performance.now();

        function step(now) {
            const elapsed  = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const value    = Math.round(easeOut(progress) * target);
            el.textContent = prefix + value + suffix;
            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target); // run once
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(el => observer.observe(el));
})();

// ── Web3Forms kontaktskjema ────────────────────────────────────
(function () {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const btn = form.querySelector('button[type="submit"]');
        const success = document.getElementById('form-success');
        const error   = document.getElementById('form-error');

        btn.disabled = true;
        btn.textContent = 'Sender...';
        success.style.display = 'none';
        error.style.display   = 'none';

        try {
            const res  = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: new FormData(form)
            });
            const data = await res.json();

            if (data.success) {
                success.style.display = 'block';
                form.reset();
            } else {
                error.style.display = 'block';
            }
        } catch {
            error.style.display = 'block';
        }

        btn.disabled = false;
        btn.textContent = 'Send Forespørsel';
    });
})();
