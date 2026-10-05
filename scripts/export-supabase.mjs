// Run locally with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
// The public key cannot export drafts or unapproved comments.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || key.startsWith('sb_publishable_')) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally. Never commit credentials.');
if (!key.startsWith('sb_secret_')) {
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  if (role !== 'service_role') throw new Error('A secret/service-role key is required; anonymous or user keys would produce an incomplete backup.');
}
const output = resolve(process.argv[2] || '.migration/supabase.json');
const data = { exported_at: new Date().toISOString(), posts: [], comments: [] };
for (const table of ['posts', 'comments']) {
  let offset = 0;
  for (;;) {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=*&order=id.asc&offset=${offset}&limit=500`, {
      headers: { apikey: key, ...(key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${key}` }), Prefer: 'count=exact' },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`Export of ${table} failed (HTTP ${response.status}); no backup written.`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Unexpected response.');
    data[table].push(...page); offset += page.length;
    const total = Number(response.headers.get('content-range')?.split('/')[1]);
    if (!Number.isFinite(total)) throw new Error('Missing exact count; cannot verify complete export.');
    if (offset === total) break;
    if (page.length === 0 || offset > total) throw new Error('Data changed during export. Freeze writes and retry.');
  }
}
await mkdir(resolve(output, '..'), { recursive: true, mode: 0o700 });
await writeFile(output, JSON.stringify(data, null, 2), { mode: 0o600, flag: 'wx' });
console.log(`Exported ${data.posts.length} posts and ${data.comments.length} comments to ${output}.`);
