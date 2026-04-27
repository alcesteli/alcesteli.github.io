function getActiveTranslations(lang) {
  return window.INLINE_TRANSLATIONS && window.INLINE_TRANSLATIONS[lang]
    ? window.INLINE_TRANSLATIONS[lang]
    : null;
}

function getNestedTranslation(source, path, fallback = '') {
  const value = path.split('.').reduce((acc, key) => acc && acc[key], source);
  return value == null ? fallback : value;
}

window.getCurrentLanguage = function() {
  return siteLang;
};

window.getTranslationText = function(path, fallback = '', replacements = {}) {
  const source = getActiveTranslations(siteLang) || {};
  let output = getNestedTranslation(source, path, fallback);
  if (typeof output !== 'string') return output;
  Object.keys(replacements).forEach(key => {
    output = output.split(`{${key}}`).join(String(replacements[key]));
  });
  return output;
};

function syncLangButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-lang') === siteLang);
  });
}

function applyStaticTranslations(lang) {
  const tr = getActiveTranslations(lang) || {};
  document.documentElement.lang = lang;
  renderAboutPage(tr.about || {});
  renderContactPage(tr.contact || {});
  syncLangButtons();
  refreshNavButtons();
}

function renderAboutPage(about) {
  const aboutPage = document.getElementById('pg-about');
  if (!aboutPage || !about.content) return;
  aboutPage.innerHTML = `
    <div class="content-block">
      <p class="eyebrow">${escapeHtml(about.heading || 'About')}</p>
      <div class="about-copy">
        ${about.content.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      </div>
    </div>
  `;
}

function renderContactPage(contact) {
  const contactPage = document.getElementById('pg-contact');
  if (!contactPage || !contact.heading) return;
  contactPage.innerHTML = `
    <div class="content-block">
      <p class="eyebrow">${escapeHtml(contact.eyebrow || 'Get in Touch')}</p>
      <h2 class="heading">${sanitizeRichText(contact.heading)}</h2>
      <form class="contact-form" id="contact-form" action="javascript:void(0);" novalidate>
        <div class="contact-field">
          <label class="contact-label" for="contact-name">${escapeHtml(contact.nameLabel || 'Name')}</label>
          <input class="contact-input" id="contact-name" name="name" type="text" autocomplete="name" maxlength="80" required>
        </div>
        <div class="contact-field">
          <label class="contact-label" for="contact-email">${escapeHtml(contact.emailLabel || 'Email')}</label>
          <input class="contact-input" id="contact-email" name="email" type="email" autocomplete="email" maxlength="254" required>
        </div>
        <div class="contact-field">
          <label class="contact-label" for="contact-message">${escapeHtml(contact.messageLabel || 'Message')}</label>
          <textarea class="contact-textarea" id="contact-message" name="message" maxlength="3000" required></textarea>
        </div>
        <input type="text" name="website" class="contact-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
        <input type="checkbox" name="botcheck" class="contact-honeypot" tabindex="-1" autocomplete="off">
        <input type="hidden" name="form_started_at" value="">
        <button class="contact-submit" id="contact-submit" type="button">${escapeHtml(contact.submitLabel || 'Send Message')}</button>
        <p class="contact-note">${escapeHtml(contact.note || 'Messages are sent directly from this form, without opening an email app.')}</p>
        <p class="contact-status" id="contact-status" aria-live="polite"></p>
      </form>
      <div class="contact-links">
        <a href="https://www.instagram.com/clapciodonagua?igsh=MXh6YTN6OHd3NTB0aw%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" class="c-row"><span class="c-row-name">Instagram</span><span class="c-row-arr" aria-hidden="true"><svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"><path d="M3.5 8.5 L8.5 3.5 M5 3.5 H8.5 V7"/></svg></span></a>
        <a href="https://www.behance.net/alceste_li" target="_blank" rel="noopener noreferrer" class="c-row"><span class="c-row-name">Behance</span><span class="c-row-arr" aria-hidden="true"><svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1"><path d="M3.5 8.5 L8.5 3.5 M5 3.5 H8.5 V7"/></svg></span></a>
      </div>
    </div>
  `;
}

function applyDataTranslations(lang) {
  Object.keys(BASE_DATA).forEach(catKey => {
    DATA[catKey] = structuredClone(BASE_DATA[catKey]);
  });

  if (lang !== 'fr') return;

  const tr = getActiveTranslations(lang) || {};
  const categories = tr.categories || {};
  const projects = tr.projects || {};

  Object.keys(DATA).forEach(catKey => {
    if (categories[catKey]) DATA[catKey].label = categories[catKey];
    const translatedItems = projects[catKey] && projects[catKey].items;
    if (!translatedItems) return;
    DATA[catKey].items.forEach((item, index) => {
      const translatedItem = translatedItems[index];
      if (!translatedItem) return;
      if (translatedItem.title) item.title = translatedItem.title;
      if (translatedItem.desc) item.desc = translatedItem.desc;
    });
  });
}

const sNav = document.getElementById('s-nav');
const track = document.getElementById('h-track');

function renderSidebarNav() {
  sNav.innerHTML = `
    <div id="lang-switcher">
      <button class="lang-btn${siteLang === 'fr' ? ' active' : ''}" type="button" data-lang="fr" onclick="switchLanguage('fr')">FR</button>
      <span class="lang-sep">|</span>
      <button class="lang-btn${siteLang === 'en' ? ' active' : ''}" type="button" data-lang="en" onclick="switchLanguage('en')">EN</button>
    </div>
  `;
  Object.keys(DATA).forEach(catKey => {
    const cat = DATA[catKey];
    const group = document.createElement('div');
    group.innerHTML = `
      <div class="s-cat-head closed" data-cat="${escapeHtml(catKey)}" onclick="this.classList.toggle('closed')">${escapeHtml(cat.label)} <span class="s-cat-arr">▾</span></div>
      <div class="s-items">
        ${cat.items.map((item, i) => `<div class="s-item" id="si-${escapeHtml(catKey)}-${i}" onclick="openProject('${catKey}', ${i})">${escapeHtml(item.title)}</div>`).join('')}
      </div>
    `;
    sNav.appendChild(group);
  });
}

window.switchLanguage = function(lang) {
  siteLang = normalizeSiteLanguage(lang);
  safeWriteStorage(LANGUAGE_STORAGE_KEY, siteLang);
  applyDataTranslations(siteLang);
  applyStaticTranslations(siteLang);
  renderSidebarNav();
  renderHomeSlider();
  initContactForm();
  if (currentProjectState.cat !== null) openProject(currentProjectState.cat, currentProjectState.idx);
};

let _prevPage = 'home';
let _currPage = 'home';
let _activePanel = null; // 'menu' | 'about' | 'contact' | null

function refreshNavButtons() {
  const menuBtn = document.getElementById('menu-btn');
  const aboutBtn = document.getElementById('sl-about');
  const contactBtn = document.getElementById('sl-contact');
  if (menuBtn) menuBtn.textContent = _activePanel === 'menu' ? getUiText('sidebar.close') : getUiText('sidebar.menu');
  if (aboutBtn) aboutBtn.textContent = _activePanel === 'about' ? getUiText('sidebar.close') : getUiText('sidebar.about');
  if (contactBtn) contactBtn.textContent = _activePanel === 'contact' ? getUiText('sidebar.close') : getUiText('sidebar.contact');
}

function _renderPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-' + id).classList.add('on');
  document.body.classList.toggle('home-active', id === 'home');
  document.getElementById('sl-about').classList.toggle('on', id === 'about');
  document.getElementById('sl-contact').classList.toggle('on', id === 'contact');
  window.scrollTo(0, 0);
  if (id === 'project') document.getElementById('pg-project').scrollTo({ top: 0, behavior: 'auto' });
  if (id === 'home') setHomeExpandedState(false);
}

function _closeActivePanel() {
  if (_activePanel === 'menu') {
    document.getElementById('sidebar').classList.remove('open');
  } else if (_activePanel === 'about' || _activePanel === 'contact') {
    const back = (_prevPage === _activePanel || !_prevPage) ? 'home' : _prevPage;
    _prevPage = _currPage;
    _currPage = back;
    _renderPage(back);
  }
  _activePanel = null;
}

function openPanel(panel) {
  if (_activePanel === panel) {
    _closeActivePanel();
  } else {
    _closeActivePanel();
    _activePanel = panel;
    if (panel === 'menu') {
      document.getElementById('sidebar').classList.add('open');
    } else {
      _prevPage = _currPage;
      _currPage = panel;
      _renderPage(panel);
    }
  }
  refreshNavButtons();
}

function showPage(id) {
  _activePanel = null;
  document.getElementById('sidebar').classList.remove('open');
  _prevPage = _currPage;
  _currPage = id;
  _renderPage(id);
  refreshNavButtons();
}

window.toggleAbout = function() { openPanel('about'); };
window.toggleContact = function() { openPanel('contact'); };
function toggleMenu() { openPanel('menu'); }
function goHome() { showPage('home'); }

// Init
siteLang = normalizeSiteLanguage(safeReadStorage(LANGUAGE_STORAGE_KEY) || 'fr');
applyDataTranslations(siteLang);
applyStaticTranslations(siteLang);
renderSidebarNav();
renderHomeSlider();
document.body.classList.add('home-active');
initContactForm();
