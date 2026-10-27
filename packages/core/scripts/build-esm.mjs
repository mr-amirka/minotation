/**
 * ESM-сборки ядра рядом с CommonJS из `tsc`: `dist/esm/*.mjs` (Node и всё, что не браузер) и
 * `dist/browser/*.mjs` (условие `browser` в `exports`).
 *
 * Зачем ESM. Подключённое через workspace-симлинк, ядро Vite в dev исполняет как
 * исходник, то есть как ES-модуль, — и CommonJS-сборка падает на `exports is
 * not defined` (найдено на `affiliate`, 2026-10-05). Потребителю приходилось
 * обходить это `ssr.external` и `optimizeDeps.include`.
 *
 * Зачем отдельная браузерная сборка (2026-10-26, письмо fundamentool). Сканер грузит синтаксический
 * разбор лениво (`require('./syntaxScan')` внутри функции), но бандл ESM-сборки встраивает этот
 * `require` в общий чанк, и `import ts from "typescript"` оказывается в каждом бандле, дошедшем до
 * `minotation`: 1 081 КБ gzip вместо 57. В браузерной сборке `./syntaxScan` заменён заглушкой, которая
 * при загрузке бросает «только в Node»: сканер ловит это так же, как отсутствие `typescript`, и
 * разбирает файлы текстом. Исходник один, сборок две — разница только в том, куда ведёт этот `require`.
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
import { readdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';

/** Сообщение заглушки — его увидит `syntax: true` в браузерной сборке. */
const NODE_ONLY = 'the syntax scanner runs in Node only; this is the browser build of minotation';

/** В браузерной сборке ленивый `require('./syntaxScan')` ведёт сюда. */
const browserSyntaxStub = {
  name: 'minotation-browser-syntax-stub',
  setup(builder) {
    builder.onResolve({ filter: /^\.\/syntaxScan$/ }, () => ({
      path: 'syntaxScan',
      namespace: 'minotation-node-only',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'minotation-node-only' }, () => ({
      contents: 'throw new Error(' + JSON.stringify(NODE_ONLY) + ');',
      loader: 'js',
    }));
  },
};

/**
 * Одна ESM-сборка.
 *
 * @param outdir — каталог в `dist`
 * @param entryPoints — точки входа
 * @param plugins — плагины esbuild
 */
async function buildEsm(outdir, entryPoints, plugins) {
  rmSync(fileURLToPath(new URL('../' + outdir, import.meta.url)), {
    recursive: true,
    force: true,
  });
  await build({
    absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
    entryPoints,
    outdir,
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
    plugins,
    sourcemap: true,
    logLevel: 'warning',
  });
}

/**
 * Каждый модуль исходников — своя точка входа (D-110): с `splitting` у каждого свой файл, и бандлер потребителя по
 * `"sideEffects": false` выбрасывает неимпортированный модуль целиком, как при сборке из исходников. В общем чанке он
 * резал только по операторам и оставлял таблицы, собранные вызовами (`wordsSet(…)`, циклы): `import
 * { minotationProvider }` тянул таблицы `presetStandard`, `presetHints`, словари синонимов и правила всех normalize.
 * Публичными входами пакета эти файлы не становятся — `exports` их не называет.
 *
 * @param skip — модули, которых в сборке нет (браузерная заменяет `syntaxScan` заглушкой)
 */
function moduleEntries(skip) {
  const src = fileURLToPath(new URL('../src', import.meta.url));
  const entries = {};
  for (const file of readdirSync(src, {
    recursive: true,
  })) {
    if (/\.tsx?$/.test(file) && !/(?:^|\/)__(?:tests|benchmarks)__\/|\.d\.ts$|\.(?:test|spec)\.tsx?$/.test(file)
      && !skip.includes(file)) {
      entries[file.replace(/\.tsx?$/, '')] = 'src/' + file;
    }
  }
  return entries;
}

await buildEsm('dist/esm', moduleEntries([]), []);

// `minotation/syntax` в браузере не нужен: он и есть парсер.
await buildEsm('dist/browser', moduleEntries(['syntaxScan.ts']), [browserSyntaxStub]);
