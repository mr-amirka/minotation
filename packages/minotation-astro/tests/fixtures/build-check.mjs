/**
 * Настоящий `astro build` фикстуры; печатает HTML страницы и CSS-файлы сборки JSON-ом.
 *
 * Отдельным процессом — по той же причине, что `dev-check.mjs`: Vite 8 не
 * запускается в VM-контексте jest. Интеграция — прямо из `src`.
 */
import { build } from 'astro';
import { mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { mnAstro } from '../../src/index.ts';

const root = fileURLToPath(new URL('./dev-site/', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'mn-astro-build-'));
// argv: JSON `{ mn: опции интеграции, astro: опции конфига Astro }`.
const args = JSON.parse(process.argv[2] || '{}');

await build({
  root,
  outDir,
  logLevel: 'error',
  ...args.astro,
  integrations: [mnAstro({ attrs: 'class', ...args.mn })],
});

const css = {};
for (const dir of ['_astro', '.']) {
  let names = [];
  try {
    names = readdirSync(join(outDir, dir));
  } catch {
    continue;
  }
  for (const name of names) {
    name.endsWith('.css') && (css[dir + '/' + name] = readFileSync(join(outDir, dir, name), 'utf8'));
  }
}
process.stdout.write(JSON.stringify({
  html: readFileSync(join(outDir, 'index.html'), 'utf8'),
  css,
}));
