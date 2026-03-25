let currentLang = localStorage.getItem('lang') || 'fr';
let translations = {};

console.log('[LANG] Initialized with language:', currentLang);

function switchLanguage(lang) {
  console.log('[LANG] Switching to:', lang, 'Current:', currentLang);
  
  if (currentLang === lang) {
    console.log('[LANG] Language already set to', lang);
    return;
  }
  
  currentLang = lang;
  localStorage.setItem('lang', lang);
  console.log('[LANG] Language saved to localStorage');
  
  loadLanguageData(lang);
}

function loadLanguageData(lang) {
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
      applyTranslations();
    })
    .catch(err => {
      console.error('[LANG] Error loading translations:', err);
      console.error('[LANG] Tried path:', filePath);
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
  
  if (aboutBtn) aboutBtn.textContent = translations.sidebar?.about || 'About';
  if (contactBtn) contactBtn.textContent = translations.sidebar?.contact || 'Contact';
  if (menuBtn) menuBtn.textContent = translations.sidebar?.menu || 'Menu';
  
  // Update About page content
  const aboutPage = document.getElementById('pg-about');
  if (aboutPage && translations.about) {
    console.log('[LANG] Updating About page');
    aboutPage.innerHTML = `
      <div class="content-block">
        <p class="eyebrow">${translations.about.heading}</p>
        <div class="about-copy">
          ${translations.about.content.map(p => `<p>${p}</p>`).join('')}
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
        <p class="eyebrow">Get in Touch</p>
        <h2 class="heading">${translations.contact.heading}</h2>
        <a href="mailto:contact@hidden.invalid" class="contact-email">contact@hidden.invalid</a>
        <div class="contact-links">
          <a href="https://www.instagram.com/clapciodonagua?igsh=MXh6YTN6OHd3NTB0aw%3D%3D&utm_source=qr" target="_blank" class="c-row"><span class="c-row-name">Instagram</span><span class="c-row-arr">&#8599;</span></a>
          <a href="https://www.behance.net/alceste_li" target="_blank" class="c-row"><span class="c-row-name">Behance</span><span class="c-row-arr">&#8599;</span></a>
        </div>
      </div>
    `;
  }
  
  // Update sidebar project titles and categories
  updateSidebarText();
  
  // Create language switcher
  createLanguageSwitcher();
  console.log('[LANG] Translations applied');
}

function updateSidebarText() {
  // Get all sidebar items and update their text
  document.querySelectorAll('.s-item').forEach(item => {
    const catAttr = item.parentElement?.previousElementSibling?.getAttribute('data-cat');
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
  
  const footer = document.querySelector('.s-foot');
  console.log('[LANG] Footer found:', !!footer);
  
  if (!footer) {
    console.error('[LANG] ERROR: .s-foot element not found!');
    console.error('[LANG] Available footer-like elements:', document.querySelectorAll('[class*="foot"], [class*="nav"], aside').length);
    return;
  }
  
  // Check if already added
  const existing = document.getElementById('lang-switcher');
  console.log('[LANG] Existing switcher:', !!existing);
  
  if (existing) {
    console.log('[LANG] Updating existing switcher');
    updateLanguageSwitcher();
    return;
  }
  
  // Create switcher div and add to footer
  const switcher = document.createElement('div');
  switcher.id = 'lang-switcher';
  
  switcher.innerHTML = `
    <button class="lang-btn ${currentLang === 'fr' ? 'active' : ''}" onclick="window.switchLanguage('fr')">FR</button>
    <span class="lang-sep">|</span>
    <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="window.switchLanguage('en')">EN</button>
  `;
  
  footer.appendChild(switcher);
  console.log('[LANG] Language switcher created and appended. Current lang:', currentLang);
  console.log('[LANG] Switcher element:', switcher);
  console.log('[LANG] Switcher HTML:', switcher.innerHTML);
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
  
  if (btns.length >= 2) {
    btns[0].classList.toggle('active', currentLang === 'fr');
    btns[1].classList.toggle('active', currentLang === 'en');
    console.log('[LANG] Updated button states for lang:', currentLang);
  }
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
      if (pDesc) pDesc.innerHTML = transProject.desc || pDesc.innerHTML;
      if (pCat && translations.categories && translations.categories[cat]) {
        pCat.textContent = translations.categories[cat];
      }
      
      // Update meta labels
      const metaRows = document.querySelectorAll('.proj-meta-row');
      const labels = [
        translations.projectMeta?.type || 'Type',
        translations.projectMeta?.client || 'Client',
        translations.projectMeta?.year || 'Year'
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
};

// Initialize when page is fully loaded
function initLanguageSystem() {
  console.log('[LANG] initLanguageSystem called. Document state:', document.readyState);
  
  // Make sure DOM is ready
  if (document.readyState === 'loading') {
    console.log('[LANG] DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[LANG] DOMContentLoaded fired');
      setTimeout(loadLanguage, 100);
    });
  } else {
    console.log('[LANG] DOM already ready, loading language immediately');
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
