const SUPPORTED_LANGS = new Set(['fr', 'en']);
const memoryStorage = {};

function safeGetStorageItem(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? (Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null) : value;
  } catch (_) {
    return Object.prototype.hasOwnProperty.call(memoryStorage, key) ? memoryStorage[key] : null;
  }
}

function safeSetStorageItem(key, value) {
  memoryStorage[key] = String(value);
  try {
    window.localStorage.setItem(key, String(value));
  } catch (_) {}
}

function normalizeLanguage(lang) {
  return SUPPORTED_LANGS.has(lang) ? lang : 'fr';
}

window.safeGetStorageItem = safeGetStorageItem;
window.safeSetStorageItem = safeSetStorageItem;

let currentLang = normalizeLanguage(safeGetStorageItem('lang') || 'fr');
let translations = {};
let appliedLang = normalizeLanguage(document.documentElement.lang || currentLang);
const escapeHtml = window.escapeHtml || (value => String(value));
const sanitizeRichText = window.sanitizeRichText || (html => String(html));

function getTranslationValue(path, fallback = '') {
  const value = path.split('.').reduce((acc, key) => acc && acc[key], translations);
  return value == null ? fallback : value;
}

function interpolateText(template, replacements = {}) {
  return Object.keys(replacements).reduce((output, key) => {
    const token = `{${key}}`;
    return output.split(token).join(String(replacements[key]));
  }, String(template));
}

window.getCurrentLanguage = () => appliedLang || currentLang || 'fr';
window.getTranslationText = (path, fallback = '', replacements = {}) => {
  const value = getTranslationValue(path, fallback);
  return typeof value === 'string' ? interpolateText(value, replacements) : value;
};

console.log('[LANG] Initialized with language:', currentLang);

function switchLanguage(lang) {
  lang = normalizeLanguage(lang);
  console.log('[LANG] Switching to:', lang, 'Current:', currentLang, 'Applied:', appliedLang);
  
  const hasLoadedTranslations = Object.keys(translations).length > 0;
  if (currentLang === lang && appliedLang === lang && hasLoadedTranslations) {
    console.log('[LANG] Language already fully applied:', lang);
    updateLanguageSwitcher();
    return;
  }
  
  currentLang = lang;
  safeSetStorageItem('lang', lang);
  console.log('[LANG] Language saved to storage');

  updateLanguageSwitcher();
  loadLanguageData(lang);
}

window.switchLanguage = switchLanguage;

function loadLanguageData(lang) {
  lang = normalizeLanguage(lang);
  const inlineTranslations = window.INLINE_TRANSLATIONS && window.INLINE_TRANSLATIONS[lang];
  if (inlineTranslations) {
    console.log('[LANG] Using inline translations for:', lang);
    translations = inlineTranslations;
    appliedLang = lang;
    document.documentElement.lang = lang;
    applyTranslations();
    return;
  }

  const filePath = `./data/${lang}.json`;
  console.log('[LANG] Fetching from:', filePath);
  
  fetch(filePath)
    .then(r => {
      console.log('[LANG] Fetch response status:', r.status, r.statusText);
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      return r.json();
    })
    .then(data => {
      console.log('[LANG] Data loaded successfully:', Object.keys(data));
      translations = data;
      appliedLang = lang;
      document.documentElement.lang = lang;
      applyTranslations();
    })
    .catch(err => {
      console.error('[LANG] Error loading translations:', err);
      console.error('[LANG] Tried path:', filePath);
      translations = (window.INLINE_TRANSLATIONS && window.INLINE_TRANSLATIONS.en) || {};
      appliedLang = 'en';
      document.documentElement.lang = 'en';
      if (Object.keys(translations).length > 0) {
        applyTranslations();
        return;
      }
      createLanguageSwitcher();
      updateLanguageSwitcher();
    });
}

function applyTranslations() {
  console.log('[LANG] Applying translations...');
  
  // Update sidebar text
  const aboutBtn = document.getElementById('sl-about');
  const contactBtn = document.getElementById('sl-contact');
  const menuBtn = document.getElementById('menu-btn');
  
  console.log('[LANG] Found buttons:', {
    about: !!aboutBtn,
    contact: !!contactBtn,
    menu: !!menuBtn
  });
  
  if (aboutBtn) aboutBtn.textContent = translations.sidebar && translations.sidebar.about || 'About';
  if (contactBtn) contactBtn.textContent = translations.sidebar && translations.sidebar.contact || 'Contact';
  if (menuBtn) menuBtn.textContent = translations.sidebar && translations.sidebar.menu || 'Menu';
  
  // Update About page content
  const aboutPage = document.getElementById('pg-about');
  if (aboutPage && translations.about) {
    console.log('[LANG] Updating About page');
    aboutPage.innerHTML = `
      <div class="content-block">
        <p class="eyebrow">${escapeHtml(translations.about.heading)}</p>
        <div class="about-copy">
          ${translations.about.content.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      </div>
    `;
  }
  
  // Update Contact page content  
  const contactPage = document.getElementById('pg-contact');
  if (contactPage && translations.contact) {
    console.log('[LANG] Updating Contact page');
    contactPage.innerHTML = `
      <div class="content-block">
        <p class="eyebrow">${escapeHtml(translations.contact && translations.contact.eyebrow || 'Get in Touch')}</p>
        <h2 class="heading">${sanitizeRichText(translations.contact.heading)}</h2>
        <form class="contact-form" id="contact-form" action="javascript:void(0);" novalidate>
          <div class="contact-field">
            <label class="contact-label" for="contact-name">${escapeHtml(translations.contact && translations.contact.nameLabel || 'Name')}</label>
            <input class="contact-input" id="contact-name" name="name" type="text" autocomplete="name" maxlength="80" required>
          </div>
          <div class="contact-field">
            <label class="contact-label" for="contact-email">${escapeHtml(translations.contact && translations.contact.emailLabel || 'Email')}</label>
            <input class="contact-input" id="contact-email" name="email" type="email" autocomplete="email" maxlength="254" required>
          </div>
          <div class="contact-field">
            <label class="contact-label" for="contact-subject">${escapeHtml(translations.contact && translations.contact.subjectLabel || 'Subject')}</label>
            <input class="contact-input" id="contact-subject" name="subject" type="text" maxlength="150" required>
          </div>
          <div class="contact-field">
            <label class="contact-label" for="contact-message">${escapeHtml(translations.contact && translations.contact.messageLabel || 'Message')}</label>
            <textarea class="contact-textarea" id="contact-message" name="message" maxlength="3000" required></textarea>
          </div>
          <input type="text" name="website" class="contact-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
          <input type="checkbox" name="botcheck" class="contact-honeypot" tabindex="-1" autocomplete="off">
          <input type="hidden" name="form_started_at" value="">
          <button class="contact-submit" id="contact-submit" type="button">${escapeHtml(translations.contact && translations.contact.submitLabel || 'Send Message')}</button>
          <p class="contact-note">${escapeHtml(translations.contact && translations.contact.note || 'Messages are sent directly from this form, without opening an email app.')}</p>
          <p class="contact-status" id="contact-status" aria-live="polite"></p>
        </form>
        <div class="contact-links">
          <a href="https://www.instagram.com/clapciodonagua?igsh=MXh6YTN6OHd3NTB0aw%3D%3D&utm_source=qr" target="_blank" rel="noopener noreferrer" class="c-row"><span class="c-row-name">Instagram</span><span class="c-row-arr">&#8599;</span></a>
          <a href="https://www.behance.net/alceste_li" target="_blank" rel="noopener noreferrer" class="c-row"><span class="c-row-name">Behance</span><span class="c-row-arr">&#8599;</span></a>
        </div>
      </div>
    `;
    if (window.initContactForm) window.initContactForm();
  }
  
  // Update sidebar project titles and categories
  updateSidebarText();
  updateHomeSlideTitles();
  
  // Create language switcher
  createLanguageSwitcher();
  console.log('[LANG] Translations applied');
}

function updateHomeSlideTitles() {
  const slides = document.querySelectorAll('.h-slide');
  if (!slides.length || !window.HOME_SLIDES) return;

  HOME_SLIDES.forEach((cfg, index) => {
    if (!cfg.project) return;
    const translationsForProject = translations.projects && translations.projects[cfg.project.cat] && translations.projects[cfg.project.cat].items;
    const translatedItem = translationsForProject && translationsForProject[cfg.project.idx];
    if (!translatedItem || !translatedItem.title) return;

    const slide = slides[index];
    const titleEl = slide && slide.querySelector('.h-slide-title');
    if (titleEl) {
      titleEl.textContent = translatedItem.title;
    }
  });
}

function updateSidebarText() {
  // Get all sidebar items and update their text
  document.querySelectorAll('.s-item').forEach(item => {
    const catAttr = item.parentElement && item.parentElement.previousElementSibling
      ? item.parentElement.previousElementSibling.getAttribute('data-cat')
      : null;
    const itemIndex = Array.from(item.parentElement.children).indexOf(item);
    
    if (catAttr && translations.projects && translations.projects[catAttr]) {
      const transItem = translations.projects[catAttr].items[itemIndex];
      if (transItem && transItem.title) {
        item.textContent = transItem.title;
      }
    }
  });
  
  // Update category labels
  document.querySelectorAll('.s-cat-head').forEach(head => {
    const catKey = head.getAttribute('data-cat');
    if (catKey && translations.categories && translations.categories[catKey]) {
      // Get the orig label before the arrow
      const arrow = head.querySelector('.s-cat-arr');
      head.textContent = translations.categories[catKey] + ' ';
      head.appendChild(arrow);
    }
  });
}

function createLanguageSwitcher() {
  console.log('[LANG] createLanguageSwitcher called');
  
  const switcher = document.getElementById('lang-switcher');
  console.log('[LANG] Switcher found:', !!switcher);

  if (!switcher) {
    console.error('[LANG] ERROR: #lang-switcher element not found!');
    return;
  }

  bindLanguageSwitcher(switcher);
  updateLanguageSwitcher();
}

function bindLanguageSwitcher(switcher) {
  if (switcher.dataset.bound === 'true') return;

  switcher.dataset.bound = 'true';
  switcher.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const lang = btn.dataset.lang;
      if (lang) switchLanguage(lang);
    });
  });
}

function updateLanguageSwitcher() {
  console.log('[LANG] updateLanguageSwitcher called');
  
  const switcher = document.getElementById('lang-switcher');
  if (!switcher) {
    console.warn('[LANG] Switcher not found when updating');
    return;
  }
  
  const btns = switcher.querySelectorAll('.lang-btn');
  console.log('[LANG] Found buttons:', btns.length);
  
  btns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === appliedLang);
  });
  console.log('[LANG] Updated button states. Requested:', currentLang, 'Applied:', appliedLang);
}

function syncMenuLabel() {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menu-btn');
  if (!menuBtn) return;
  const isOpen = !!(sidebar && sidebar.classList.contains('open'));
  menuBtn.textContent = isOpen
    ? window.getTranslationText('sidebar.close', 'Close')
    : window.getTranslationText('sidebar.menu', 'Menu');
}

// Override openProject to translate content
const origOpenProject = window.openProject;
window.openProject = function(cat, idx) {
  console.log('[LANG] openProject called:', cat, idx);
  origOpenProject.call(this, cat, idx);
  
  // Apply translations to the project page after it's loaded
  if (translations.projects && translations.projects[cat] && translations.projects[cat].items) {
    const transProject = translations.projects[cat].items[idx];
    console.log('[LANG] Found translated project:', !!transProject);
    
    if (transProject) {
      const pTitle = document.getElementById('p-title');
      const pDesc = document.getElementById('p-desc');
      const pCat = document.getElementById('p-cat');
      
      if (pTitle) pTitle.textContent = transProject.title || pTitle.textContent;
      if (pDesc) pDesc.innerHTML = sanitizeRichText(transProject.desc || pDesc.innerHTML);
      if (pCat && translations.categories && translations.categories[cat]) {
        pCat.textContent = translations.categories[cat];
      }
      
      // Update meta labels
      const metaRows = document.querySelectorAll('.proj-meta-row');
      const labels = [
        translations.projectMeta && translations.projectMeta.type || 'Type',
        translations.projectMeta && translations.projectMeta.client || 'Client',
        translations.projectMeta && translations.projectMeta.year || 'Year'
      ];
      metaRows.forEach((row, i) => {
        if (i < labels.length) {
          const label = row.querySelector('.proj-meta-label');
          if (label) label.textContent = labels[i];
        }
      });
      console.log('[LANG] Project translations applied');
    }
  } else {
    console.warn('[LANG] No translations or project data found for:', cat);
  }
  syncMenuLabel();
};

// Initialize when page is fully loaded
function initLanguageSystem() {
  console.log('[LANG] initLanguageSystem called. Document state:', document.readyState);
  document.documentElement.lang = currentLang;
  appliedLang = currentLang;
  
  // Make sure DOM is ready
  if (document.readyState === 'loading') {
    console.log('[LANG] DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[LANG] DOMContentLoaded fired');
      createLanguageSwitcher();
      updateLanguageSwitcher();
      syncMenuLabel();
      setTimeout(loadLanguage, 100);
    });
  } else {
    console.log('[LANG] DOM already ready, loading language immediately');
    createLanguageSwitcher();
    updateLanguageSwitcher();
    syncMenuLabel();
    setTimeout(loadLanguage, 100);
  }
}

function loadLanguage() {
  console.log('[LANG] loadLanguage called. Checking DOM elements...');
  
  // Verify DOM is ready
  const footer = document.querySelector('.s-foot');
  const aboutBtn = document.getElementById('sl-about');
  
  console.log('[LANG] DOM check:', {
    footerFound: !!footer,
    aboutBtnFound: !!aboutBtn,
    documentReady: document.readyState === 'complete'
  });
  
  if (!footer || !aboutBtn) {
    console.warn('[LANG] DOM not fully ready yet, retrying...');
    setTimeout(loadLanguage, 200);
    return;
  }
  
  loadLanguageData(currentLang);
}

initLanguageSystem();
