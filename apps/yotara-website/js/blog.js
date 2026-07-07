const PER_PAGE = 5;

const SITE_NAME = 'Yotara';
const SITE_URL = 'https://yotara.website';
const BLOG_DESCRIPTION =
  'Thoughts, updates, and deep dives into building focused digital environments.';

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function excerptFor(post) {
  if (post.excerpt) return post.excerpt;
  const text = post.content
    .join(' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = text.split(/\s+/);
  if (parts.length <= 40) return text;
  return parts.slice(0, 40).join(' ') + '...';
}

function renderContent(paragraphs) {
  return paragraphs.map((p) => `<p>${p.trim()}</p>`).join('');
}

function renderSrcset(url) {
  const base = url.split('?')[0];
  return `${base}?w=600&h=338&fit=crop 600w, ${base}?w=900&h=506&fit=crop 900w, ${base}?w=1200&h=675&fit=crop 1200w`;
}

function renderEntry(post) {
  const excerpt = excerptFor(post);
  const htmlContent = renderContent(post.content);
  return `
<article class="blog-card stagger-item group bg-surface-container-low rounded-2xl overflow-hidden transition-shadow duration-300" data-title="${escapeAttr(post.title)}" data-date="${post.date}" data-excerpt="${escapeAttr(excerpt)}">
  <div class="aspect-[16/9] overflow-hidden bg-surface-container-lowest">
     <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${post.image}" srcset="${renderSrcset(post.image)}" sizes="(max-width: 768px) 100vw, 896px" alt="${escapeAttr(post.title)}" loading="lazy" />
  </div>
  <div class="p-6 md:p-8">
    <div class="flex items-center gap-3 text-sm text-outline tracking-wide uppercase mb-3">
      <time datetime="${post.date}">${formatDate(post.date)}</time>
    </div>
    <h2 class="text-xl md:text-2xl font-display font-bold text-on-surface mb-3 group-hover:text-primary transition-colors">${escapeHtml(post.title)}</h2>
    <div class="text-on-surface-variant leading-relaxed">
      <div class="blog-excerpt">${escapeHtml(excerpt)}</div>
      <div class="blog-full hidden">
        <div class="mt-4 pt-4 border-t border-outline-variant/20">${htmlContent}</div>
      </div>
    </div>
    <button class="blog-toggle self-start mt-4 inline-flex items-center gap-2 text-primary font-semibold hover:text-primary-container transition-colors" aria-expanded="false">
      <span class="blog-toggle-text">Read more</span>
      <span class="blog-toggle-icon material-symbols-outlined text-sm transition-transform duration-300" aria-hidden="true">expand_more</span>
    </button>
  </div>
</article>`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;');
}

function renderPagination(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  let html = '<div class="flex items-center justify-center gap-2 mt-16">';
  for (let i = 1; i <= totalPages; i++) {
    const active = i === currentPage;
    html += `<button class="page-btn w-10 h-10 rounded-xl text-sm font-semibold transition-all duration-200 ${
      active
        ? 'bg-primary text-on-primary'
        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
    }" data-page="${i}">${i}</button>`;
  }
  html += '</div>';
  return html;
}

// ── SEO helpers ──────────────────────────────────────────────────────────

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    if (name.startsWith('og:') || name.startsWith('twitter:')) {
      el.setAttribute('property', name);
    } else {
      el.setAttribute('name', name);
    }
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function updatePageMeta(title, description) {
  document.title = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Blog`;
  setMeta('description', description || BLOG_DESCRIPTION);
  setMeta('og:title', document.title);
  setMeta('og:description', description || BLOG_DESCRIPTION);
  setMeta('og:url', window.location.href);
  setMeta('og:type', title ? 'article' : 'website');
  setMeta('twitter:title', document.title);
  setMeta('twitter:description', description || BLOG_DESCRIPTION);
  setMeta('twitter:card', 'summary_large_image');
}

function injectJsonLd(scriptId, schema) {
  let el = document.getElementById(scriptId);
  if (!el) {
    el = document.createElement('script');
    el.id = scriptId;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(schema);
}

function buildBlogJsonLd(posts) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} Blog`,
    description: BLOG_DESCRIPTION,
    url: `${SITE_URL}/blog.html`,
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: excerptFor(p),
      datePublished: p.date,
      image: p.image,
      author: {
        '@type': 'Person',
        name: 'apauldev',
      },
    })),
  };
}

function buildBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog.html` },
    ],
  };
}

// ── Init ─────────────────────────────────────────────────────────────────

function initBlog() {
  const container = document.getElementById('blog-container');
  const stagger = document.getElementById('blog-stagger');
  if (!container) return;

  let blogData = [];
  let currentPage = 1;
  let totalPages = 0;

  function renderPage(page) {
    const start = (page - 1) * PER_PAGE;
    const entries = blogData.slice(start, start + PER_PAGE);
    currentPage = page;

    container.innerHTML = entries.map((e) => renderEntry(e)).join('');
    stagger.innerHTML = renderPagination(page, totalPages);

    updatePageMeta(null, null);

    container.querySelectorAll('.blog-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.blog-card');
        const excerpt = card.querySelector('.blog-excerpt');
        const full = card.querySelector('.blog-full');
        const icon = btn.querySelector('.blog-toggle-icon');
        const text = btn.querySelector('.blog-toggle-text');
        const expanded = btn.getAttribute('aria-expanded') === 'true';

        if (expanded) {
          full.style.maxHeight = full.scrollHeight + 'px';
          requestAnimationFrame(() => {
            full.style.maxHeight = '0';
          });
          const onEnd = () => {
            full.classList.add('hidden');
            full.style.maxHeight = '';
            full.removeEventListener('transitionend', onEnd);
          };
          full.addEventListener('transitionend', onEnd, { once: true });
          updatePageMeta(null, null);
        } else {
          const title = card.dataset.title;
          const desc = card.dataset.excerpt;
          updatePageMeta(title, desc);
          full.classList.remove('hidden');
          full.style.maxHeight = '0';
          requestAnimationFrame(() => {
            full.style.maxHeight = full.scrollHeight + 'px';
          });
          const onEnd = () => {
            full.style.maxHeight = '';
            full.removeEventListener('transitionend', onEnd);
          };
          full.addEventListener('transitionend', onEnd, { once: true });
        }

        btn.setAttribute('aria-expanded', String(!expanded));
        icon.classList.toggle('rotate-180');
        text.textContent = expanded ? 'Read more' : 'Read less';
      });
    });

    stagger.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        renderPage(parseInt(btn.dataset.page));
        document
          .getElementById('blog-container')
          ?.previousElementSibling?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' },
    );

    container.querySelectorAll('.stagger-item').forEach((el) => observer.observe(el));

    // Update JSON-LD for visible posts
    injectJsonLd('ld-blog', buildBlogJsonLd(blogData));
    injectJsonLd('ld-breadcrumbs', buildBreadcrumbJsonLd());
  }

  fetch('data/blog.json')
    .then((r) => r.json())
    .then((data) => {
      blogData = data.sort((a, b) => b.date.localeCompare(a.date));
      totalPages = Math.ceil(blogData.length / PER_PAGE);
      renderPage(1);
    });
}

document.addEventListener('DOMContentLoaded', initBlog);
