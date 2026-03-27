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
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const spans = mobileMenuBtn.querySelectorAll('span');
            spans.forEach(span => span.style.transform = 'none');
            spans[1].style.opacity = '1';
        });
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Add animation classes to elements
    const elementsToAnimate = document.querySelectorAll('.section-heading, .card, .contact-container, .service-block, .faq-accordion, .animate-on-scroll');
    elementsToAnimate.forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });

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

    // Interactive Background Features - Global
    const glow = document.querySelector('.interactive-glow');
    const heroIllustration = document.querySelector('.hero-right');
    const floatingShapes = document.querySelectorAll('.floating-shape');

    window.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        
        // Move glow globally relative to viewport
        if (glow) {
            glow.style.left = `${x}px`;
            glow.style.top = `${y}px`;
        }

        // Parallax effect on illustration and shapes (only if they exist on the page)
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const moveX = (x - centerX) / centerX; // -1 to 1
        const moveY = (y - centerY) / centerY; // -1 to 1

        if (heroIllustration) {
            heroIllustration.style.transform = `translate(${moveX * -15}px, ${moveY * -15}px)`;
        }

        if (floatingShapes.length > 0) {
            floatingShapes.forEach((shape, index) => {
                const depth = (index + 1) * 20; // Varying depth for shapes
                shape.style.transform = `translate(${moveX * depth}px, ${moveY * depth}px)`;
            });
        }
    });

    window.addEventListener('mouseleave', () => {
        // Reset transforms smoothly when mouse leaves page
        if (heroIllustration) {
            heroIllustration.style.transition = 'transform 0.5s ease-out';
            heroIllustration.style.transform = 'translate(0, 0)';
            setTimeout(() => { heroIllustration.style.transition = ''; }, 500);
        }
        if (floatingShapes.length > 0) {
            floatingShapes.forEach(shape => {
                shape.style.transition = 'transform 0.5s ease-out';
                shape.style.transform = '';
                setTimeout(() => { shape.style.transition = ''; }, 500);
            });
        }
    });

    // Number Counter Animation for 'Kundeinteraksjoner'
    const counterElement = document.getElementById('counter-number');
    if (counterElement) {
        const targetNumber = 1204;
        const duration = 2500; // 2.5 seconds
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
