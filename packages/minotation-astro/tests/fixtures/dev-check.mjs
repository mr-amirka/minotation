/**
 * Поднимает настоящий `astro dev` на фикстуре и печатает ответы сервера JSON-ом.
 *
 * Отдельным процессом, а не внутри jest: Vite 8 (rolldown) проверяет типы
 * аргументов в нативном биндинге, и RegExp из VM-контекста jest для него
 * чужой — `dev()` падает ещё до старта сервера. Интеграция берётся прямо из
 * `src` (node ≥ 22.18 исполняет TypeScript без сборки).
 */
import { dev } from 'astro';
import { fileURLToPath } from 'url';
import { mnAstro } from '../../src/index.ts';

const root = fileURLToPath(new URL('./dev-site/', import.meta.url));
const port = Number(process.argv[2]);
const origin = 'http://localhost:' + port;

const server = await dev({
  root,
  logLevel: 'error',
  server: { port },
  integrations: [mnAstro({ attrs: 'class' })],
});
try {
  const page = await fetch(origin + '/');
  const css = await fetch(origin + '/mn.css?t=1');
  const missing = await fetch(origin + '/no-such-page');
  process.stdout.write(JSON.stringify({
    html: await page.text(),
    pageStatus: page.status,
    cssStatus: css.status,
    cssType: css.headers.get('content-type'),
    css: await css.text(),
    missingStatus: missing.status,
  }));
} finally {
  await server.stop();
}
