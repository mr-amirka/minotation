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
 * Почему `typescript` в Node-сборке грузится через модуль-обёртку (2026-10-28). Тот же подъём импорта в
 * ESM-сборке для Node: `dist/esm/index.mjs` тянул `typescript` при каждом `import 'minotation'` (~190 мс), а без
 * установленного `typescript` — необязательной peer-зависимости — падал с `ERR_MODULE_NOT_FOUND`, хотя
 * `require('minotation')` работал. Здесь `import ts from 'typescript'` ведёт в модуль, который сам грузит парсер
 * через `createRequire`; esbuild оборачивает его вместе с `syntaxScan` в ленивую инициализацию, и парсер
 * загружается при первом разборе файла, а его отсутствие сканер ловит, как в CommonJS-сборке.
 *
 * Почему esbuild с бандлом, а не второй прогон `tsc`. ESM, который грузит сам
 * Node, требует расширений в относительных импортах — `tsc` их не дописывает.
 * А `fundamentool` публикует ESM только для бандлеров (импорты без расширений,
 * без `"type": "module"`), и Node его не загрузит. Поэтому `fundamentool`
 * встраивается в бандл (из исходников — см. `alias` ниже), а общий код точек входа выносится в общие чанки
 * (`splitting`) — чтобы `minotation` и `minotation/mne` делили одну копию.
 *
 * `.mjs` — чтобы файлы читались как ESM независимо от `"type"` пакета.
 *
 * `dist/checked` — `minotation/checked` (D-144): те же исходники с `process.env.NODE_ENV`, заменённым на
 * `"development"`, — CommonJS, ESM для Node и ESM для браузера. Замена касается только кода minotation и
 * `fundamentool`: другого в бандле нет. Проверки ядра работают при любом режиме сборки приложения — это нужно
 * просмотрщику, где опции и пресеты пишет человек. Остальные приложения импортируют `minotation` и не везут ни
 * проверок, ни схем (D-141).
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

/** Сообщение, если Node не даёт `process.getBuiltinModule` — сканер покажет его и разберёт файлы текстом. */
const NO_BUILTIN_MODULE = 'loading typescript from the ESM build of minotation needs process.getBuiltinModule'
  + ' (Node 20.16+, 22.3+)';

/**
 * В Node-сборке `import ts from 'typescript'` ведёт в модуль, который грузит парсер сам. Статического импорта
 * нет — ни `typescript`, ни `node:module`: первый поднялся бы в начало общего чанка, второй не нашёлся бы у
 * бандлера, собирающего `dist/esm` под браузер. `createRequire` от адреса чанка ищет `typescript` там же, где
 * его нашёл бы статический импорт.
 */
const nodeLazyTypescript = {
  name: 'minotation-node-lazy-typescript',
  setup(builder) {
    builder.onResolve({ filter: /^typescript$/ }, () => ({
      path: 'typescript',
      namespace: 'minotation-lazy-typescript',
    }));
    builder.onLoad({ filter: /.*/, namespace: 'minotation-lazy-typescript' }, () => ({
      contents: 'const getBuiltinModule = globalThis.process && globalThis.process.getBuiltinModule;\n'
        + 'if (!getBuiltinModule) {\n'
        + '  throw new Error(' + JSON.stringify(NO_BUILTIN_MODULE) + ');\n'
        + '}\n'
        + "export default getBuiltinModule('module').createRequire(import.meta.url)('typescript');\n",
      loader: 'js',
    }));
  },
};

/** Корень пакета — рабочий каталог esbuild. */
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * `fundamentool` берётся из исходников: его опубликованный `dist/esm` собирается отдельно от `build` и отстал от
 * CJS (на 2026-10-05 в нём нет `flatFlags`, `mergeDepth`, `setBase`, `toFixed`), а CJS не вырезается tree-shaking-ом.
 * Исходник — ESM и всегда актуален.
 */
const FUNDAMENTOOL = {
  // Каталог, а не файл: подпуть продолжает его — `fundamentool/css` → `…/src/css` (его `index.ts`), и новый подпуть
  // fundamentool не требует строки здесь.
  fundamentool: fileURLToPath(new URL('../node_modules/fundamentool/src', import.meta.url)),
};

/** `minotation/checked`: проверки в разработке включены навсегда. */
const CHECKED = { 'process.env.NODE_ENV': '"development"' };

/**
 * Удаляет каталог сборки.
 *
 * @param outdir — каталог от корня пакета
 */
function clean(outdir) {
  rmSync(fileURLToPath(new URL('../' + outdir, import.meta.url)), {
    recursive: true,
    force: true,
  });
}

/**
 * Одна ESM-сборка.
 *
 * @param outdir — каталог в `dist`
 * @param entryPoints — точки входа
 * @param plugins — плагины esbuild
 * @param define — замены выражений (`CHECKED` для `dist/checked`)
 */
async function buildEsm(outdir, entryPoints, plugins, define) {
  clean(outdir);
  await build({
    absWorkingDir: ROOT,
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
    alias: FUNDAMENTOOL,
    plugins,
    define,
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

await buildEsm('dist/esm', moduleEntries([]), [nodeLazyTypescript]);

// `minotation/syntax` в браузере не нужен: он и есть парсер.
await buildEsm('dist/browser', moduleEntries(['syntaxScan.ts']), [browserSyntaxStub]);

// `minotation/checked`: `exports` называет только `index`. ESM — по модулю на вход, как выше, чтобы просмотрщик с
// одним пресетом не вёз остальные. CommonJS — для `require` (jest в jsdom), как `dist/index.js` у `minotation`.
clean('dist/checked');
await build({
  absWorkingDir: ROOT,
  entryPoints: { index: 'src/index.ts' },
  outdir: 'dist/checked',
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'es2022',
  external: ['typescript'],
  alias: FUNDAMENTOOL,
  define: CHECKED,
  sourcemap: true,
  logLevel: 'warning',
});
await buildEsm('dist/checked/esm', moduleEntries([]), [nodeLazyTypescript], CHECKED);
await buildEsm('dist/checked/browser', moduleEntries(['syntaxScan.ts']), [browserSyntaxStub], CHECKED);
