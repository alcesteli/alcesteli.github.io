let currentLang = localStorage.getItem('lang') || 'fr';
let translations = {};

function switchLanguage(lang) {
  if (currentLang === lang) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  
  fetch(`/data/${lang}.json`)
    .then(r => r.json())
    .then(data => {
      translations = data;
      applyTranslations();
    });
}

function applyTranslations() {
  // Update sidebar text
  const aboutBtn = document.getElementById('sl-about');
  const contactBtn = document.getElementById('sl-contact');
  const menuBtn = document.getElementById('menu-btn');
  
  if (aboutBtn) aboutBtn.textContent = translations.sidebar?.about || 'About';
  if (contactBtn) contactBtn.textContent = translations.sidebar?.contact || 'Contact';
  if (menuBtn) menuBtn.textContent = translations.sidebar?.menu || 'Menu';
  
  // Update About page content
  const aboutPage = document.getElementById('pg-about');
  if (aboutPage && translations.about) {
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
  const footer = document.querySelector('.s-foot');
  if (!footer) return;
  
  // Check if already added
  if (document.getElementById('lang-switcher')) {
    updateLanguageSwitcher();
    return;
  }
  
  // Create switcher div and add to footer
  const switcher = document.createElement('div');
  switcher.id = 'lang-switcher';
  
  switcher.innerHTML = `
    <button class="lang-btn ${currentLang === 'fr' ? 'active' : ''}" onclick="window.switchLanguage('fr')">FR</button>
    <button class="lang-btn ${currentLang === 'en' ? 'active' : ''}" onclick="window.switchLanguage('en')">EN</button>
  `;
  
  footer.appendChild(switcher);
}

function updateLanguageSwitcher() {
  const switcher = document.getElementById('lang-switcher');
  if (!switcher) return;
  
  const btns = switcher.querySelectorAll('.lang-btn');
  if (btns.length >= 2) {
    btns[0].classList.toggle('active', currentLang === 'fr');
    btns[1].classList.toggle('active', currentLang === 'en');
  }
}

// Override openProject to translate content
const origOpenProject = window.openProject;
window.openProject = function(cat, idx) {
  origOpenProject.call(this, cat, idx);
  
  // Apply translations to the project page after it's loaded
  if (translations.projects && translations.projects[cat] && translations.projects[cat].items) {
    const transProject = translations.projects[cat].items[idx];
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
    }
  }
};

// Initialize when page is fully loaded
function initLanguageSystem() {
  // Make sure DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(loadLanguage, 100);
    });
  } else {
    setTimeout(loadLanguage, 100);
  }
}

function loadLanguage() {
  fetch(`/data/${currentLang}.json`)
    .then(r => r.json())
    .then(data => {
      translations = data;
      applyTranslations();
    })
    .catch(err => console.error('Translation error:', err));
}

initLanguageSystem();
