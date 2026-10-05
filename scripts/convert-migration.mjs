import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function convert(data) {
  if (!Array.isArray(data.posts) || !Array.isArray(data.comments)) throw new Error('Expected complete posts and comments arrays.');
  const quote = v => v == null ? 'NULL' : typeof v === 'boolean' ? (v ? '1' : '0') : "'" + String(v).replaceAll("'", "''") + "'";
  const insert = (table, keys, row) => {
    const statement = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k => quote(row[k])).join(',')});`;
    if (Buffer.byteLength(statement) <= 90000) return statement;
    // D1 SQL statements are limited to 100 KB; long article bodies need chunks.
    const initial = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(k => quote(k === 'body' ? '' : row[k])).join(',')});`;
    if (Buffer.byteLength(initial) > 90000) throw new Error('Metadata exceeds D1 statement size.');
    const statements = [initial];
    let chunk = '', size = 0;
    const flush = () => { statements.push(`UPDATE ${table} SET body=body || ${quote(chunk)} WHERE id=${quote(row.id)};`); chunk = ''; size = 0; };
    for (const char of row.body) {
      const bytes = Buffer.byteLength(char) + (char === "'" ? 1 : 0);
      if (size + bytes > 60000) flush();
      chunk += char; size += bytes;
    }
    if (chunk) flush();
    return statements.join('\n');
  };
  const sql = ['-- Import into an EMPTY database after applying migrations. No REPLACE or deletion.'];
  const ids = new Set(), slugs = new Set();
  for (const post of data.posts) {
    if (!post.id || !post.slug || !post.title || !post.body || !post.created_at || typeof post.published !== 'boolean' || ids.has(String(post.id)) || slugs.has(post.slug)) throw new Error('Invalid or duplicate post.');
    ids.add(String(post.id)); slugs.add(post.slug);
    sql.push(insert('posts', ['id','slug','title','body','published','published_at','created_at','updated_at'], { ...post, updated_at: post.updated_at || post.created_at }));
  }
  const byId = new Map();
  for (const comment of data.comments) {
    if (!comment.id || !comment.post_slug || !comment.author_name || typeof comment.body !== 'string' || !comment.created_at || typeof comment.approved !== 'boolean' || typeof comment.is_admin !== 'boolean' || byId.has(String(comment.id))) throw new Error('Invalid or duplicate comment.');
    byId.set(String(comment.id), comment);
  }
  const done = new Set(), active = new Set();
  function visit(comment) {
    const id = String(comment.id);
    if (done.has(id)) return;
    if (active.has(id)) throw new Error('Cycle in comment replies.');
    active.add(id);
    if (comment.parent_id != null) {
      const parent = byId.get(String(comment.parent_id));
      if (!parent || parent.post_slug !== comment.post_slug) throw new Error('Missing parent or cross-article reply.');
      visit(parent);
    }
    sql.push(insert('comments', ['id','post_slug','parent_id','author_name','body','approved','is_admin','created_at'], comment));
    active.delete(id); done.add(id);
  }
  for (const comment of data.comments) visit(comment);
  return sql.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2] || '.migration/supabase.json';
  const output = process.argv[3] || '.migration/import.sql';
  const data = JSON.parse(await readFile(input, 'utf8'));
  await writeFile(output, convert(data), { mode: 0o600, flag: 'wx' });
  console.log(`Validated ${data.posts.length} posts and ${data.comments.length} comments. Wrote ${output}.`);
}
