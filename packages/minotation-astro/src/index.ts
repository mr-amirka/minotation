import type { AstroIntegration } from 'astro';
import { MN_VIRTUAL, mnVite } from 'minotation-vite';
import type { MnViteOptions } from 'minotation-vite';

/**
 * Опции интеграции {@link mnAstro} — те же, что у `minotation-vite` (эталонный
 * набор `minotation-build`, D-026), с двумя отличиями:
 *
 * - `extensions` по умолчанию дополнены `.astro`;
 * - `inject` — подключать ли CSS в каждую страницу самой интеграцией. По
 *   умолчанию да; `false` — CSS подключают импортом в layout сами (нужно при
 *   записях `entry`, когда у разных страниц свой CSS: `import 'virtual:mn/admin.css'`).
 */
export type MnAstroOptions = Omit<MnViteOptions, 'inject'> & {
  /** `false` — не подключать CSS в страницы автоматически. @default true */
  inject?: boolean;
};

/**
 * Строка, которую интеграция вписывает во frontmatter каждой страницы
 * (`injectScript('page-ssr')`). CSS, импортированный там, Astro собирает как
 * свой: в сборке — файлом с хешем в имени и ссылкой на него, в dev — с HMR.
 */
export const PAGE_IMPORT = `import '${MN_VIRTUAL}';`;

/**
 * Astro-интеграция Minimalist Notation.
 *
 * Подключает {@link mnVite} в конфиг Vite (`.astro` — в расширениях по
 * умолчанию) и вписывает в каждую страницу импорт модуля `virtual:mn.css`.
 * Дальше CSS ведёт сам Astro (D-031): в сборке — файл с хешем содержимого в
 * имени и `<link>` на него, так что после правок браузер не возьмёт старые
 * стили из кеша; в dev — обновление без перезагрузки страницы.
 *
 * До 2026-10-06 интеграция обходила Astro: после сборки дописывала в каждый
 * HTML `<link href="/mn.css">` с постоянным именем (кеш браузера отдавал старые
 * стили), а в dev вставляла ссылку и HMR-слушатель своими скриптами.
 *
 * @param options - опции {@link MnAstroOptions}
 * @returns Astro Integration
 *
 * @example
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config';
 * import { mnAstro } from 'minotation-astro';
 *
 * export default defineConfig({
 *   integrations: [mnAstro({ attrs: 'class, className:class' })],
 * });
 */
export function mnAstro(options: MnAstroOptions = {}): AstroIntegration {
  const extensions = options.extensions || ['.html', '.jsx', '.tsx', '.vue', '.svelte', '.astro'];

  return {
    name: 'minotation',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript }) => {
        updateConfig({
          vite: {
            // `inject` у Vite — про `index.html`, которого у Astro нет.
            plugins: [mnVite({ ...options, extensions, inject: false })],
          },
        });
        options.inject === false || injectScript('page-ssr', PAGE_IMPORT);
      },
    },
  };
}
