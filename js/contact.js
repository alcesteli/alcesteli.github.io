function setFormStartedAt(contactForm) {
  const startedAtInput = contactForm.querySelector('input[name="form_started_at"]');
  if (startedAtInput) startedAtInput.value = String(Date.now());
}

function normalizeContactField(value, maxLength) {
  return value.toString().trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function getRemainingCooldownMs() {
  const lastSentAt = Number(safeReadStorage(CONTACT_LAST_SENT_KEY) || '0');
  if (!lastSentAt) return 0;
  return Math.max(0, CONTACT_RATE_LIMIT_MS - (Date.now() - lastSentAt));
}

function countUrls(value) {
  const matches = value.match(/https?:\/\/|www\./gi);
  return matches ? matches.length : 0;
}

function hasSuspiciousRepetition(value) {
  return new RegExp(`(.)\\1{${CONTACT_REPEAT_CHAR_LIMIT},}`, 'i').test(value);
}

function ensureDynamicHoneypot(contactForm) {
  if (contactForm.querySelector('[data-dynamic-honeypot="true"]')) return;

  const randomSuffix = Math.random().toString(36).slice(2, 10);
  const input = document.createElement('input');
  input.type = 'text';
  input.name = `company_${randomSuffix}`;
  input.tabIndex = -1;
  input.autocomplete = 'off';
  input.setAttribute('aria-hidden', 'true');
  input.className = 'contact-honeypot';
  input.dataset.dynamicHoneypot = 'true';
  contactForm.insertBefore(input, contactForm.querySelector('.contact-submit'));
}

function resetContactFormState(contactForm, interactedFields) {
  contactForm.reset();
  interactedFields.clear();
  setFormStartedAt(contactForm);
}

function setContactStatus(message, type = '') {
  const status = document.getElementById('contact-status');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('is-error', 'is-success');
  if (type) status.classList.add(type);
}

// Returns an error key (string) or null if valid.
function validateFormInputs({ name, message, website, botcheck, dynamicHoneypotValue, startedAt, interactedCount }) {
  if (WEB3FORMS_ACCESS_KEY === 'REPLACE_WITH_YOUR_WEB3FORMS_ACCESS_KEY') return 'status.missingAccessKey';
  if (website || botcheck || dynamicHoneypotValue)                         return 'status.spamTriggered';
  if (!startedAt || Date.now() - startedAt < CONTACT_MIN_FILL_TIME_MS)    return 'status.completeBeforeSend';

  const remainingMs = getRemainingCooldownMs();
  if (remainingMs > 0) return { key: 'status.waitBeforeResend', replacements: { seconds: Math.ceil(remainingMs / 1000) } };

  if (name.length < VALIDATION.NAME_MIN_LENGTH || message.length < VALIDATION.MESSAGE_MIN_LENGTH) return 'status.fillMoreFields';
  if (interactedCount < CONTACT_MIN_INTERACTIONS)                          return 'status.manualCompletion';
  if (/(https?:\/\/|www\.)/i.test(name))                                   return 'status.linksNotAllowed';
  if (countUrls(message) > CONTACT_MAX_URLS_IN_MESSAGE)                   return 'status.tooManyLinks';
  if (hasSuspiciousRepetition(`${name} ${message}`))                       return 'status.removeRepeatedChars';
  return null;
}

async function sendContactForm({ name, email, message, botcheck }) {
  const response = await fetch(WEB3FORMS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ access_key: WEB3FORMS_ACCESS_KEY, name, email, message, botcheck })
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.message || 'Unable to send message.');
}

function setupFormTracking(contactForm, interactedFields) {
  setFormStartedAt(contactForm);
  ensureDynamicHoneypot(contactForm);
  contactForm.querySelectorAll('input:not([type="hidden"]), textarea').forEach(field => {
    const mark = () => interactedFields.add(field.name || field.id || `field-${interactedFields.size}`);
    field.addEventListener('input', mark);
    field.addEventListener('focus', mark);
  });
}

function initContactForm() {
  const contactForm = document.getElementById('contact-form');
  if (!contactForm || contactForm.dataset.bound === 'true') return;

  contactForm.dataset.bound = 'true';
  const submitBtn = contactForm.querySelector('.contact-submit');
  const interactedFields = new Set();

  setupFormTracking(contactForm, interactedFields);

  const handleSubmit = async e => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!contactForm.reportValidity()) return;

    const formData = new FormData(contactForm);
    const name    = normalizeContactField(formData.get('name')    || '', 80);
    const email   = normalizeContactField(formData.get('email')   || '', 254);
    const message = (formData.get('message') || '').toString().trim().slice(0, 3000);
    const website = normalizeContactField(formData.get('website') || '', 200);
    const botcheck = (formData.get('botcheck') || '').toString().trim();
    const startedAt = Number(formData.get('form_started_at') || '0');
    const dynamicHoneypot = contactForm.querySelector('[data-dynamic-honeypot="true"]');
    const dynamicHoneypotValue = dynamicHoneypot ? normalizeContactField(formData.get(dynamicHoneypot.name) || '', 200) : '';

    const error = validateFormInputs({ name, message, website, botcheck, dynamicHoneypotValue, startedAt, interactedCount: interactedFields.size });
    if (error) {
      const isSpam = (typeof error === 'string' ? error : error.key) === 'status.spamTriggered';
      const key = typeof error === 'string' ? error : error.key;
      const replacements = typeof error === 'object' ? error.replacements : {};
      setContactStatus(getUiText(key, replacements), 'is-error');
      if (isSpam) resetContactFormState(contactForm, interactedFields);
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setContactStatus(getUiText('status.sending'));

    try {
      await sendContactForm({ name, email, message, botcheck });
      resetContactFormState(contactForm, interactedFields);
      safeWriteStorage(CONTACT_LAST_SENT_KEY, String(Date.now()));
      setContactStatus(getUiText('status.messageSent'), 'is-success');
    } catch (err) {
      setContactStatus(err.message || getUiText('status.genericError'), 'is-error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  contactForm.addEventListener('submit', handleSubmit);
  if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
}
