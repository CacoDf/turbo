// Servidor estático mínimo para public/ (igual que python -m http.server, pero funciona en cualquier PC).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = join(fileURLToPath(import.meta.url), '../../public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = normalize(join(PUBLIC, path === '/' ? 'index.html' : path));
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
  try {
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end('no encontrado');
  }
}).listen(8787, () => console.log('Turbo en http://localhost:8787'));
