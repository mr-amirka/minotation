import type { AstroIntegration } from 'astro';
import { mnVite } from 'minotation-vite';
import type { MnViteOptions } from 'minotation-vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

/** Опции интеграции {@link mnAstro}. Совпадают с {@link MnViteOptions} — под капотом это тонкая обёртка над `minotation-vite`. */
export type MnAstroOptions = MnViteOptions;

/** Имя CSS-asset'а, которое `minotation-vite` эмитирует безусловно (см. её `generateBundle`). */
const MN_CSS_FILE_NAME = 'mn.css';

/**
 * Dev: ссылка на `mn.css`, который отдаёт middleware `minotation-vite`.
 *
 * Пока документ разбирается, ссылка вписывается `document.write` — так она
 * становится обычной блокирующей рендер таблицей стилей, и страница не мигает
 * голым текстом. Если скрипт исполнился позже (переход без перезагрузки),
 * `document.write` стёр бы страницу — тогда элемент добавляется в `<head>`.
 *
 * @param href — адрес CSS с учётом `base`
 */
export function devLinkScript(href: string): string {
  const link = '<link rel="stylesheet" href="' + href + '" data-mn>';
  return 'if(!document.querySelector("[data-mn]")){'
    + 'if(document.readyState==="loading"){document.write(' + JSON.stringify(link) + ')}'
    + 'else{var l=document.createElement("link");l.rel="stylesheet";l.href=' + JSON.stringify(href)
    + ';l.setAttribute("data-mn","");document.head.appendChild(l)}}';
}

/**
 * Dev: HMR-слушатель. `minotation-vite` на каждую правку шлёт событие
 * `mn:update` с готовым CSS — его кладём в `<style data-mn>` и убираем
 * `<link>`: новый запрос не нужен, и подмена не мигает.
 */
export const DEV_HMR_SCRIPT = 'if(import.meta.hot){import.meta.hot.on("mn:update",function(css){'
  + 'var s=document.querySelector("style[data-mn]");'
  + 'if(!s){s=document.createElement("style");s.setAttribute("data-mn","")}'
  + 's.textContent=css;document.head.appendChild(s);'
  + 'var l=document.querySelector("link[data-mn]");l&&l.remove()})}';

/** Рекурсивно находит все `.html`-файлы под директорией. */
function findHtmlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Вставляет `<link>` на сгенерированный CSS в HTML-файл — до `</head>`,
 * если `<head>` есть, иначе до `</body>`, иначе просто перед `</html>`.
 */
function injectStylesheetLink(html: string, href: string): string {
  const link = `<link rel="stylesheet" href="${href}">`;
  if (html.includes('</head>')) return html.replace('</head>', `${link}</head>`);
  if (html.includes('</body>')) return html.replace('</body>', `${link}</body>`);
  if (html.includes('</html>')) return html.replace('</html>', `${link}</html>`);
  return html + link;
}

/**
 * Astro-интеграция Minimalist Notation.
 *
 * Astro сам собирается через Vite — интеграция подключает уже готовый
 * {@link mnVite} через `updateConfig({ vite: {...} })` на хуке
 * `astro:config:setup`. `.astro` добавлен в список расширений по умолчанию,
 * чтобы `class="..."` в шаблонной части `.astro`-файлов сканировался так же,
 * как `.html`/`.tsx`.
 *
 * **Не просто тонкая обёртка** — Astro НЕ использует `transformIndexHtml`
 * (единый `index.html`, который обрабатывает `minotation-vite` в обычных
 * Vite SPA-приложениях): Astro рендерит HTML для каждой страницы отдельно
 * через свой собственный пайплайн. Из-за этого `mn.css`, который эмитит
 * `mnVite`, никуда не подключается в итоговый HTML — сам по себе плагин
 * молча производит бесполезный, никем не используемый CSS-файл (найдено
 * эмпирически на реальной сборке, 2026-09-02). Хук `astro:build:done`
 * ниже постобрабатывает все сгенерированные `.html`-файлы и вставляет
 * `<link rel="stylesheet" href="/mn.css">` (с учётом `base` из конфига Astro).
 *
 * В dev сборки нет — `mn.css` отдаёт middleware `minotation-vite`, а
 * интеграция вставляет на каждую страницу ссылку на него и HMR-слушатель
 * (`injectScript`). Стили обновляются без перезагрузки страницы.
 *
 * @param options - опции {@link MnAstroOptions} (те же, что у `minotation-vite`)
 * @returns Astro Integration
 *
 * @example
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config';
 * import { mnAstro } from 'minotation-astro';
 *
 * export default defineConfig({
 *   integrations: [mnAstro({ attrs: 'class' })],
 * });
 */
export function mnAstro(options: MnAstroOptions = {}): AstroIntegration {
  const extensions = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte', '.astro'];

  /** Адрес CSS с учётом `base` — общий для dev и сборки; задаётся в `astro:config:setup`. */
  let href = '/' + MN_CSS_FILE_NAME;

  return {
    name: 'minotation',
    hooks: {
      'astro:config:setup': ({ updateConfig, command, injectScript, config }) => {
        const base = (config && config.base) || '/';
        href = (base.endsWith('/') ? base : base + '/') + MN_CSS_FILE_NAME;
        updateConfig({
          vite: {
            plugins: [mnVite({ ...options, extensions })],
          },
        });
        // В dev `astro:build:done` не наступает, а `transformIndexHtml` Astro не
        // вызывает — без этого CSS на страницу не попадал вовсе (2026-10-05).
        if (command === 'dev') {
          injectScript('head-inline', devLinkScript(href));
          injectScript('page', DEV_HMR_SCRIPT);
        }
      },

      'astro:build:done': ({ dir }) => {
        const outDir = fileURLToPath(dir);
        const cssPath = join(outDir, MN_CSS_FILE_NAME);
        try {
          statSync(cssPath);
        } catch {
          return; // mn.css не сгенерирован (нет токенов) — линковать нечего
        }
        for (const file of findHtmlFiles(outDir)) {
          const html = readFileSync(file, 'utf-8');
          if (html.includes(`href="${href}"`)) continue; // уже вставлен
          writeFileSync(file, injectStylesheetLink(html, href));
        }
      },
    },
  };
}
