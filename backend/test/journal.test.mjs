import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import worker from '../src/worker.js';
import { convert } from '../../scripts/convert-migration.mjs';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON;');
  sqlite.exec(readFileSync(new URL('../migrations/0001_journal.sql', import.meta.url), 'utf8'));
  const prepare = sql => {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return sqlite.prepare(sql).get(...args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...args).changes } }; }
    };
  };
  return { sqlite, prepare, async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }};
}
const origin = 'https://admin.example.com';
const date = '2026-01-01T00:00:00.000Z';
const post = { id: 'p1', slug: 'hello', title: 'Hello', body: 'A post', published: true, published_at: date, created_at: date, updated_at: date };
const comment = { id: 'c1', post_slug: 'hello', parent_id: null, author_name: 'Reader', body: 'A comment', approved: false, is_admin: false, created_at: date };

test('public API, administrator authentication, moderation, migration and relationships', async t => {
  const DB = database();
  DB.sqlite.exec(convert({ posts: [post, { ...post, id: 'draft', slug: 'draft', published: false }], comments: [comment] }));
  const env = { DB, PUBLIC_ORIGINS: 'https://example.com', ACCESS_TEAM_DOMAIN: 'journal-test.cloudflareaccess.com', ACCESS_AUD: 'test-audience', ADMIN_EMAIL: 'owner@example.com' };
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test', alg: 'RS256', use: 'sig' };
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://journal-test.cloudflareaccess.com/cdn-cgi/access/certs');
    return Response.json({ keys: [jwk] });
  };
  t.after(() => { globalThis.fetch = oldFetch; DB.sqlite.close(); });
  const token = async (email = env.ADMIN_EMAIL, audience = env.ACCESS_AUD, expiry = '5m') => new SignJWT({ email }).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://' + env.ACCESS_TEAM_DOMAIN).setAudience(audience).setSubject('owner').setIssuedAt().setExpirationTime(expiry).sign(privateKey);
  const jwt = await token();
  async function call(path, { method = 'GET', data, auth = false, requestOrigin = 'https://example.com', overrideToken } = {}) {
    const headers = { Origin: requestOrigin, 'CF-Connecting-IP': '192.0.2.1' };
    if (auth) headers['Cf-Access-Jwt-Assertion'] = overrideToken || jwt;
    if (data) headers['Content-Type'] = 'application/json';
    const response = await worker.fetch(new Request(origin + path, { method, headers, body: data ? JSON.stringify(data) : undefined }), env);
    return { status: response.status, headers: response.headers, data: await response.json() };
  }
  await t.test('drafts are private and missing/forged credentials are rejected', async () => {
    assert.deepEqual((await call('/api/posts')).data.map(p => p.slug), ['hello']);
    assert.equal((await call('/api/admin/posts')).status, 401);
    assert.equal((await call('/api/admin/posts', { auth: true, overrideToken: 'forged' })).status, 401);
    assert.equal((await call('/api/admin/posts', { auth: true, overrideToken: await token('stranger@example.com') })).status, 403);
    assert.equal((await call('/api/admin/posts', { auth: true, overrideToken: await token(env.ADMIN_EMAIL, 'wrong') })).status, 401);
    assert.equal((await call('/api/admin/posts', { auth: true, overrideToken: await token(env.ADMIN_EMAIL, env.ACCESS_AUD, '-1m') })).status, 401);
    assert.equal((await call('/api/admin/posts', { auth: true })).data.length, 2);
  });
  await t.test('public submission forces moderation, checks origin and limits repeated writes', async () => {
    const data = { post_slug: 'hello', author_name: 'Visitor', body: 'Nice article!', started_at: Date.now() - 5000, approved: true, is_admin: true, parent_id: 'c1' };
    assert.equal((await call('/api/comments', { method: 'POST', data, requestOrigin: 'https://evil.example' })).status, 403);
    assert.equal((await call('/api/comments', { method: 'POST', data: { ...data, post_slug: 'draft' } })).status, 404);
    assert.equal((await call('/api/comments', { method: 'POST', data: { ...data, website: 'spam' } })).status, 400);
    const result = await call('/api/comments', { method: 'POST', data });
    assert.equal(result.status, 201);
    const row = DB.sqlite.prepare('SELECT * FROM comments WHERE id=?').get(result.data.id);
    assert.equal(row.is_admin, 0); assert.equal(row.approved, 0); assert.equal(row.parent_id, null);
    assert.equal((await call('/api/comments', { method: 'POST', data })).status, 429);
    assert.equal((await call('/api/comments?slug=hello')).data.length, 0);
  });
  const admin = { auth: true, requestOrigin: origin };
  await t.test('admin can approve and reply, including author badge', async () => {
    assert.equal((await call('/api/admin/comments/c1', { ...admin, method: 'PATCH', data: { approved: true }, requestOrigin: 'https://evil.example' })).status, 403);
    assert.equal((await call('/api/admin/comments/c1', { ...admin, method: 'PATCH', data: { approved: true } })).status, 200);
    assert.equal((await call('/api/admin/comments', { ...admin, method: 'POST', data: { parent_id: 'c1', body: 'Thank you', author_name: 'Spoofed' } })).status, 201);
    const comments = (await call('/api/comments?slug=hello')).data;
    assert.equal(comments.length, 2); assert.equal(comments[1].is_admin, true); assert.equal(comments[1].author_name, 'owner');
  });
  await t.test('editing slug preserves comments, unpublishing hides both, duplicates do not damage data', async () => {
    assert.equal((await call('/api/admin/posts/p1', { ...admin, method: 'PATCH', data: { slug: 'renamed' } })).status, 200);
    assert.equal((await call('/api/comments?slug=renamed')).data.length, 2);
    assert.equal((await call('/api/admin/posts/p1', { ...admin, method: 'PATCH', data: { slug: 'draft' } })).status, 409);
    assert.equal((await call('/api/comments?slug=renamed')).data.length, 2);
    assert.equal((await call('/api/admin/posts/p1', { ...admin, method: 'PATCH', data: { published: false } })).status, 200);
    assert.equal((await call('/api/comments?slug=renamed')).data.length, 0);
    assert.equal((await call('/api/posts')).data.length, 0);
    assert.equal((await call('/api/admin/posts/p1', { ...admin, method: 'PATCH', data: { published: true } })).status, 200);
    assert.equal((await call('/api/posts')).data.length, 1);
  });
  await t.test('deleting a comment cascades to replies; deleting a post retains comments', async () => {
    assert.equal((await call('/api/admin/comments/c1', { ...admin, method: 'DELETE' })).status, 200);
    assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM comments WHERE parent_id=?').get('c1').n, 0);
    const count = DB.sqlite.prepare('SELECT count(*) n FROM comments').get().n;
    assert.equal((await call('/api/admin/posts/p1', { ...admin, method: 'DELETE' })).status, 200);
    assert.equal(DB.sqlite.prepare('SELECT count(*) n FROM comments').get().n, count);
  });
});

test('migration preserves Unicode, quotes, drafts and reply IDs; rejects broken graphs', () => {
  const DB = database();
  const reply = { ...comment, id: 'reply', parent_id: 'c1', approved: true, is_admin: true, body: "作者回复：l'article" };
  DB.sqlite.exec(convert({ posts: [{ ...post, published: false }], comments: [reply, comment] }));
  assert.equal(DB.sqlite.prepare('SELECT body FROM comments WHERE id=?').get('reply').body, reply.body);
  assert.equal(DB.sqlite.prepare('SELECT published FROM posts').get().published, 0);
  assert.throws(() => convert({ posts: [], comments: [reply] }), /Missing parent/);
  assert.throws(() => convert({ posts: [], comments: [{ ...comment, parent_id: 'c1' }] }), /Cycle/);
  assert.throws(() => convert({ posts: [post, post], comments: [] }), /duplicate/);
  const longBody = "中文 l'article\n".repeat(12000);
  const longSQL = convert({ posts: [{ ...post, id: 'long', slug: 'long', body: longBody }], comments: [] });
  DB.sqlite.exec(longSQL);
  assert.equal(DB.sqlite.prepare('SELECT body FROM posts WHERE id=?').get('long').body, longBody);
  for (const line of longSQL.split('\n').filter(s => s.startsWith('INSERT') || s.startsWith('UPDATE'))) assert.ok(Buffer.byteLength(line) < 100000);
  DB.sqlite.close();
});
