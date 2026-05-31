/**
 * PWA gate checks for phase 5.1 (run against `pnpm preview` or production URL).
 * Usage: PWA_URL=http://127.0.0.1:4173 node scripts/verify-pwa.mjs
 */

const base = (process.env.PWA_URL ?? 'http://127.0.0.1:4173').replace(/\/$/, '');

function fail(message) {
  console.error(`verify-pwa: ${message}`);
  process.exit(1);
}

async function getJson(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) fail(`${path} returned ${res.status}`);
  return res.json();
}

async function getText(path) {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) fail(`${path} returned ${res.status}`);
  return res.text();
}

const manifest = await getJson('/manifest.webmanifest');
if (manifest.name !== 'Mench') fail(`manifest.name is "${manifest.name}", expected Mench`);
if (manifest.display !== 'standalone') fail(`manifest.display is "${manifest.display}"`);
if (!manifest.theme_color) fail('manifest.theme_color missing');
const icons = manifest.icons ?? [];
if (icons.length < 2) fail('manifest needs at least two icons');
if (!icons.some((i) => i.sizes === '192x192')) fail('missing 192x192 icon');
if (!icons.some((i) => i.sizes === '512x512')) fail('missing 512x512 icon');

const sw = await getText('/sw.js');
if (!sw.includes('precache')) fail('sw.js does not look like a Workbox service worker');

const html = await getText('/');
if (!html.includes('viewport-fit=cover')) fail('index.html missing viewport-fit=cover');
if (!html.includes('manifest.webmanifest')) fail('index.html missing manifest link');

const offline = await getText('/offline.html');
if (!offline.includes('offline')) fail('offline.html missing offline copy');

console.log('verify-pwa: OK', base);
console.log('  manifest:', manifest.name, manifest.display, manifest.theme_color);
console.log('  icons:', icons.length);
console.log('  sw.js: precache present');
console.log('  offline.html: served');
