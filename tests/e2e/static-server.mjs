// Local static server that mimics this repo's Firebase Hosting config (firebase.json):
// configured redirects first, then static files with cleanUrls + trailingSlash, then
// rewrites, then /404.html with a real 404 status. Configured headers are applied by glob.
// Usage: node tests/e2e/static-server.mjs [port]   (default 4102)
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const hosting = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8')).hosting;
const port = Number(process.argv[2] || process.env.PORT || 4102);

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf',
};

// Firebase globs: **, *, ?, @(a|b), leading ! negation.
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { out += '.*'; i += 1; if (glob[i + 1] === '/') i += 1; }
    else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else if (c === '@' && glob[i + 1] === '(') {
      const end = glob.indexOf(')', i);
      out += `(?:${glob.slice(i + 2, end).split('|').map(s => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('|')})`;
      i = end;
    } else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}
const matchesSource = (source, pathname) => {
  const negate = source.startsWith('!');
  const glob = negate ? source.slice(1) : source;
  const hit = globToRegExp(glob.startsWith('/') || glob.startsWith('**') ? glob : `/${glob}`).test(pathname);
  return negate ? !hit : hit;
};
const ignored = (hosting.ignore || []).map(globToRegExp);
const isIgnored = rel => ignored.some(re => re.test(rel)) || rel.split('/').some(part => part === 'node_modules' || part === '.git');

function fileFor(rel) {
  if (!rel || isIgnored(rel)) return null;
  const full = resolve(root, rel);
  if (full !== root && !full.startsWith(root + sep)) return null;
  try { return statSync(full).isFile() ? full : null; } catch { return null; }
}

function headersFor(pathname) {
  const headers = {};
  for (const rule of hosting.headers || []) {
    if (matchesSource(rule.source, pathname)) for (const h of rule.headers) headers[h.key] = h.value;
  }
  return headers;
}

function resolveRequest(pathname, search) {
  for (const r of hosting.redirects || []) {
    const hit = r.regex ? new RegExp(r.regex).test(pathname) : matchesSource(r.source, pathname);
    if (hit) return { status: r.type || 301, location: r.destination };
  }
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (hosting.cleanUrls && rel.endsWith('.html') && fileFor(rel)) {
    const clean = `/${rel.replace(/(?:^|\/)index\.html$/, m => (m.startsWith('/') ? '/' : '')).replace(/\.html$/, '')}`;
    return { status: 301, location: `${clean.endsWith('/') ? clean : `${clean}/`}${search}` };
  }
  if (!pathname.endsWith('/')) {
    const exact = fileFor(rel);
    if (exact) return { status: 200, file: exact };
    if (fileFor(`${rel}.html`) || fileFor(`${rel}/index.html`)) return { status: 301, location: `${pathname}/${search}` };
  } else {
    const base = rel.replace(/\/$/, '');
    const file = fileFor(base ? `${base}/index.html` : 'index.html') || (base && fileFor(`${base}.html`));
    if (file) return { status: 200, file };
  }
  for (const rw of hosting.rewrites || []) {
    if (matchesSource(rw.source, pathname) && rw.destination) {
      const file = fileFor(rw.destination.replace(/^\//, ''));
      if (file) return { status: 200, file };
    }
  }
  return { status: 404, file: fileFor('404.html') };
}

export function startServer(listenPort = port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let result;
    try { result = resolveRequest(url.pathname, url.search); } catch { result = { status: 400 }; }
    const headers = headersFor(url.pathname);
    if (result.location) { res.writeHead(result.status, { ...headers, Location: result.location }); res.end(); return; }
    if (!result.file) { res.writeHead(result.status, headers); res.end(); return; }
    const body = readFileSync(result.file);
    res.writeHead(result.status, { ...headers, 'Content-Type': mime[extname(result.file).toLowerCase()] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise(done => server.listen(listenPort, '127.0.0.1', () => done(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer().then(() => console.log(`Serving ${root} like Firebase Hosting on http://127.0.0.1:${port}`));
}
