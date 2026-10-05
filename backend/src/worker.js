import { createRemoteJWKSet, jwtVerify } from 'jose';

const keysets = new Map();
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const bools = row => row && Object.fromEntries(Object.entries(row).map(([k, v]) => [k, ['published', 'approved', 'is_admin'].includes(k) ? !!v : v]));
const now = () => new Date().toISOString();
const slugOK = s => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 120;

export async function authenticate(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL) fail(503, 'Authentification non configurée.');
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)) fail(503, 'Configuration Access invalide.');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) fail(401, 'Veuillez vous reconnecter.');
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let keys = keysets.get(issuer);
  if (!keys) { keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)); keysets.set(issuer, keys); }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'] });
    if (typeof payload.email !== 'string' || payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) fail(403, 'Accès refusé.');
    return { email: payload.email };
  } catch (error) { fail(error.status || 401, 'Accès refusé. Veuillez vous reconnecter.'); }
}

async function body(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'JSON requis.');
  // Bound the actual streamed body as well as Content-Length.
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Contenu requis.');
  let size = 0; const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 900000) { await reader.cancel(); fail(413, 'Contenu trop long.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'JSON invalide.');
    return data;
  } catch { fail(400, 'JSON invalide.'); }
}

function text(value, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, 'Longueur de texte invalide.');
  return value.trim();
}

export function validatePost(input, previous = {}) {
  const post = { ...previous, ...input };
  if (!slugOK(post.slug) || typeof post.published !== 'boolean') fail(400, 'Article invalide.');
  const date = post.published_at;
  if (date != null && (typeof date !== 'string' || !Number.isFinite(Date.parse(date)))) fail(400, 'Date invalide.');
  return {
    slug: post.slug, title: text(post.title, 1, 1000), body: text(post.body, 1, 500000),
    published: Number(post.published), published_at: post.published ? (date || now()) : (date || null)
  };
}

async function publicRoutes(request, env, url) {
  const path = url.pathname;
  if (path === '/api/posts' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT slug,title,body,published_at,created_at FROM posts WHERE published=1 ORDER BY published_at DESC').all();
    return json(results);
  }
  if (path === '/api/comments' && request.method === 'GET') {
    const slug = url.searchParams.get('slug');
    if (!slugOK(slug)) fail(400, 'Slug invalide.');
    const { results } = await env.DB.prepare('SELECT c.id,c.post_slug,c.parent_id,c.author_name,c.body,c.created_at,c.is_admin FROM comments c JOIN posts p ON p.slug=c.post_slug WHERE c.post_slug=? AND c.approved=1 AND p.published=1 ORDER BY c.created_at ASC').bind(slug).all();
    return json(results.map(bools));
  }
  if (path === '/api/comments' && request.method === 'POST') {
    const input = await body(request);
    if (!slugOK(input.post_slug)) fail(400, 'Slug invalide.');
    const name = text(input.author_name, 2, 60), content = text(input.body, 5, 2000);
    if (input.website || input.botcheck || input.honeypot || !Number.isFinite(input.started_at) || Date.now() - input.started_at < 3500 || Date.now() - input.started_at > 86400000) fail(400, 'Veuillez remplir le formulaire manuellement.');
    if (/(https?:\/\/|www\.)/i.test(name) || (content.match(/https?:\/\/|www\./gi) || []).length > 2 || /(.)\1{6,}/i.test(name + ' ' + content)) fail(400, 'Commentaire invalide.');
    const post = await env.DB.prepare('SELECT id FROM posts WHERE slug=? AND published=1').bind(input.post_slug).first();
    if (!post) fail(404, 'Article introuvable.');
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) fail(503, 'Adresse réseau indisponible.');
    // Daily salted hash; no raw visitor IP is stored.
    const day = new Date().toISOString().slice(0, 10);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(day + ':' + ip));
    const key = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
    const timestamp = Date.now();
    const limit = await env.DB.prepare('INSERT INTO comment_limits(key,last_sent) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET last_sent=excluded.last_sent WHERE comment_limits.last_sent <= ? RETURNING key').bind(key, timestamp, timestamp - 60000).first();
    if (!limit) fail(429, 'Veuillez patienter une minute.');
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM comment_limits WHERE last_sent < ?').bind(timestamp - 86400000),
      env.DB.prepare('INSERT INTO comments(id,post_slug,parent_id,author_name,body,approved,is_admin,created_at) VALUES (?,?,NULL,?,?,0,0,?)').bind(id, input.post_slug, name, content, now())
    ]);
    return json({ id, approved: false }, 201);
  }
  fail(404, 'Introuvable.');
}

async function adminRoutes(request, env, url, user) {
  const path = url.pathname, method = request.method;
  if (path === '/api/admin/session' && method === 'GET') return json({ user });
  const match = /^\/api\/admin\/(posts|comments)(?:\/([^/]+))?$/.exec(path);
  if (!match) fail(404, 'Introuvable.');
  const [, table, encodedId] = match;
  const id = encodedId ? decodeURIComponent(encodedId) : null;
  if (method === 'GET' && !id) {
    const query = table === 'posts' ? 'SELECT * FROM posts ORDER BY published ASC,created_at DESC' : (url.searchParams.get('approved') === 'true' ? 'SELECT * FROM comments WHERE approved=1 ORDER BY created_at DESC LIMIT 50' : 'SELECT * FROM comments WHERE approved=0 ORDER BY created_at DESC');
    const { results } = await env.DB.prepare(query).all();
    return json(results.map(bools));
  }
  if (method === 'DELETE' && id) {
    const result = await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
    if (!result.meta.changes) fail(404, 'Introuvable.');
    return json({ ok: true });
  }
  if (!((method === 'POST' && !id) || (method === 'PATCH' && id))) fail(405, 'Méthode non autorisée.');
  const input = await body(request);
  if (table === 'posts') {
    const previous = id ? await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first() : {};
    if (!previous) fail(404, 'Article introuvable.');
    const post = validatePost(input, bools(previous));
    const postId = id || crypto.randomUUID(), date = now();
    if (id) {
      await env.DB.batch([
        env.DB.prepare('UPDATE posts SET slug=?,title=?,body=?,published=?,published_at=?,updated_at=? WHERE id=?').bind(post.slug, post.title, post.body, post.published, post.published_at, date, id),
        env.DB.prepare('UPDATE comments SET post_slug=? WHERE post_slug=?').bind(post.slug, previous.slug)
      ]);
    } else {
      await env.DB.prepare('INSERT INTO posts(id,slug,title,body,published,published_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(postId, post.slug, post.title, post.body, post.published, post.published_at, date, date).run();
    }
    return json(bools(await env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(postId).first()), id ? 200 : 201);
  }
  if (id) {
    if (typeof input.approved !== 'boolean') fail(400, 'Statut invalide.');
    const result = await env.DB.prepare('UPDATE comments SET approved=? WHERE id=?').bind(Number(input.approved), id).run();
    if (!result.meta.changes) fail(404, 'Commentaire introuvable.');
    return json({ ok: true });
  }
  const parent = await env.DB.prepare('SELECT * FROM comments WHERE id=?').bind(input.parent_id || '').first();
  if (!parent) fail(404, 'Commentaire parent introuvable.');
  const replyId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO comments(id,post_slug,parent_id,author_name,body,approved,is_admin,created_at) VALUES (?,?,?,?,?,1,1,?)').bind(replyId, parent.post_slug, parent.id, user.email.split('@')[0], text(input.body, 1, 2000), now()).run();
  return json({ id: replyId }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origin = request.headers.get('Origin');
    const allowed = (env.PUBLIC_ORIGINS || '').split(',').map(s => s.trim());
    const admin = url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/admin') || url.pathname === '/admin.html' || url.pathname === '/';
    let response;
    try {
      if (request.method === 'OPTIONS') {
        if (admin || !allowed.includes(origin)) fail(403, 'Origine refusée.');
        response = new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } });
      } else {
        if (!['GET', 'HEAD'].includes(request.method)) {
          if (admin ? origin !== url.origin : !allowed.includes(origin)) fail(403, 'Origine refusée.');
        }
        const user = admin ? await authenticate(request, env) : null;
        if (url.pathname.startsWith('/api/admin/')) response = await adminRoutes(request, env, url, user);
        else if (url.pathname.startsWith('/api/')) response = await publicRoutes(request, env, url);
        else {
          if (url.pathname === '/') url.pathname = '/admin.html';
          response = await env.ASSETS.fetch(new Request(url, request));
        }
      }
    } catch (error) {
      const duplicate = /UNIQUE constraint failed/.test(error.message);
      response = json({ error: { message: duplicate ? 'Ce slug existe déjà.' : error.status ? error.message : 'Erreur du serveur.', code: duplicate ? '23505' : undefined } }, duplicate ? 409 : error.status || 500);
    }
    response = new Response(response.body, response);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'same-origin');
    if (admin) { response.headers.set('Cache-Control', 'no-store'); response.headers.set('X-Frame-Options', 'DENY'); }
    if (!admin && allowed.includes(origin)) { response.headers.set('Access-Control-Allow-Origin', origin); response.headers.set('Vary', 'Origin'); }
    return response;
  }
};
