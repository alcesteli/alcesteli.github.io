// --- Storage ---
// Uses a memory fallback so the site works in private browsing mode
const _memoryStorage = {};

function safeReadStorage(key) {
  try {
    const value = window.localStorage.getItem(key);
    return value !== null ? value : (_memoryStorage[key] ?? null);
  } catch (_) {
    return _memoryStorage[key] ?? null;
  }
}

function safeWriteStorage(key, value) {
  _memoryStorage[key] = String(value);
  try {
    window.localStorage.setItem(key, String(value));
  } catch (_) {}
}

// --- Language ---
function normalizeSiteLanguage(lang) {
  return SUPPORTED_LANGS.has(lang) ? lang : DEFAULT_LANGUAGE;
}

// --- HTML / Text ---
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function sanitizeRichText(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html);

  const allowedTags = new Set(['P', 'BR', 'EM', 'STRONG']);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodesToReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!allowedTags.has(node.tagName)) {
      nodesToReplace.push(node);
      continue;
    }
    [...node.attributes].forEach(attr => node.removeAttribute(attr.name));
  }

  nodesToReplace.forEach(node => {
    const fragment = document.createDocumentFragment();
    while (node.firstChild) fragment.appendChild(node.firstChild);
    node.replaceWith(fragment);
  });

  return template.innerHTML;
}

window.escapeHtml = escapeHtml;
window.sanitizeRichText = sanitizeRichText;

const UI_TEXT = {
  fr: {
    sidebar: { menu: 'Menu', close: 'Fermer' },
    projectMeta: { type: 'Type', client: 'Client', year: 'Année' },
    system: { noImage: 'Aucune image', imageUnavailable: 'Image indisponible' },
    status: {
      missingAccessKey: "Ajoutez votre clé d'accès Web3Forms dans index.html avant d'utiliser le formulaire en direct.",
      spamTriggered: "La protection anti-spam s'est déclenchée.",
      completeBeforeSend: "Merci de prendre un moment pour remplir le formulaire avant l'envoi.",
      waitBeforeResend: 'Veuillez attendre {seconds} secondes avant d\'envoyer un autre message.',
      fillMoreFields: "Merci d'indiquer un nom, un objet et un message plus complets avant l'envoi.",
      manualCompletion: 'Merci de remplir le formulaire manuellement avant l\'envoi.',
      linksNotAllowed: "Les liens ne sont pas autorisés dans le nom ou l'objet.",
      tooManyLinks: 'Merci de réduire le nombre de liens dans votre message.',
      removeRepeatedChars: 'Merci de retirer les caracteres repetes puis de reessayer.',
      sending: 'Envoi du message...',
      messageSent: 'Message envoye avec succes.',
      genericError: "Une erreur s'est produite. Merci de reessayer."
    }
  },
  en: {
    sidebar: { menu: 'Menu', close: 'Close' },
    projectMeta: { type: 'Type', client: 'Client', year: 'Year' },
    system: { noImage: 'No Image', imageUnavailable: 'Image unavailable' },
    status: {
      missingAccessKey: 'Add your Web3Forms access key in index.html before using the live form.',
      spamTriggered: 'Spam protection triggered.',
      completeBeforeSend: 'Please take a moment to complete the form before sending.',
      waitBeforeResend: 'Please wait {seconds} seconds before sending another message.',
      fillMoreFields: 'Please add a fuller name, subject, and message before sending.',
      manualCompletion: 'Please complete the form manually before sending.',
      linksNotAllowed: 'Links are not allowed in the name or subject fields.',
      tooManyLinks: 'Please reduce the number of links in your message.',
      removeRepeatedChars: 'Please remove repeated characters and try again.',
      sending: 'Sending message...',
      messageSent: 'Message sent successfully.',
      genericError: 'Something went wrong. Please try again.'
    }
  }
};

function interpolateUiText(template, replacements = {}) {
  return Object.keys(replacements).reduce((output, key) => {
    const token = `{${key}}`;
    return output.split(token).join(String(replacements[key]));
  }, String(template));
}

function getUiText(path, replacements = {}) {
  const currentLanguage = typeof window.getCurrentLanguage === 'function' ? window.getCurrentLanguage() : 'fr';
  if (typeof window.getTranslationText === 'function') {
    const translatedValue = window.getTranslationText(path, '', replacements);
    if (translatedValue) return translatedValue;
  }

  const fallbackValue = path
    .split('.')
    .reduce((acc, key) => acc && acc[key], UI_TEXT[currentLanguage] || UI_TEXT.fr);

  return typeof fallbackValue === 'string'
    ? interpolateUiText(fallbackValue, replacements)
    : '';
}

window.getUiText = getUiText;
