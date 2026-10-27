import { defineConfig } from 'astro/config';
import { mnAstro } from 'minotation-astro';
import { presetStandard, presetSynonyms, presetMedias } from 'minotation';

export default defineConfig({
  // Пресеты — явно: по умолчанию не подключается ни один (D-110).
  integrations: [mnAstro({ attrs: 'class', presets: [presetStandard, presetSynonyms, presetMedias] })],
  // Обход бага окружения (не относится к minotation-astro): в этом монорепо
  // на верхнем уровне node_modules есть cookie@0.7.x (нужен другому пакету,
  // webpack-dev-server->express), а astro's SSR-бандлинг иногда резолвит его
  // вместо своей корректной вложенной cookie@2.x — падает на "Named export
  // 'parseCookie' not found". noExternal форсирует явную инлайн-сборку.
  vite: {
    ssr: { noExternal: ['cookie'] },
  },
});
