// @ts-check
/**
 * A tiny static file server for the end-to-end suite (no dependency): serves
 * a built site directory the way a static host does. `/a/` serves
 * `a/index.html`, `/a` redirects to `/a/` when that is a directory, and
 * anything missing gets the site's `404.html` with status 404.
 *
 *   node serve.mjs <dir> [port]     (port also from $PORT; default 4399)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? process.env.PORT ?? 4399);

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};

/**
 * The file for a URL path inside `root`, or undefined; `redirect` when a directory is asked for without its slash.
 * @param {string} urlPath
 * @returns {{ file?: string, redirect?: string } | undefined}
 */
function resolve(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return undefined;
  }
  const file = path.join(root, path.normalize(decoded));
  if (file !== root && !file.startsWith(root + path.sep)) return undefined;
  const stat = fs.statSync(file, { throwIfNoEntry: false });
  if (stat?.isFile()) return { file };
  if (stat?.isDirectory()) {
    if (!decoded.endsWith('/')) return { redirect: `${urlPath}/` };
    const index = path.join(file, 'index.html');
    return fs.existsSync(index) ? { file: index } : undefined;
  }
  return undefined;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const found = req.method === 'GET' || req.method === 'HEAD' ? resolve(url.pathname) : undefined;
  if (found?.redirect) {
    res.writeHead(301, { location: found.redirect + url.search });
    res.end();
    return;
  }
  const file = found?.file ?? path.join(root, '404.html');
  const status = found?.file ? 200 : 404;
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(status, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
