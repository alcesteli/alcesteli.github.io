// Language
const LANGUAGE_STORAGE_KEY = 'lang';
const SUPPORTED_LANGS = new Set(['fr', 'en']);
const DEFAULT_LANGUAGE = 'fr';

// Contact form — anti-spam & rate limiting
const WEB3FORMS_ACCESS_KEY = 'cef8118d-e2c7-433a-bdf2-32c9fbee69fd';
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const CONTACT_MIN_FILL_TIME_MS = 3500;
const CONTACT_RATE_LIMIT_MS = 60000;
const CONTACT_LAST_SENT_KEY = 'contact:lastSentAt';
const CONTACT_MIN_INTERACTIONS = 3;
const CONTACT_MAX_URLS_IN_MESSAGE = 2;
const CONTACT_REPEAT_CHAR_LIMIT = 6;

// Contact form — field validation
const VALIDATION = {
  NAME_MIN_LENGTH: 2,
  SUBJECT_MIN_LENGTH: 3,
  MESSAGE_MIN_LENGTH: 20
};

// Supabase (journal comments). Paste your values from Project Settings → API.
const SUPABASE_URL = 'https://gpncrwzvhcgglymttujw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IQbRFty8FSuRaTnw4klPfQ_kd6GO3Br';

// Comments — anti-spam & validation
const COMMENTS_LAST_SENT_KEY = 'comments:lastSentAt';
const COMMENTS_NAME_MIN_LENGTH = 2;
const COMMENTS_BODY_MIN_LENGTH = 5;
const COMMENTS_MIN_INTERACTIONS = 2;
