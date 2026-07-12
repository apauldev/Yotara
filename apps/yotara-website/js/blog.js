const PER_PAGE = 5;

const SITE_NAME = 'Yotara';
const SITE_URL = 'https://yotara.website';
const BLOG_DESCRIPTION =
  'Thoughts, updates, and deep dives into building focused digital environments.';
const SITE_AUTHOR = { name: 'apauldev', avatar: 'assets/author-thumb.jpg' };

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function excerptFor(post) {
  if (post.excerpt) return post.excerpt;
  const text = post.content.join(' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  const parts = text.split(/\s+/);
  if (parts.length <= 40) return text;
  return parts.slice(0, 40).join(' ') + '...';
}

function readingTimeFor(content) {
  const words = content.join(' ').split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function renderContent(paragraphs) {
  return paragraphs.map((p) => `<p>${p.trim()}</p>`).join('');
}

function renderSrcset(url) {
  const base = url.split('?')[0];
  return `${base}?w=600&h=338&fit=crop 600w, ${base}?w=900&h=506&fit=crop 900w, ${base}?w=1200&h=675&fit=crop 1200w`;
}

function slugFor(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function renderEntry(post) {
  const excerpt = excerptFor(post);
  const htmlContent = renderContent(post.content);
  const slug = slugFor(post.title);
  return `
<article class="blog-card stagger-item group bg-surface-container-low rounded-2xl overflow-hidden transition-shadow duration-300" data-title="${escapeAttr(post.title)}" data-slug="${escapeAttr(slug)}" data-date="${post.date}" data-excerpt="${escapeAttr(excerpt)}">
  <div class="aspect-[16/9] overflow-hidden bg-surface-container-lowest">
     <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${post.image}" srcset="${renderSrcset(post.image)}" sizes="(max-width: 768px) 100vw, 896px" alt="${escapeAttr(post.title)}" loading="lazy" />
  </div>
  <div class="p-6 md:p-8">
    <div class="flex items-center gap-2 text-sm text-outline tracking-wide mb-3 flex-wrap">
      <time datetime="${post.date}">${formatDate(post.date)}</time>
      <span aria-hidden="true">·</span>
      <span class="flex items-center gap-2">
        <img class="blog-author-avatar" src="${post.author?.avatar || SITE_AUTHOR.avatar}" alt="${escapeAttr(post.author?.name || SITE_AUTHOR.name)}" width="36" height="36" loading="lazy" />
        <span>${escapeHtml(post.author?.name || SITE_AUTHOR.name)}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>${readingTimeFor(post.content)}</span>
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

function updatePageMeta(title, description, image) {
  const isPost = !!title;
  document.title = isPost ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Blog`;
  const desc = description || BLOG_DESCRIPTION;
  const url = isPost
    ? `${SITE_URL}/blog#${encodeURIComponent(slugFor(title))}`
    : `${SITE_URL}/blog`;
  const img = image || `${SITE_URL}/assets/project1.webp`;

  setMeta('description', desc);
  setMeta('og:title', document.title);
  setMeta('og:description', desc);
  setMeta('og:url', url);
  setMeta('og:type', isPost ? 'article' : 'website');
  setMeta('og:image', img);
  setMeta('twitter:title', document.title);
  setMeta('twitter:description', desc);
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:image', img);
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
  const publisher = {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/logo.svg` },
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${SITE_NAME} Blog`,
    description: BLOG_DESCRIPTION,
    url: `${SITE_URL}/blog`,
    publisher,
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      description: excerptFor(p),
      datePublished: p.date,
      dateModified: p.date,
      image: p.image,
      url: `${SITE_URL}/blog#${slugFor(p.title)}`,
      author: {
        '@type': 'Person',
        name: p.author?.name || SITE_AUTHOR.name,
      },
      publisher,
    })),
  };
}

function buildBreadcrumbJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
    ],
  };
}

// ── Hash routing ─────────────────────────────────────────────────────────

function getHashSlug() {
  return window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
}

function expandCard(card) {
  const full = card.querySelector('.blog-full');
  const btn = card.querySelector('.blog-toggle');
  const icon = btn.querySelector('.blog-toggle-icon');
  const text = btn.querySelector('.blog-toggle-text');

  if (btn.getAttribute('aria-expanded') === 'true') return;

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

  btn.setAttribute('aria-expanded', 'true');
  icon.classList.add('rotate-180');
  text.textContent = 'Read less';

  const title = card.dataset.title;
  const desc = card.dataset.excerpt;
  const img = card.querySelector('img')?.src || '';
  updatePageMeta(title, desc, img);
}

function collapseCard(card) {
  const full = card.querySelector('.blog-full');
  const btn = card.querySelector('.blog-toggle');
  const icon = btn.querySelector('.blog-toggle-icon');
  const text = btn.querySelector('.blog-toggle-text');

  if (btn.getAttribute('aria-expanded') === 'false') return;

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

  btn.setAttribute('aria-expanded', 'false');
  icon.classList.remove('rotate-180');
  text.textContent = 'Read more';

  updatePageMeta(null, null);
}

function collapseAllCards(container) {
  container.querySelectorAll('.blog-card').forEach((card) => {
    if (card.querySelector('.blog-toggle').getAttribute('aria-expanded') === 'true') {
      collapseCard(card);
    }
  });
}

function expandByHash(container) {
  const slug = getHashSlug();
  if (!slug) return;

  const card = container.querySelector(`[data-slug="${CSS.escape(slug)}"]`);
  if (card) {
    expandCard(card);
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ── Init ─────────────────────────────────────────────────────────────────

function initBlog() {
  const container = document.getElementById('blog-container');
  const stagger = document.getElementById('blog-stagger');
  if (!container) return;

  let blogData = [];
  let totalPages = 0;

  function renderPage(page) {
    const start = (page - 1) * PER_PAGE;
    const entries = blogData.slice(start, start + PER_PAGE);

    container.innerHTML = entries.map((e) => renderEntry(e)).join('');
    stagger.innerHTML = renderPagination(page, totalPages);

    updatePageMeta(null, null);

    container.querySelectorAll('.blog-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.blog-card');
        const expanded = btn.getAttribute('aria-expanded') === 'true';

        if (expanded) {
          collapseCard(card);
          history.replaceState(null, '', window.location.pathname + window.location.search);
        } else {
          collapseAllCards(container);
          expandCard(card);
          history.replaceState(null, '', `#${card.dataset.slug}`);
        }
      });
    });

    stagger.querySelectorAll('.page-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        history.replaceState(null, '', window.location.pathname + window.location.search);
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

    injectJsonLd('ld-blog', buildBlogJsonLd(blogData));
    injectJsonLd('ld-breadcrumbs', buildBreadcrumbJsonLd());

    expandByHash(container);
  }

  window.addEventListener('hashchange', () => {
    collapseAllCards(container);
    expandByHash(container);
  });

  fetch('data/blog.json')
    .then((r) => r.json())
    .then((data) => {
      blogData = data.sort((a, b) => b.date.localeCompare(a.date));
      totalPages = Math.ceil(blogData.length / PER_PAGE);

      const hash = getHashSlug();
      let page = 1;
      if (hash) {
        const idx = blogData.findIndex((p) => slugFor(p.title) === hash);
        if (idx >= 0) page = Math.floor(idx / PER_PAGE) + 1;
      }
      renderPage(page);
    });
}

document.addEventListener('DOMContentLoaded', initBlog);
