# minotation-build

Общий каркас плагинов сборщиков для [minotation](../core): накопитель токенов и
обход файлов.

```bash
pnpm add -D minotation minotation-build
```

Пакет нужен тем, кто пишет интеграцию со сборщиком. Обычному потребителю
нотации он не требуется — достаточно готового плагина или
[`minotation-cli`](../minotation-cli).

## Зачем

Сканер был общим с 2026-09-25 (`createScanner` в ядре), но всё остальное
продолжало дублироваться в четырёх плагинах: учёт токенов по файлам, снятие
файла с учёта, создание mn-инстанса, применение пресетов, генерация CSS, кеш и
проброс предупреждений. Три реализации `walkFiles` совпадали побайтово.

Цена такого дублирования известна по опыту проекта: механизм, доработанный в
одном плагине, в остальных молча отсутствует (`classVarSuffixes` жил только в
vite), а баг, исправленный в одном, остаётся в трёх.

## Быстрый старт

```ts
import { createTokenCollector, walkFiles } from 'minotation-build';
import { presetStandard, presetSynonyms } from 'minotation';

const collector = createTokenCollector({
  attrs: 'class, className:class',
  presets: [presetStandard, presetSynonyms],
});

// на старте сборки
for (const file of walkFiles(root, ['.html', '.tsx'])) {
  collector.add(file, readFileSync(file, 'utf-8'));
}

// на каждый обработанный модуль
collector.add(id, source);

// когда пора отдавать CSS
const css = collector.css();
for (const warning of collector.takeWarnings()) {
  ctx.warn('[minotation] ' + warning.token + ': ' + warning.message);
}
```

## Эталонный набор опций (D-026)

Один набор на все плагины сборщиков и CLI — `MnBuildOptions`. Плагин принимает его
целиком и добавляет только то, что есть лишь у его сборщика (`fileName`, `output`).
Сверка с v1 и список того, что ещё восстанавливается, —
`AGENT_DRAFT/RESEARCH/09_plugin-options-parity-2026-10-05.md` в контексте проекта.

| Опция | Тип | По умолчанию | Что делает |
|---|---|---|---|
| `attrs` | `string \| string[] \| Record<string, string>` | `'class'` | какие атрибуты сканировать и во что разворачивать — раздел ниже |
| `root` | `string` | у плагина своё: vite — `<root>/src`, rollup/esbuild — рабочая директория | корень первичного скана (в v1 — `path`) |
| `extensions` | `string[]` | `.html .jsx .tsx .vue .svelte` (+ `.astro` у astro) | какие файлы сканировать, если не задан `include` |
| `include` | `MnFileMatcher` | — | какие файлы сканировать вместо `extensions`: RegExp, путь, функция или массив |
| `exclude` | `MnFileMatcher` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `boolean` | `false` | пропускать файлы-партиалы `_*` (D-027) |
| `presets` | `MnPreset[]` | стандартный набор | статические пресеты; стандартный набор начинается с `presetHints` (D-024) |
| `presetExtensions` | `string[]` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты (`import './app.mn'`) |
| `safelist` | `string[]` | `[]` | токены, нужные всегда; группы через пробел: `['crP taL vaT']` |
| `classVarSuffixes` | `string[]` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `string[]` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | `boolean` | автоматически | разбирать JS/TS парсером (`false` — только текст) |
| `selectorPrefix` | `string` | — | префикс всех селекторов: `'.app '` → `.app .p10{…}` |
| `altColor` | `boolean` | `false` | запасное непрозрачное объявление рядом с `rgba` |
| `media` | `Record<string, MnMediaEntry>` | стандартные | именованные медиа: `{ wide: { query: '(min-width: 1200px)' } }` → `p10@wide` |
| `maxDepth`, `maxDepthMode` | `number`, `'warn' \| 'silent' \| 'strict'` | —, `'warn'` | предел глубины контекстных селекторов и режим при превышении (D-039) |
| `specificityMode` | `'warn' \| 'silent' \| 'strict'` | `'warn'` | токены с накруткой специфичности `f10*2` (D-039) |
| `importantMode` | `'warn' \| 'silent' \| 'strict'` | `'warn'` | токены с `!important` (`f10-i`) (D-039) |
| `childSelectorMode` | `'warn' \| 'silent' \| 'strict'` | `'warn'` | токены с дочерним селектором `>` (`cF00>1`) (D-041) |
| `warningMode` | `'log' \| 'silent' \| 'error'` | `'log'` | что делать с предупреждением компиляции: в лог сборки, молчать, уронить сборку (D-035); `maxDepthMode`, `specificityMode`, `importantMode`, `childSelectorMode` не затрагивает (D-039, D-041) |
| `onWarning` | `(warning) => void` | — | колбэк на каждое предупреждение — дополнительно к `warningMode` |
| `onError` | `(e) => void` | — | обработчик ошибок ядра |
| `onScannerWarning` | `(message) => void` | `console.warn` | колбэк сканера: `syntax: true`, а `typescript` нет |
| `metrics` | `boolean \| string` | `true` | статистика употребления токенов (`mn-metrics.json`): общий список и по файлам (пути — от корня проекта); в dev не пишется (D-032) |
| `entry` | `Record<string, MnEntryOptions>` | — | несколько CSS из одной сборки (D-030): записи переопределяют `include`, `exclude`, `skipPartials`, `attrs`, `presets`, `safelist`, поля ядра, `fileName` |
| `fileName` | `string` | у плагина своё | имя файла с `[name]` (имя записи) и `[hash]` (хеш содержимого) — там, где файл пишет плагин |
| `manifest` | `boolean \| string` | `true` | `mn-manifest.json` рядом с CSS: `{ "mn.css": "mn.3f9a1c2e.css" }` |

`MnFileMatcher` — как в v1: `/\.tpl$/`, `'./src/page.html'` (путь от корня или
абсолютный), `(path) => boolean` или массив из них; массив срабатывает, если
сработал хоть один элемент.

Где отбор файлов делает сам сборщик (`test` правила webpack, `gulp.src`),
`extensions` по умолчанию ничего не ограничивает, а `include`/`exclude`/
`skipPartials` отсекают файлы внутри уже выбранных.

### Проверка опций (D-038)

Плагин проверяет опции при создании. Неизвестный ключ и значение не того типа —
ошибка сразу, а не молча проигнорированная настройка:

```ts
mnVite({ atrs: 'class' });
// Error: [minotation] mnVite: unknown option "atrs". Did you mean "attrs"?

mnVite({ mn: { strict: true } });
// Error: [minotation] mnVite: unknown option "mn". Known options: selectorPrefix, altColor, …

mnVite({ warningMode: 'strict' });
// Error: [minotation] mnVite: option "warningMode" expects "log", "silent" or "error", got string "strict"

mnGulp({ entry: { admin: { incude: /admin/ } } });
// Error: [minotation] mnGulp: unknown option "entry.admin.incude". Did you mean "entry.admin.include"?
```

`undefined` в значении — то же, что отсутствие ключа: опции можно собирать
условно. Свой плагин поверх общего набора проверяет опции так же —
`checkBuildOptions(options, 'myPlugin', { ownOption: isBoolean })`.

## Как CSS попадает на страницу и защита от кеша (D-031)

Свой хеш плагины не изобретают: CSS отдаётся **в граф ассетов сборщика**, и тот
даёт файлу имя с хешем, ставит ссылку, минифицирует и обновляет в dev — как любой
CSS проекта. После правок имя меняется, и браузер не возьмёт старые стили из кеша.

| Плагин | Как подключается | Имя с хешем |
|---|---|---|
| vite (SPA) | `inject: 'inline'` — в `index.html`; `'link'` — ссылкой; `false` — `import 'virtual:mn.css'` | у `'link'` и импорта — Vite |
| astro | интеграция подключает `virtual:mn.css` в каждую страницу сама | Astro (`/_astro/*.css`) |
| rollup | ассет через `emitFile` | rollup по `assetFileNames` |
| esbuild | `import 'virtual:mn.css'`; без импорта — файл по `fileName` | esbuild по `entryNames` |
| webpack | `import 'minotation-webpack/mn.css'`; без импорта — ассет | конвейер проекта; ассет — если хеш в `output.filename` |
| next | `import 'minotation-next/mn.css'` в корневом layout | Next.js (`/_next/static/css/*.css`) |
| gulp, CLI | файл по `fileName` / `--output` | `[hash]` в шаблоне |

Запись `entry` подключается своим модулем: `virtual:mn/<имя>.css` (vite, astro,
esbuild), `mn.css?entry=<имя>` (webpack, next).

## `attrs` — какие атрибуты сканировать и во что разворачивать

Опция общая для всех плагинов и CLI; возвращена из v1 (D-025). Ключ — атрибут
в разметке, значение — атрибут, в который компилируется селектор. `class`
даёт `.token`, любой другой — `[имя~="token"]`. Имя без `:` разворачивается в себя.

Три равноценные формы:

```ts
attrs: 'class, className:class'                  // строка: разделители — пробел, |, ",", ;
attrs: ['class', 'className:class']               // массив
attrs: { class: 'class', className: 'class' }     // объект
```

По умолчанию — `'class'`. Типичные наборы:

| Проект | `attrs` | Что получится |
|---|---|---|
| HTML, Astro, Vue, Svelte | `'class'` | `class="p10"` → `.p10` |
| React (`className`) рядом с `.astro`/`.html` | `'class, className:class'` | оба → `.p10` |
| свой атрибут для нотации | `'class, m, m-n'` | `m="p10"` → `[m~="p10"]`, `m-n="p10"` → `[m-n~="p10"]` |

Частая ошибка — перечислить имена без цели: `['class', 'className']` даёт
`.ws` **и** `[className~="ws"]`, то есть `className` компилируется в свой
атрибут, а не в класс. Для React нужно `className:class`.

Токены из переменных `*Class` (`classVarSuffixes`) и вызовов `mne`/`mnClass`
(`mergeFnNames`) — это значения классов: они идут в цель `class`, а если её
нет в `attrs` — в первую цель.

Пустой `attrs` (`''`, `[]`) — ошибка: иначе сборка молча не нашла бы ни одного токена.

## `createTokenCollector(options)`

Опции — `attrs` (выше), опции сканера (`classVarSuffixes`, `mergeFnNames`,
`syntax`), плюс:

| Опция | Что делает |
|-------|------------|
| `safelist` | токены, нужные всегда, даже если в файлах не встретились; компилируются как классы |
| `presets` | статические пресеты |
| поля ядра | `selectorPrefix`, `altColor`, `warningMode`, `media`, `maxDepth`, `maxDepthMode`, `specificityMode`, `importantMode`, `childSelectorMode`, `onWarning`, `onError` — плоско, как в v1 (D-034) |

| Метод | Что делает |
|-------|------------|
| `add(id, source)` | сканирует исходник и учитывает токены файла; `true`, если набор изменился |
| `set(id, entries)` | то же, но записи уже готовы (`'<цель> <токен>'`, см. `createAttrsScanner`) — для webpack, где сканирует лоадер |
| `remove(id)` | снимает файл с учёта |
| `has(id)` | стоит ли файл на учёте |
| `setPreset(id, preset)` / `removePreset(id)` | динамические пресеты из `*.mn.ts` |
| `css()` | готовый CSS; кешируется по слепку набора |
| `takeWarnings()` | предупреждения последней компиляции; вызов очищает очередь |
| `clear()` | забыть всё — нужен на старте пересборки |

### Что здесь неочевидно, но важно

**Набор файла заменяется целиком, а не дополняется.** Иначе токен, убранный при
редактировании, остаётся в CSS до перезапуска сборки — этим болел плоский
`Set` до Q-09.

**`add` возвращает признак изменения.** По нему плагин решает, нужна ли
пересборка, и не гоняет компиляцию на каждое сохранение файла без правок.

**Порядок токенов в слепке фиксирован.** Иначе перестановка меняла бы ключ
кеша, и кеш не срабатывал бы там, где ничего не изменилось.

**Предупреждения перехватываются всегда.** Ядро по умолчанию пишет в
`console`, а у сборщика свой канал вывода — иначе предупреждение либо теряется
в потоке сборки, либо дублируется. `warningMode: 'silent'` уважается,
`'error'` роняет сборку, колбэк `onWarning` вызывается дополнительно к режиму.

## `createFileFilter`, `createMatcher`, `flatSafelist`

- `createFileFilter(options, root)` — `accepts(path)` (сканировать ли файл) и
  `isPreset(path)`; учитывает `extensions`, `include`, `exclude`, `skipPartials`.
- `createMatcher(matcher, root)` — `MnFileMatcher` в функцию.
- `flatSafelist(safelist)` — группы токенов через пробел в плоский список.

## `parseAttrs`, `createAttrsScanner`, `compileEntries`

Части, из которых собран накопитель; нужны тому, кто сканирует и компилирует
сам (webpack-лоадер, CLI).

- `parseAttrs(attrs)` — любая форма `attrs` в карту `{ сканируемый: целевой }`.
- `createAttrsScanner({ attrs, ...опции сканера })` — сканер файла; возвращает записи
  `'<цель> <токен>'` (`'class p10'`, `'m p10'`). Сканируемые атрибуты группируются
  по цели — на группу один проход.
- `compileEntries(mn, entries)` — компилирует записи, каждую своим `getCompiler(цель)`.

## `walkFiles(dir, extensions, maxDepth?)`

Рекурсивный обход директории с фильтром по расширению. Пропускает скрытые
каталоги и `node_modules`; нечитаемые пути (битый симлинк, каталог без прав)
молча пропускает — это не повод ронять сборку. `maxDepth` по умолчанию 10:
защита от циклических симлинков.

## Чего здесь нет

**Загрузки пресет-файлов.** Она у каждого сборщика своя: esbuild транспилирует
через собственный `transformSync`, webpack — через лоадер, vite и rollup — по-
своему. Общего знаменателя, который не тянул бы в пакет чужую зависимость,
здесь нет.

**Работы с ассетами и хуками.** Это и есть то, ради чего плагин существует;
каркас закрывает всё остальное.
