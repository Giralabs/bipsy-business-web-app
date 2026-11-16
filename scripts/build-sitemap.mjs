// Writes public/sitemap.xml from the same data the pages render
// (src/app/shared/seo-routes.ts › publicPaths), so a new feature, trade, article or
// legal document is in the sitemap with no one remembering to add it.
//
// Runs before every build (`prebuild` in package.json), so Vercel always
// publishes a current one. esbuild comes with the Angular CLI.
import { build } from 'esbuild';
import { writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'node_modules', '.cache', 'sitemap-entry.mjs');

await build({
  stdin: {
    // The data imports a few Angular classes; Node can only load them with the JIT compiler
    contents: "import '@angular/compiler';\nexport { publicPaths, SITE_URL } from './src/app/shared/seo-routes.ts';",
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: OUT,
  // Angular stays a package import: it only has to load, not run
  packages: 'external',
  logLevel: 'error',
});

const { publicPaths, SITE_URL } = await import(pathToFileURL(OUT).href);
rmSync(OUT, { force: true });

const today = new Date().toISOString().slice(0, 10);
const priority = (path) =>
  path === '/' ? '1.0' : /^\/(precios|funcionalidades|negocios)$/.test(path) ? '0.9' : path.startsWith('/legal/') ? '0.3' : '0.7';

const urls = publicPaths()
  .map(
    (path) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
    <priority>${priority(path)}</priority>
  </url>`,
  )
  .join('\n');

writeFileSync(
  join(ROOT, 'public', 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
);
console.log(`sitemap.xml: ${publicPaths().length} URLs`);

// The same pages are rendered to HTML at build time (angular.json › prerender),
// so search engines and link previews read them without running JavaScript.
writeFileSync(join(ROOT, 'prerender-routes.txt'), publicPaths().join('\n') + '\n');
console.log(`prerender-routes.txt: ${publicPaths().length} routes`);
