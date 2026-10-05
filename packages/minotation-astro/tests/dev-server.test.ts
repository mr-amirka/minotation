/**
 * Dev-путь на настоящем `astro dev` (регрессия 2026-10-05, `affiliate`).
 *
 * В dev CSS minotation на страницу не попадал вовсе: `<link>` вставлялся только
 * в `astro:build:done`, а `<style data-mn>` из `transformIndexHtml` Astro не
 * вызывает. `/mn.css` отвечал 404, и сайт выглядел голым текстом. Хуки по
 * отдельности это не ловят — проверяется ответ живого dev-сервера.
 */
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { mnAstro, devLinkScript, DEV_HMR_SCRIPT } from '../src/index';

const SCRIPT = fileURLToPath(new URL('./fixtures/dev-check.mjs', import.meta.url));

describe('minotation-astro — astro dev', () => {
  // Сервер живёт в отдельном процессе — см. `fixtures/dev-check.mjs`.
  const result = JSON.parse(execFileSync(
    process.execPath, [SCRIPT, '4391'], { encoding: 'utf8', timeout: 90000 },
  )) as { html: string; pageStatus: number; cssStatus: number; cssType: string; css: string; missingStatus: number };

  test('ядро в SSR-коде страницы исполняется — ESM-сборка, без обходов', () => {
    expect(result.pageStatus).toBe(200);
    expect(result.html).toContain('class="w50 h20"');
  });

  test('страница ссылается на /mn.css', () => {
    expect(result.html).toContain('mn.css');
    expect(result.html).toContain('data-mn');
  });

  test('/mn.css отдаётся с токенами страницы', () => {
    expect(result.cssStatus).toBe(200);
    expect(result.cssType).toContain('text/css');
    expect(result.css).toContain('padding:10px');
    expect(result.css).toContain('color:#f00');
  });

  test('чужой адрес middleware пропускает дальше', () => {
    expect(result.missingStatus).toBe(404);
  });
});

describe('minotation-astro — dev-скрипты', () => {
  test('ссылка учитывает base и пишется до разбора документа', () => {
    const script = devLinkScript('/docs/mn.css');
    expect(script).toContain('href=\\"/docs/mn.css\\"');
    expect(script).toContain('document.write');
  });

  test('HMR-слушатель подменяет <link> на <style> с CSS из события', () => {
    expect(DEV_HMR_SCRIPT).toContain('mn:update');
    expect(DEV_HMR_SCRIPT).toContain('style[data-mn]');
    expect(DEV_HMR_SCRIPT).toContain('link[data-mn]');
  });

  test('base без завершающего слэша и не-dev команды', () => {
    const scripts: Array<[string, string]> = [];
    const hook = mnAstro().hooks['astro:config:setup'] as unknown as (p: unknown) => void;
    const params = (command: string, base?: string) => ({
      command,
      config: base === undefined ? undefined : { base },
      updateConfig: () => undefined,
      injectScript: (stage: string, content: string) => scripts.push([stage, content]),
    });
    hook(params('build', '/'));
    expect(scripts).toEqual([]);
    hook(params('dev', '/docs'));
    expect(scripts.map((s) => s[0])).toEqual(['head-inline', 'page']);
    expect(scripts[0][1]).toContain('/docs/mn.css');
    hook(params('dev'));
    expect(scripts[2][1]).toContain('"/mn.css"');
  });
});
