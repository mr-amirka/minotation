/**
 * ESM-сборка ядра: `dist/esm/*.mjs` рядом с CommonJS из `tsc`.
 *
 * Зачем. Подключённое через workspace-симлинк, ядро Vite в dev исполняет как
 * исходник, то есть как ES-модуль, — и CommonJS-сборка падает на `exports is
 * not defined` (найдено на `affiliate`, 2026-10-05). Потребителю приходилось
 * обходить это `ssr.external` и `optimizeDeps.include`.
 *
 * Почему esbuild с бандлом, а не второй прогон `tsc`. ESM, который грузит сам
 * Node, требует расширений в относительных импортах — `tsc` их не дописывает.
 * А `fundamentool` публикует ESM только для бандлеров (импорты без расширений,
 * без `"type": "module"`), и Node его не загрузит. Поэтому `fundamentool`
 * встраивается в бандл (из исходников — см. `alias` ниже), а общий код точек входа выносится в общие чанки
 * (`splitting`) — чтобы `minotation` и `minotation/mne` делили одну копию.
 *
 * `.mjs` — чтобы файлы читались как ESM независимо от `"type"` пакета.
 */
import { build } from 'esbuild';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';

rmSync(fileURLToPath(new URL('../dist/esm', import.meta.url)), {
  recursive: true,
  force: true,
});

await build({
  absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
  entryPoints: {
    index: 'src/index.ts',
    mne: 'src/mne.ts',
    syntaxScan: 'src/syntaxScan.ts',
  },
  outdir: 'dist/esm',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  splitting: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  // Парсер — необязательная peer-зависимость, его ставит потребитель.
  external: ['typescript'],
  // `fundamentool` берётся из исходников: его опубликованный `dist/esm`
  // собирается отдельно от `build` и отстал от CJS (на 2026-10-05 в нём нет
  // `flatFlags`, `mergeDepth`, `setBase`, `toFixed`), а CJS не вырезается
  // tree-shaking-ом. Исходник — ESM и всегда актуален.
  alias: {
    fundamentool: fileURLToPath(new URL('../node_modules/fundamentool/src/index.ts', import.meta.url)),
  },
  sourcemap: true,
  logLevel: 'warning',
});
