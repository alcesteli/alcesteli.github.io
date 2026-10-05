// Public requests go to the Worker; the admin UI and protected API share its origin.
const JournalAPI = {
  async request(path, { method = 'GET', data, admin = false } = {}) {
    try {
      const base = admin ? window.location.origin : JOURNAL_API_URL.replace(/\/$/, '');
      if (!base) throw new Error('Service indisponible.');
      const response = await fetch(`${base}/api/${admin ? 'admin/' : ''}${path}`, {
        method, credentials: admin ? 'same-origin' : 'omit',
        headers: data ? { 'Content-Type': 'application/json' } : {},
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(20000)
      });
      if (!response.headers.get('Content-Type')?.includes('application/json')) {
        throw new Error('Session expirée. Rechargez la page pour vous reconnecter.');
      }
      const result = await response.json();
      if (!response.ok) return { data: null, error: result.error || { message: 'Service indisponible.' } };
      return { data: result, error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  }
};
