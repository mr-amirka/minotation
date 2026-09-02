import { defineConfig } from 'astro/config';
import { mnAstro } from 'minotation-astro';

export default defineConfig({
  integrations: [mnAstro({ attr: 'class' })],
  // Обход бага окружения (не относится к minotation-astro): в этом монорепо
  // на верхнем уровне node_modules есть cookie@0.7.x (нужен другому пакету,
  // webpack-dev-server->express), а astro's SSR-бандлинг иногда резолвит его
  // вместо своей корректной вложенной cookie@2.x — падает на "Named export
  // 'parseCookie' not found". noExternal форсирует явную инлайн-сборку.
  vite: {
    ssr: { noExternal: ['cookie'] },
  },
});
