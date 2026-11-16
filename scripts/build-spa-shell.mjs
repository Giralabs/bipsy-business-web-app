// After the build, writes browser/spa.html: the app with nothing rendered in it.
//
// The public pages are rendered to HTML at build time (prerender), and
// index.html is now the rendered home. Every other URL — the panel, the sign-in,
// an invitation link — used to fall back to index.html and would now flash the
// home before Angular draws the right page. vercel.json sends those URLs to
// spa.html instead: same head and scripts, an empty <app-root>, and no
// canonical or structured data of the home (SeoService writes each page's).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BROWSER = join(ROOT, 'dist', 'bipsy-business-web-app', 'browser');

let html = readFileSync(join(BROWSER, 'index.html'), 'utf8');

const before = html.length;
html = html
  // The rendered home inside <app-root>, and the attributes the render added
  .replace(/<app-root[^>]*>[\s\S]*<\/app-root>/, '<app-root></app-root>')
  // Page-specific head: SeoService writes the right ones for each page
  .replace(/<link rel="canonical"[^>]*>/g, '')
  .replace(/<script id="seo-jsonld"[^>]*>[\s\S]*?<\/script>/g, '');

if (!html.includes('<app-root></app-root>')) {
  throw new Error('spa.html: <app-root> not found in index.html');
}

writeFileSync(join(BROWSER, 'spa.html'), html);
console.log(`spa.html: ${Math.round(html.length / 1024)} kB (index.html ${Math.round(before / 1024)} kB)`);
