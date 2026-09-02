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
 * `<link rel="stylesheet" href="/mn.css">`.
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
 *   integrations: [mnAstro({ attr: 'class' })],
 * });
 */
export function mnAstro(options: MnAstroOptions = {}): AstroIntegration {
  const extensions = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte', '.astro'];

  return {
    name: 'minotation',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [mnVite({ ...options, extensions })],
          },
        });
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
          if (html.includes(`href="/${MN_CSS_FILE_NAME}"`)) continue; // уже вставлен
          writeFileSync(file, injectStylesheetLink(html, `/${MN_CSS_FILE_NAME}`));
        }
      },
    },
  };
}
