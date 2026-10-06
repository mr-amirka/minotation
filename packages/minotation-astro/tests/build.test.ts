/**
 * Сборка на настоящем `astro build` (D-031): CSS ведёт сам Astro — маленький
 * встраивает в страницу, большой выдаёт файлом с хешем в имени и ссылается на
 * него. До 2026-10-06 интеграция дописывала в HTML `<link href="/mn.css">` с
 * постоянным именем, и после правок браузер мог взять старые стили из кеша.
 */
import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { mnAstro, type MnAstroOptions } from '../src/index';

const SCRIPT = fileURLToPath(new URL('./fixtures/build-check.mjs', import.meta.url));

/** Сборка фикстуры отдельным процессом — см. `fixtures/build-check.mjs`. */
function build(args: Record<string, unknown>): { html: string; css: Record<string, string> } {
  return JSON.parse(execFileSync(
    process.execPath, [SCRIPT, JSON.stringify(args)], { encoding: 'utf8', timeout: 120000 },
  ));
}

describe('minotation-astro — astro build', () => {
  test('CSS — файл с хешем в имени, ссылку ставит Astro', () => {
    const result = build({ astro: { build: { inlineStylesheets: 'never' } } });
    const names = Object.keys(result.css);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^_astro\/[\w-]+\.[\w-]{8}\.css$/);
    expect(result.css[names[0]]).toContain('padding:10px');
    expect(result.html).toContain('href="/' + names[0] + '"');
    expect(result.html).not.toContain('/mn.css');
  });

  test('маленький CSS Astro встраивает в страницу сам (inlineStylesheets: auto)', () => {
    const result = build({});
    expect(Object.keys(result.css)).toEqual([]);
    expect(result.html).toContain('padding:10px');
  });
});

/**
 * Сканирование `.astro`. Интеграция — обёртка над `minotation-vite`, поэтому
 * проверяется то, что доходит до самого vite-плагина: собранный им набор
 * токенов из настоящего `.astro`-файла.
 *
 * Целиком парсером такой файл не разобрать (у Astro свой компилятор), но он
 * делится на фронтматтер — обычный TS — и разметку. Скрипт идёт через парсер,
 * разметка текстом.
 */
describe('minotation-astro — сканирование .astro', () => {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  /** Вытаскивает vite-плагин из интеграции и прогоняет через него исходник. */
  function tokensOf(source: string, options: MnAstroOptions = {}): string[] {
    const integration = mnAstro(options);
    let captured: any;
    (integration.hooks?.['astro:config:setup'] as any)({
      updateConfig: (cfg: any) => { captured = cfg; },
      injectScript: () => undefined,
    });
    const plugin = captured.vite.plugins[0];
    // Плагин ждёт `configResolved` — без него не знает ни корня, ни режима.
    plugin.configResolved({ root: mkdtempSync(join(tmpdir(), 'mn-astro-scan-')), command: 'build' });
    plugin.transform(source, join('src', 'pages', 'index.astro'));
    // Токены попадают в CSS модуля `virtual:mn.css` — по нему и судим.
    return [plugin.load.call({ warn: () => undefined }, plugin.resolveId('virtual:mn.css')).code];
  }

  test('фронтматтер разбирается парсером, разметка — текстом', () => {
    const css = tokensOf([
      '---',
      'const re = /"/;',
      '// пример: class="p99"',
      'const cardClass = "m20";',
      '---',
      '<div class="p10"></div>',
    ].join('\n')).join('');

    expect(css).toContain('padding:10px');
    expect(css).toContain('margin:20px');
    // Комментарий во фронтматтере токенов не даёт, хотя текстовый сканер
    // спотыкается здесь о кавычку внутри регулярного литерала.
    expect(css).not.toContain('padding:99px');
  });

  test('`syntax: false` возвращает текстовый разбор', () => {
    const css = tokensOf([
      '---',
      'const re = /"/;',
      '// пример: class="p99"',
      '---',
      '<div class="p10"></div>',
    ].join('\n'), { syntax: false }).join('');

    expect(css).toContain('padding:10px');
    expect(css).toContain('padding:99px');
  });
});
