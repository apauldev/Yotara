document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.querySelector('.copyright-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  const navWrapper = document.querySelector('.nav-wrapper');
  const nav = document.querySelector('nav');
  const menuIcon = menuBtn?.querySelector('.material-symbols-outlined');

  // Mobile overlay classes applied when menu opens
  const OVERLAY_CLASSES = [
    'flex-col',
    'absolute',
    'left-0',
    'top-full',
    'w-full',
    'bg-surface',
    'p-8',
    'shadow-lg',
    'mt-2',
    'rounded-2xl',
    'border',
    'border-outline-variant/20',
    'z-50',
  ];

  if (menuBtn && navLinks && navWrapper) {
    // Clone the desktop CTA into mobile nav
    // Use [class*="btn-primary"] because the element always has class "hidden"
    const desktopCta = document.querySelector('[class*="btn-primary"][href*="beta"]');
    const mobileCta = navLinks.querySelector('.btn-primary-mobile');

    if (desktopCta && !mobileCta) {
      const clone = desktopCta.cloneNode(true);
      clone.classList.remove('hidden', 'md:inline-block');
      clone.classList.add(
        'btn-primary-mobile',
        'md:hidden',
        'block',
        'w-full',
        'text-center',
        'mt-6',
        'py-3',
        'px-6',
        'rounded-2xl',
        'font-medium',
        'tracking-wide',
      );
      clone.href = desktopCta.href;
      navLinks.appendChild(clone);
    }

    function openMenu() {
      navLinks.classList.remove('hidden');
      navLinks.classList.add('open', ...OVERLAY_CLASSES);
      menuBtn.setAttribute('aria-expanded', 'true');
      if (menuIcon) menuIcon.textContent = 'close';
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      navLinks.classList.remove('open', ...OVERLAY_CLASSES);
      navLinks.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
      if (menuIcon) menuIcon.textContent = 'menu';
      document.body.style.overflow = '';
    }

    menuBtn.addEventListener('click', () => {
      if (navLinks.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    // Close mobile menu when a nav link is tapped
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 768 && navLinks.classList.contains('open')) {
          closeMenu();
        }
      });
    });

    // Close on backdrop tap
    document.addEventListener('click', (e) => {
      if (window.innerWidth >= 768) return;
      if (!navLinks.classList.contains('open')) return;
      if (nav.contains(e.target)) return;
      closeMenu();
    });

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        navLinks.classList.remove('open', ...OVERLAY_CLASSES);
        navLinks.classList.add('flex');
        menuBtn.setAttribute('aria-expanded', 'false');
        if (menuIcon) menuIcon.textContent = 'menu';
        document.body.style.overflow = '';
      } else if (!navLinks.classList.contains('open')) {
        navLinks.classList.add('hidden');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
  }

  let lastScroll = 0;
  let scrollTimeout;

  if (nav) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll <= 50) {
        nav.classList.remove('nav-hidden');
        nav.classList.add('nav-visible');
        return;
      }

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (currentScroll > lastScroll && currentScroll > 100) {
          nav.classList.add('nav-hidden');
          nav.classList.remove('nav-visible');
        } else {
          nav.classList.remove('nav-hidden');
          nav.classList.add('nav-visible');
        }
        lastScroll = currentScroll;
      }, 50);
    });
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-in, .animate-in-left, .animate-in-right').forEach((el) => {
    observer.observe(el);
  });

  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const items = entry.target.querySelectorAll('.stagger-item');
        items.forEach((item, i) => {
          setTimeout(() => {
            item.classList.add('visible');
          }, i * 100);
        });
        staggerObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.stagger-container').forEach((el) => {
    staggerObserver.observe(el);
  });

  document.querySelectorAll('.hero-fade-in').forEach((el) => {
    observer.observe(el);
  });

  // GDPR banner
  const gdprBanner = document.getElementById('gdpr-banner');
  const gdprDismiss = document.getElementById('gdpr-dismiss');
  if (gdprBanner && gdprDismiss && !localStorage.getItem('gdpr-dismissed')) {
    // Show after a brief delay
    setTimeout(() => {
      gdprBanner.classList.remove('translate-y-full');
    }, 500);
    gdprDismiss.addEventListener('click', () => {
      gdprBanner.classList.add('translate-y-full');
      localStorage.setItem('gdpr-dismissed', 'true');
    });
  }

  // GitHub star count
  const starEl = document.querySelector('.github-star-count');
  if (starEl) {
    const cached = sessionStorage.getItem('gh-stars');
    if (cached) {
      starEl.textContent = cached;
      starEl.classList.remove('hidden');
    } else {
      fetch('https://api.github.com/repos/apauldev/yotara')
        .then((r) => r.json())
        .then((data) => {
          if (data.stargazers_count != null) {
            const text = data.stargazers_count.toLocaleString();
            sessionStorage.setItem('gh-stars', text);
            starEl.textContent = text;
            starEl.classList.remove('hidden');
          }
        })
        .catch(() => {});
    }
  }
});
