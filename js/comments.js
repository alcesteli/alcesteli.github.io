// --- Supabase client (lazy init) ---
let _supabaseClient = null;
let _commentsInteractedFields = new Set();
let _commentsCurrentSlug = null;
let _commentsCurrentToken = 0;

function isSupabaseConfigured() {
  return typeof SUPABASE_URL === 'string'
    && typeof SUPABASE_ANON_KEY === 'string'
    && SUPABASE_URL.length > 0
    && SUPABASE_ANON_KEY.length > 0
    && !SUPABASE_URL.startsWith('REPLACE')
    && !SUPABASE_ANON_KEY.startsWith('REPLACE');
}

function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (!isSupabaseConfigured()) return null;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
  _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}

// --- Data ---
async function loadComments(slug) {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from('comments')
    .select('id, post_slug, parent_id, author_name, body, created_at, is_admin')
    .eq('post_slug', slug)
    .eq('approved', true)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Failed to load comments', error);
    return [];
  }
  return data || [];
}

function buildCommentTree(comments) {
  const byId = new Map();
  const roots = [];
  comments.forEach(c => byId.set(c.id, { ...c, replies: [] }));
  byId.forEach(c => {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).replies.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

// --- Rendering ---
function formatCommentDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = (typeof siteLang !== 'undefined' && siteLang === 'fr') ? 'fr-FR' : 'en-US';
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
}

function renderCommentNode(comment) {
  const isAdmin = !!comment.is_admin;
  const badge = isAdmin
    ? `<span class="comment-badge">${escapeHtml(getUiText('comments.authorBadge'))}</span>`
    : '';
  const replies = (comment.replies || []).map(renderCommentNode).join('');
  return `
    <div class="comment${isAdmin ? ' comment-admin' : ''}">
      <div class="comment-head">
        <span class="comment-author">${escapeHtml(comment.author_name || '')}</span>
        ${badge}
        <span class="comment-date">${escapeHtml(formatCommentDate(comment.created_at))}</span>
      </div>
      <div class="comment-body">${sanitizeRichText(comment.body || '')}</div>
      ${replies ? `<div class="comment-replies">${replies}</div>` : ''}
    </div>
  `;
}

function renderCommentsList(comments) {
  const listEl = document.getElementById('comments-list');
  if (!listEl) return;
  if (!comments || comments.length === 0) {
    listEl.innerHTML = `<p class="comments-empty">${escapeHtml(getUiText('comments.empty'))}</p>`;
    return;
  }
  const tree = buildCommentTree(comments);
  listEl.innerHTML = tree.map(renderCommentNode).join('');
}

function renderCommentsSection(container) {
  container.innerHTML = `
    <div class="comments-divider" aria-hidden="true"></div>
    <h3 class="comments-heading">${escapeHtml(getUiText('comments.heading'))}</h3>
    <div class="comments-list" id="comments-list"></div>
    <form class="comments-form" id="comments-form" action="javascript:void(0);" novalidate>
      <p class="comments-form-eyebrow">${escapeHtml(getUiText('comments.leaveOne'))}</p>
      <div class="contact-field">
        <label class="contact-label" for="comments-name">${escapeHtml(getUiText('comments.nameLabel'))}</label>
        <input class="contact-input" id="comments-name" name="name" type="text" maxlength="60" required>
      </div>
      <div class="contact-field">
        <label class="contact-label" for="comments-body">${escapeHtml(getUiText('comments.messageLabel'))}</label>
        <textarea class="contact-textarea" id="comments-body" name="body" maxlength="2000" required></textarea>
      </div>
      <input type="text" name="website" class="contact-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true">
      <input type="checkbox" name="botcheck" class="contact-honeypot" tabindex="-1" autocomplete="off">
      <input type="hidden" name="form_started_at" value="">
      <button class="contact-submit" id="comments-submit" type="button">${escapeHtml(getUiText('comments.submitLabel'))}</button>
      <p class="contact-status" id="comments-status" aria-live="polite"></p>
    </form>
  `;
}

// --- Form / anti-spam ---
function setCommentsStatus(message, type = '') {
  const status = document.getElementById('comments-status');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('is-error', 'is-success');
  if (type) status.classList.add(type);
}

function setupCommentsHoneypotAndTracking(form) {
  const startedAtInput = form.querySelector('input[name="form_started_at"]');
  if (startedAtInput) startedAtInput.value = String(Date.now());

  if (!form.querySelector('[data-dynamic-honeypot="true"]')) {
    const randomSuffix = Math.random().toString(36).slice(2, 10);
    const input = document.createElement('input');
    input.type = 'text';
    input.name = `company_${randomSuffix}`;
    input.tabIndex = -1;
    input.autocomplete = 'off';
    input.setAttribute('aria-hidden', 'true');
    input.className = 'contact-honeypot';
    input.dataset.dynamicHoneypot = 'true';
    form.insertBefore(input, form.querySelector('.contact-submit'));
  }

  _commentsInteractedFields = new Set();
  form.querySelectorAll('input:not([type="hidden"]), textarea').forEach(field => {
    const mark = () => _commentsInteractedFields.add(field.name || field.id || `f-${_commentsInteractedFields.size}`);
    field.addEventListener('input', mark);
    field.addEventListener('focus', mark);
  });
}

function validateCommentInputs({ name, body, website, botcheck, dynamicHoneypotValue, startedAt, interactedCount }) {
  if (website || botcheck || dynamicHoneypotValue) return 'comments.spamTriggered';
  if (!startedAt || Date.now() - startedAt < CONTACT_MIN_FILL_TIME_MS) return 'comments.completeBeforeSend';

  const lastSentAt = Number(safeReadStorage(COMMENTS_LAST_SENT_KEY) || '0');
  const remainingMs = lastSentAt ? Math.max(0, CONTACT_RATE_LIMIT_MS - (Date.now() - lastSentAt)) : 0;
  if (remainingMs > 0) {
    return { key: 'comments.waitBeforeResend', replacements: { seconds: Math.ceil(remainingMs / 1000) } };
  }

  if (name.length < COMMENTS_NAME_MIN_LENGTH || body.length < COMMENTS_BODY_MIN_LENGTH) return 'comments.fillMoreFields';
  if (interactedCount < COMMENTS_MIN_INTERACTIONS) return 'comments.manualCompletion';
  if (/(https?:\/\/|www\.)/i.test(name)) return 'comments.linksNotAllowed';
  const urlCount = (body.match(/https?:\/\/|www\./gi) || []).length;
  if (urlCount > CONTACT_MAX_URLS_IN_MESSAGE) return 'comments.tooManyLinks';
  if (new RegExp(`(.)\\1{${CONTACT_REPEAT_CHAR_LIMIT},}`, 'i').test(`${name} ${body}`)) return 'comments.removeRepeatedChars';
  return null;
}

async function submitComment(form) {
  const client = getSupabaseClient();
  if (!client) return;

  const submitBtn = document.getElementById('comments-submit');
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const name = (formData.get('name') || '').toString().trim().replace(/\s+/g, ' ').slice(0, 60);
  const body = (formData.get('body') || '').toString().trim().slice(0, 2000);
  const website = (formData.get('website') || '').toString().trim();
  const botcheck = (formData.get('botcheck') || '').toString().trim();
  const startedAt = Number(formData.get('form_started_at') || '0');
  const dynamicHoneypot = form.querySelector('[data-dynamic-honeypot="true"]');
  const dynamicHoneypotValue = dynamicHoneypot
    ? (formData.get(dynamicHoneypot.name) || '').toString().trim()
    : '';

  const error = validateCommentInputs({
    name, body, website, botcheck, dynamicHoneypotValue, startedAt,
    interactedCount: _commentsInteractedFields.size
  });
  if (error) {
    const key = typeof error === 'string' ? error : error.key;
    const replacements = typeof error === 'object' ? error.replacements : {};
    setCommentsStatus(getUiText(key, replacements), 'is-error');
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  setCommentsStatus(getUiText('comments.sending'));

  try {
    const { error: insertError } = await client.from('comments').insert({
      post_slug: _commentsCurrentSlug,
      author_name: name,
      body,
      parent_id: null
    });
    if (insertError) throw insertError;
    safeWriteStorage(COMMENTS_LAST_SENT_KEY, String(Date.now()));
    form.reset();
    _commentsInteractedFields.clear();
    const startedAtInput = form.querySelector('input[name="form_started_at"]');
    if (startedAtInput) startedAtInput.value = String(Date.now());
    setCommentsStatus(getUiText('comments.pendingModeration'), 'is-success');
  } catch (err) {
    console.error('Comment submit failed', err);
    setCommentsStatus(getUiText('comments.genericError'), 'is-error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function bindCommentsForm() {
  const form = document.getElementById('comments-form');
  if (!form) return;
  setupCommentsHoneypotAndTracking(form);

  const submitBtn = document.getElementById('comments-submit');
  const handle = async e => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    await submitComment(form);
  };
  form.addEventListener('submit', handle);
  if (submitBtn) submitBtn.addEventListener('click', handle);
}

// --- Public entry point ---
window.initComments = async function(slug) {
  const container = document.getElementById('comments-container');
  if (!container) return;

  if (!isSupabaseConfigured()) {
    container.innerHTML = '';
    return;
  }

  _commentsCurrentSlug = slug;
  const token = ++_commentsCurrentToken;

  renderCommentsSection(container);
  bindCommentsForm();
  renderCommentsList([]); // placeholder while loading

  const comments = await loadComments(slug);
  if (token !== _commentsCurrentToken) return; // user navigated away
  renderCommentsList(comments);
};
