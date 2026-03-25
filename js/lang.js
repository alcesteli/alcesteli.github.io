let currentLang = localStorage.getItem('lang') || 'fr'; // Default: French
let translations = {};
let isApplying = false;

// Load translations
async function loadTranslations() {
  if (isApplying) return;
  isApplying = true;
  
  try {
    const response = await fetch(`/data/${currentLang}.json`);
    translations = await response.json();
    
    // Ensure we apply translations after a short delay to let DOM settle
    setTimeout(applyTranslations, 100);
  } catch (error) {
    console.error('Error loading translations:', error);
    isApplying = false;
  }
}

// Switch language
function switchLanguage(lang) {
  if (currentLang === lang) return; // Already in this language
  currentLang = lang;
  localStorage.setItem('lang', lang);
  isApplying = false;
  loadTranslations();
}

// Apply translations to DOM
function applyTranslations() {
  if (!translations || Object.keys(translations).length === 0) {
    isApplying = false;
    return;
  }
  
  // Update sidebar buttons text
  const aboutBtn = document.getElementById('sl-about');
  const contactBtn = document.getElementById('sl-contact');
  const menuBtn = document.getElementById('menu-btn');
  
  if (aboutBtn) aboutBtn.textContent = translations.sidebar.about;
  if (contactBtn) contactBtn.textContent = translations.sidebar.contact;
  if (menuBtn) menuBtn.textContent = translations.sidebar.menu;
  
  // Update About page
  const aboutSection = document.getElementById('pg-about');
  if (aboutSection) {
    aboutSection.innerHTML = `
      <div class="content-block">
        <p class="eyebrow">${translations.about.heading}</p>
        <div class="about-copy">
          ${translations.about.content.map(p => `<p>${p}</p>`).join('')}
        </div>
      </div>
    `;
  }
  
  // Update Contact page
  const contactSection = document.getElementById('pg-contact');
  if (contactSection) {
    contactSection.innerHTML = `
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
  
  // Create/update language switcher
  createLanguageSwitcher();
  
  // Rebuild sidebar with translations
  rebuildSidebar();
  
  isApplying = false;
}

// Create language switcher
function createLanguageSwitcher() {
  let switcher = document.getElementById('lang-switcher');
  if (!switcher) {
    switcher = document.createElement('div');
    switcher.id = 'lang-switcher';
    document.body.appendChild(switcher);
  }
  
  switcher.innerHTML = `
    <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="switchLanguage('en')">EN</button>
    <button class="lang-btn ${currentLang === 'fr' ? 'active' : ''}" onclick="switchLanguage('fr')">FR</button>
  `;
}

// Rebuild sidebar with translated categories and items
function rebuildSidebar() {
  const sNav = document.getElementById('s-nav');
  if (!sNav || !window.DATA) {
    console.log('Waiting for DATA and DOM...');
    return;
  }
  
  sNav.innerHTML = '';
  
  Object.keys(DATA).forEach(catKey => {
    const cat = DATA[catKey];
    const translatedLabel = translations.categories ? (translations.categories[catKey] || cat.label) : cat.label;
    const transItems = translations.projects ? (translations.projects[catKey]?.items || []) : [];
    
    const group = document.createElement('div');
    group.innerHTML = `
      <div class="s-cat-head closed" data-cat="${catKey}" onclick="this.classList.toggle('closed')">${translatedLabel} <span class="s-cat-arr">▾</span></div>
      <div class="s-items">
        ${cat.items.map((item, i) => {
          const transTitle = transItems[i]?.title || item.title;
          return `<div class="s-item" id="si-${catKey}-${i}" onclick="openProject('${catKey}', ${i})">${transTitle}</div>`;
        }).join('')}
      </div>
    `;
    sNav.appendChild(group);
  });
}

// Store original openProject
const originalOpenProject = window.openProject;

// Override openProject to use translated content
window.openProject = function(cat, idx) {
  const p = DATA[cat].items[idx];
  const transProject = translations.projects ? (translations.projects[cat]?.items[idx] || {}) : {};
  window.currentProjImages = p.images || [];

  // Highlight sidebar item and expand category
  document.querySelectorAll('.s-item.on').forEach(el => el.classList.remove('on'));
  const activeItem = document.getElementById(`si-${cat}-${idx}`);
  if (activeItem) activeItem.classList.add('on');
  const catHead = document.querySelector(`.s-cat-head[data-cat="${cat}"]`);
  if (catHead) catHead.classList.remove('closed');

  // Hero image
  const pHero = document.getElementById('p-hero');
  if (pHero) {
    pHero.innerHTML = window.currentProjImages.length > 0 
      ? `<img src="${window.currentProjImages[0]}" onclick="openLightbox(0)" />` 
      : `<div class="ph">No Image</div>`;
  }
  
  // Gallery
  const pGallery = document.getElementById('p-gallery');
  if (pGallery) {
    let galleryHtml = '';
    for (let k = 1; k < window.currentProjImages.length; k++) {
      galleryHtml += `<div class="proj-img-wrap"><img src="${window.currentProjImages[k]}" onclick="openLightbox(${k})" /></div>`;
    }
    pGallery.innerHTML = galleryHtml;
  }

  // Update project info
  const pCat = document.getElementById('p-cat');
  const pTitle = document.getElementById('p-title');
  const pDesc = document.getElementById('p-desc');
  const pMeta = document.getElementById('p-meta');
  
  if (pCat) pCat.innerText = translations.categories ? (translations.categories[cat] || DATA[cat].label) : DATA[cat].label;
  if (pTitle) pTitle.innerText = transProject.title || p.title;
  if (pDesc) pDesc.innerHTML = transProject.desc || p.desc;
  
  if (pMeta) {
    const typeLabel = translations.projectMeta ? translations.projectMeta.type : 'Type';
    const clientLabel = translations.projectMeta ? translations.projectMeta.client : 'Client';
    const yearLabel = translations.projectMeta ? translations.projectMeta.year : 'Year';
    
    pMeta.innerHTML = `
      <div class="proj-meta-row"><span class="proj-meta-label">${typeLabel}</span><span>${p.type}</span></div>
      <div class="proj-meta-row"><span class="proj-meta-label">${clientLabel}</span><span>${p.client}</span></div>
      <div class="proj-meta-row"><span class="proj-meta-label">${yearLabel}</span><span>${p.year}</span></div>
    `;
  }
  
  showPage('project');
};

// Wait for DOM and DATA to be ready
function initLanguageSystem() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadTranslations);
  } else {
    // DOM is already ready
    loadTranslations();
  }
}

// Initialize when script loads
initLanguageSystem();
