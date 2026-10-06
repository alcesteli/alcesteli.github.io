// Root-domain SPA routing. Project identity comes from explicit catalog slugs.
let panelReturnPath = '/';

function resolveRoute(pathname) {
  let path;
  try { path = decodeURIComponent(pathname).replace(/\/+$/, '') || '/'; }
  catch (_) { return { page: 'home', path: '/' }; }
  if (path === '/' || path === '/index.html') return { page: 'home', path: '/' };
  if (path === '/about' || path === '/journal') return { page: path.slice(1), path };
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    for (const [cat, category] of Object.entries(DATA)) {
      const idx = category.items.findIndex(item => item.slug === projectMatch[1]);
      if (idx !== -1) return { page: 'project', path: '/projects/' + category.items[idx].slug, cat, idx };
    }
  }
  const articleMatch = path.match(/^\/journal\/([^/]+)$/);
  if (articleMatch) return { page: 'article', path: '/journal/' + encodeURIComponent(articleMatch[1]), slug: articleMatch[1] };
  return { page: 'home', path: '/' };
}

function updateRouteMetadata() {
  let title = 'Alceste Li';
  if (_currPage === 'about') title = 'About — Alceste Li';
  if (_currPage === 'journal' || _currPage === 'article') title = 'Journal — Alceste Li';
  if (_currPage === 'project') {
    const project = DATA[currentProjectState.cat]?.items[currentProjectState.idx];
    if (project) title = project.title + ' — Alceste Li';
  }
  if (_currPage === 'article') {
    const article = JOURNAL_ARTICLES.find(item => item.slug === currentArticleSlug);
    if (article) title = article.title + ' — Alceste Li';
  }
  document.title = title;
}

function navigateRoute(path, { replace = false, pop = false } = {}) {
  const url = new URL(path, location.origin);
  const route = resolveRoute(url.pathname);
  const target = route.path + url.search + url.hash;
  if (pop) {
    panelReturnPath = history.state?.panelReturnPath || '/';
  } else if (_currPage === 'home' || _currPage === 'project') {
    panelReturnPath = resolveRoute(location.pathname).path + location.search + location.hash;
  }
  const state = { panelReturnPath };
  // History traversal never pushes. Normalization/fallback only replaces.
  if (pop || replace) history.replaceState(state, '', target);
  else if (target !== location.pathname + location.search + location.hash) history.pushState(state, '', target);

  closeLightbox();
  document.getElementById('sidebar').classList.remove('open');
  _prevPage = _currPage;
  _currPage = route.page;
  _activePanel = ['about', 'journal', 'article'].includes(route.page) ? route.page : null;
  currentArticleSlug = route.page === 'article' ? route.slug : null;
  if (route.page === 'project') renderProject(route.cat, route.idx);
  _renderPage(route.page);
  if (route.page === 'journal') renderJournalList();
  if (route.page === 'article') renderArticlePage(route.slug);
  refreshNavButtons();
  updateRouteMetadata();
}

function initRouter() {
  history.scrollRestoration = 'manual';
  window.addEventListener('popstate', () => {
    navigateRoute(location.pathname + location.search + location.hash, { pop: true });
  });
  navigateRoute(location.pathname + location.search + location.hash, { replace: true });
}
