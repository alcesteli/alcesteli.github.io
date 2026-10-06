const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const read = path => fs.readFileSync(path, 'utf8');

function harness(path = '/') {
  const listeners = {};
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { classList: { add() {}, remove() {}, toggle() {} }, scrollTo() {}, innerHTML: '', textContent: '' });
    return nodes.get(id);
  };
  const stack = [new URL(path, 'https://alcesteli.com')];
  const states = [null];
  let index = 0, pushes = 0;
  const c = vm.createContext({ console, URL, URLSearchParams, structuredClone, location: stack[0],
    document: { getElementById: node, querySelector: () => null, querySelectorAll: () => [], body: node('body'), documentElement: {} },
    history: {
      get state() { return states[index]; },
      pushState(state, _, path) { pushes++; stack.splice(++index); states.splice(index); stack[index] = new URL(path, c.location); states[index] = state; c.location = stack[index]; },
      replaceState(state, _, path) { stack[index] = new URL(path, c.location); states[index] = state; c.location = stack[index]; }
    },
    addEventListener: (type, fn) => listeners[type] = fn,
    scrollTo() {},
  });
  c.window = c;
  const run = code => vm.runInContext(code, c);
  run(read('js/translations-inline.js'));
  run(read('js/data.js'));
  run(read('js/router.js'));
  run(read('js/app.js').split('// Init')[0]);
  run(`
    function closeLightbox() {}
    function setHomeExpandedState(value) { homeExpanded = value; }
    function renderProject(cat, idx) { currentProjectState = {cat, idx}; }
    function renderProjectInfo() {}
    function highlightSidebarItem() {}
    function renderSidebarNav() {}
    function renderHomeSlider() {}
    function renderAboutPage() {}
    function initContactForm() {}
    function normalizeSiteLanguage(lang) { return lang; }
    function safeWriteStorage() {}
    const LANGUAGE_STORAGE_KEY = 'lang';
    function getUiText(key) { return key; }
    function escapeHtml(value) { return value; }
    function extractPostExcerpt() { return ''; }
    function renderPostBody(body) { return body; }
    const JournalAPI = { request: async () => ({data: [{slug:'antigone',title:'Antigone',body:''}]}) };
  `);
  // Exercise the actual compatible public project entry point.
  run(read('js/gallery.js').match(/function openProject\(cat, idx\) \{[\s\S]*?\n\}/)[0]);
  return { c, run, node, get pushes() { return pushes; }, traverse(delta) { index += delta; c.location = stack[index]; listeners.popstate(); } };
}

test('all 31 explicit project slugs are unique, URL-safe, and independent of ordering', () => {
  const h = harness();
  const slugs = h.run('Object.values(DATA).flatMap(c => c.items.map(p => p.slug))');
  assert.equal(slugs.length, 31);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const slug of slugs) {
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(h.run(`resolveRoute('/projects/${slug}').page`), 'project');
  }
  h.run('Object.values(DATA).forEach(c => c.items.reverse())');
  for (const slug of slugs) assert.equal(h.run(`(()=>{const r=resolveRoute('/projects/${slug}');return DATA[r.cat].items[r.idx].slug})()`), slug);
});

test('navigation, panel return, Back/Forward, mobile menu, language and titles', () => {
  const h = harness(); h.run('initRouter()');
  h.run("openProject('stageDesign',0)");
  assert.equal(h.c.location.pathname, '/projects/just-another-creation-myth');
  h.run('toggleAbout()'); assert.equal(h.c.document.title, 'About — Alceste Li');
  const before = h.pushes;
  h.run("switchLanguage('en')");
  assert.equal(h.c.location.pathname, '/about'); assert.equal(h.pushes, before);
  h.run('toggleAbout()'); assert.equal(h.run('_currPage'), 'project');
  h.run('toggleMenu()'); assert.equal(h.run('_activePanel'), 'menu');
  h.run('toggleMenu()'); assert.equal(h.run('_currPage'), 'project');
  h.run('goHome()'); assert.equal(h.c.document.title, 'Alceste Li');
  const count = h.pushes;
  h.traverse(-1); assert.equal(h.run('_currPage'), 'project');
  h.traverse(-1); assert.equal(h.run('_currPage'), 'about');
  h.traverse(1); assert.equal(h.run('_currPage'), 'project');
  h.traverse(1); assert.equal(h.run('_currPage'), 'home');
  assert.equal(h.pushes, count);
});

test('direct routes, trailing slash, malformed and missing projects', () => {
  for (const [path, page] of [['/about','about'], ['/journal','journal'], ['/projects/quai-ouest','project'], ['/about/?x=1#section','about'], ['/projects/missing','home'], ['/%ZZ','home']]) {
    const h = harness(path); h.run('initRouter()');
    assert.equal(h.run('_currPage'), page); assert.equal(h.pushes, 0);
    if (path.includes('?')) assert.equal(h.c.location.search + h.c.location.hash, '?x=1#section');
  }
});

test('async journal deep link, title, language, return, missing slug and stale loading', async () => {
  const h = harness('/journal/antigone?ref=test#body'); h.run('initRouter()');
  assert.equal(h.run('currentArticleSlug'), 'antigone');
  await h.run('loadJournalArticles()');
  assert.equal(h.c.document.title, 'Antigone — Alceste Li');
  h.run("switchLanguage('en'); switchLanguage('fr')");
  assert.equal(h.c.location.pathname + h.c.location.search + h.c.location.hash, '/journal/antigone?ref=test#body');
  assert.equal(h.pushes, 0);
  h.run('toggleJournal()'); assert.equal(h.c.location.pathname, '/journal');
  h.traverse(-1); assert.equal(h.c.document.title, 'Antigone — Alceste Li');
  h.run("openJournalArticle('missing')"); assert.equal(h.c.location.pathname, '/journal');
  const late = harness('/journal/antigone'); late.run('initRouter(); goHome()');
  await late.run('loadJournalArticles()');
  assert.equal(late.c.document.title, 'Alceste Li');
});

test('GitHub Pages fallback round-trips exact query/hash on both hosts without loops', () => {
  const redirect = read('404.html').match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const origin of ['https://alcesteli.com', 'https://alcesteli.github.io']) {
    for (const path of ['/about?a=1&a=2#test', '/journal/antigone?q=a%26b%3Dc&__spa_route=original#%E4%B8%AD', '/projects/quai-ouest?x=%25+%2B#image']) {
      let target;
      const location = new URL(path, origin); location.replace = p => target = p;
      vm.runInNewContext(redirect, { location, encodeURIComponent });
      let restored;
      vm.runInNewContext(read('js/route-restore.js'), { location: new URL(target, origin), URL, URLSearchParams, history: { replaceState: (_, __, p) => restored = p } });
      assert.equal(restored, path);
      target = null;
      const root = new URL('/', origin); root.replace = p => target = p;
      vm.runInNewContext(redirect, { location: root, encodeURIComponent }); assert.equal(target, null);
    }
  }
  for (const path of ['/admin.html','/debug-lang.html','/js/missing.js','/images/missing.png']) {
    let redirected = false;
    const location = new URL(path, 'https://alcesteli.com'); location.replace = () => redirected = true;
    vm.runInNewContext(redirect, { location, encodeURIComponent }); assert.equal(redirected, false);
  }
});


test('project FR/EN switch retains slug, history and translated title; all home links resolve', () => {
  const h = harness('/projects/quai-ouest?ref=home#image'); h.run('initRouter()');
  for (const lang of ['fr', 'en']) {
    h.run(`switchLanguage('${lang}')`);
    assert.equal(h.c.location.pathname + h.c.location.search + h.c.location.hash, '/projects/quai-ouest?ref=home#image');
    assert.equal(h.c.document.title, h.run('DATA[currentProjectState.cat].items[currentProjectState.idx].title') + ' — Alceste Li');
  }
  assert.equal(h.pushes, 0);
  assert.equal(h.run("HOME_SLIDES.filter(s => s.project).every(s => {const p=DATA[s.project.cat].items[s.project.idx]; return resolveRoute('/projects/'+p.slug).page === 'project';})"), true);
});
