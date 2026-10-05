import { mkdir, copyFile, rm } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const out = new URL('backend/public/', root);
await rm(out, { recursive: true, force: true });
await mkdir(new URL('js/', out), { recursive: true });
await copyFile(new URL('admin.html', root), new URL('admin.html', out));
for (const name of ['config', 'utils', 'journal-api', 'admin']) {
  await copyFile(new URL(`js/${name}.js`, root), new URL(`js/${name}.js`, out));
}
// Explicit allowlist: database exports, credentials and source files are never assets.
