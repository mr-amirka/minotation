/**
 * Dev-путь на настоящем `astro dev`.
 *
 * Регрессия 2026-10-05 (`affiliate`): в dev CSS на страницу не попадал вовсе.
 * С 2026-10-06 (D-031) CSS подключается модулем `virtual:mn.css`, который
 * интеграция вписывает в каждую страницу, и Astro вставляет его сам — с HMR.
 * Хуки по отдельности это не ловят — проверяется ответ живого dev-сервера.
 */
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { mnAstro, PAGE_IMPORT } from '../src/index';

const SCRIPT = fileURLToPath(new URL('./fixtures/dev-check.mjs', import.meta.url));

describe('minotation-astro — astro dev', () => {
  // Сервер живёт в отдельном процессе — см. `fixtures/dev-check.mjs`.
  const result = JSON.parse(execFileSync(
    process.execPath, [SCRIPT, '4391'], { encoding: 'utf8', timeout: 90000 },
  )) as { html: string; pageStatus: number };

  test('ядро в SSR-коде страницы исполняется — ESM-сборка, без обходов', () => {
    expect(result.pageStatus).toBe(200);
    expect(result.html).toContain('class="w50 h20"');
  });

  test('CSS на странице — модулем Vite, с токенами страницы', () => {
    const at = result.html.indexOf('data-vite-dev-id="/__mn/mn.css"');
    expect(at).toBeGreaterThan(-1);
    const css = result.html.slice(at, result.html.indexOf('</style>', at));
    expect(css).toContain('padding:10px');
    expect(css).toContain('color:#f00');
  });
});

describe('minotation-astro — подключение CSS в страницы', () => {
  function setup(options: Parameters<typeof mnAstro>[0]): Array<[string, string]> {
    const scripts: Array<[string, string]> = [];
    const hook = mnAstro(options).hooks['astro:config:setup'] as unknown as (p: unknown) => void;
    hook({
      updateConfig: () => undefined,
      injectScript: (stage: string, content: string) => scripts.push([stage, content]),
    });
    return scripts;
  }

  test('по умолчанию — импорт virtual:mn.css во frontmatter каждой страницы', () => {
    expect(PAGE_IMPORT).toBe("import 'virtual:mn.css';");
    expect(setup({})).toEqual([['page-ssr', PAGE_IMPORT]]);
  });

  test('inject: false — CSS подключают сами (записи entry по layout-ам)', () => {
    expect(setup({ inject: false })).toEqual([]);
  });
});
