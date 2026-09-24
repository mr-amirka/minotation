/**
 * Хук `astro:build:done` на реальной файловой структуре (не мок fs): Astro
 * рендерит каждую страницу отдельно и не трогает `transformIndexHtml`, поэтому
 * именно этот хук отвечает за появление `<link>` на `mn.css` в итоговом HTML —
 * см. module doc в `src/index.ts`.
 */
import { join } from 'path';
import { pathToFileURL } from 'url';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { mnAstro, type MnAstroOptions } from '../src/index';

/** Создаёт временную outDir: ключ — относительный путь файла, значение — содержимое. */
function makeOutDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mn-astro-test-'));
  for (const rel of Object.keys(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, files[rel]);
  }
  return dir;
}

function runBuildDone(outDir: string, options: MnAstroOptions = {}): void {
  const integration = mnAstro(options);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const hook = integration.hooks?.['astro:build:done'] as any;
  hook({ dir: pathToFileURL(outDir + '/') });
}

describe('minotation-astro — astro:build:done', () => {
  test('<link> вставляется во все страницы: перед </head>, </body>, </html> и в конец', () => {
    const outDir = makeOutDir({
      'mn.css': '.p10{padding:10px}',
      'index.html': '<html><head><title>a</title></head><body><div class="p10"></div></body></html>',
      'nested/deep/page.html': '<div class="p10"></div></body>',
      'bare.html': '<div class="p10"></div></html>',
      'fragment.html': '<div class="p10"></div>',
      'not-html.txt': 'просто текст',
    });

    runBuildDone(outDir);

    const link = '<link rel="stylesheet" href="/mn.css">';
    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toContain(`${link}</head>`);
    expect(readFileSync(join(outDir, 'nested/deep/page.html'), 'utf-8')).toContain(`${link}</body>`);
    expect(readFileSync(join(outDir, 'bare.html'), 'utf-8')).toContain(`${link}</html>`);
    expect(readFileSync(join(outDir, 'fragment.html'), 'utf-8')).toBe(`<div class="p10"></div>${link}`);
    expect(readFileSync(join(outDir, 'not-html.txt'), 'utf-8')).toBe('просто текст');
  });

  test('повторный прогон не дублирует <link>', () => {
    const outDir = makeOutDir({
      'mn.css': '.p10{padding:10px}',
      'index.html': '<html><head></head><body></body></html>',
    });

    runBuildDone(outDir);
    const afterFirst = readFileSync(join(outDir, 'index.html'), 'utf-8');
    runBuildDone(outDir);

    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe(afterFirst);
    expect(afterFirst.match(/mn\.css/g)).toHaveLength(1);
  });

  test('без mn.css (нет токенов) HTML не трогается', () => {
    const html = '<html><head></head><body></body></html>';
    const outDir = makeOutDir({ 'index.html': html });

    runBuildDone(outDir);

    expect(readFileSync(join(outDir, 'index.html'), 'utf-8')).toBe(html);
  });

  test('кастомные extensions передаются в mnVite вместо умолчаний', () => {
    const integration = mnAstro({ extensions: ['.astro'] });
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let captured: any;
    (integration.hooks?.['astro:config:setup'] as any)({
      updateConfig: (cfg: any) => { captured = cfg; },
    });

    expect(captured.vite.plugins[0].name).toBe('minotation');
  });
});
