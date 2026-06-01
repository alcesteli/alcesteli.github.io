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

// --- Journal post body parser ---
// Plain-text input with three rules:
//   1. Blank line separates paragraphs
//   2. *text* renders as <em>text</em>
//   3. A line containing only an image URL (.jpg/.jpeg/.png/.webp/.gif/.avif) renders as <img>
const POST_IMAGE_URL_RE = /^https?:\/\/[^\s<>"']+?\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s<>"']*)?$/i;

function renderPostBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) return '';
  if (POST_IMAGE_URL_RE.test(trimmed)) {
    return `<img class="article-img" src="${escapeHtml(trimmed)}" alt="" loading="lazy">`;
  }
  const escaped = escapeHtml(trimmed)
    .replace(/\n/g, '<br>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return `<p>${escaped}</p>`;
}

function renderPostBody(text) {
  if (!text) return '';
  return String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(renderPostBlock)
    .filter(Boolean)
    .join('');
}

function extractPostExcerpt(text, maxChars = 180) {
  if (!text) return '';
  const firstTextBlock = String(text)
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map(b => b.trim())
    .find(b => b && !POST_IMAGE_URL_RE.test(b));
  if (!firstTextBlock) return '';
  const flat = firstTextBlock
    .replace(/\n+/g, ' ')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .trim();
  if (flat.length <= maxChars) return flat;
  return flat.slice(0, maxChars).replace(/\s+\S*$/, '') + '…';
}

window.renderPostBody = renderPostBody;
window.extractPostExcerpt = extractPostExcerpt;

const UI_TEXT = {
  fr: {
    sidebar: { menu: 'Menu', close: 'Fermer', journal: 'Journal', back: 'Retour', about: 'À propos' },
    journal: { heading: 'Journal', empty: 'Aucun article publié pour le moment.', loading: 'Chargement…' },
    comments: {
      heading: 'Commentaires',
      empty: 'Aucun commentaire pour le moment. Soyez le premier à en laisser un.',
      leaveOne: 'Laisser un commentaire',
      nameLabel: 'Pseudo',
      messageLabel: 'Commentaire',
      submitLabel: 'Publier',
      pendingModeration: 'Merci. Votre commentaire est en attente de modération.',
      authorBadge: 'Auteur',
      spamTriggered: "La protection anti-spam s'est déclenchée.",
      completeBeforeSend: 'Merci de prendre un moment pour remplir le formulaire avant l\'envoi.',
      waitBeforeResend: 'Veuillez attendre {seconds} secondes avant de poster un autre commentaire.',
      fillMoreFields: 'Merci d\'indiquer un pseudo et un commentaire plus complets.',
      manualCompletion: 'Merci de remplir le formulaire manuellement.',
      linksNotAllowed: 'Les liens ne sont pas autorisés dans le pseudo.',
      tooManyLinks: 'Merci de réduire le nombre de liens dans votre commentaire.',
      removeRepeatedChars: 'Merci de retirer les caractères répétés puis de réessayer.',
      sending: 'Envoi en cours...',
      genericError: "Une erreur s'est produite. Merci de réessayer."
    },
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
    sidebar: { menu: 'Menu', close: 'Close', journal: 'Journal', back: 'Back', about: 'About' },
    journal: { heading: 'Journal', empty: 'No articles published yet.', loading: 'Loading…' },
    comments: {
      heading: 'Comments',
      empty: 'No comments yet. Be the first to leave one.',
      leaveOne: 'Leave a comment',
      nameLabel: 'Name',
      messageLabel: 'Comment',
      submitLabel: 'Publish',
      pendingModeration: 'Thank you. Your comment is pending moderation.',
      authorBadge: 'Author',
      spamTriggered: 'Spam protection triggered.',
      completeBeforeSend: 'Please take a moment to complete the form before sending.',
      waitBeforeResend: 'Please wait {seconds} seconds before posting another comment.',
      fillMoreFields: 'Please add a fuller name and comment.',
      manualCompletion: 'Please complete the form manually.',
      linksNotAllowed: 'Links are not allowed in the name.',
      tooManyLinks: 'Please reduce the number of links in your comment.',
      removeRepeatedChars: 'Please remove repeated characters and try again.',
      sending: 'Sending...',
      genericError: 'Something went wrong. Please try again.'
    },
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
