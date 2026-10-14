# minotation-esbuild

esbuild-плагин для [minotation](../core) — сборка CSS из MN-токенов при билде.

```bash
npm install minotation-esbuild
```

## Быстрый старт

```js
// build.js
const esbuild = require('esbuild');
const { mnEsbuild } = require('minotation-esbuild');

esbuild.build({
  entryPoints: ['src/main.tsx'],
  outdir: 'dist',
  bundle: true,
  plugins: [
    mnEsbuild({ attrs: 'class, className:class' }),
  ],
});
```

Плагин сканирует `root` (по умолчанию `process.cwd()`) на старте сборки
(`onStart`), извлекает MN-токены из указанных атрибутов и пишет `mn.css`
рядом с `outdir`/`outfile` по завершении (`onEnd`).

**Важно:** в отличие от Rollup/Vite, esbuild не умеет декларативно
"эмитировать asset" — плагин пишет CSS-файл на диск напрямую через `fs`.
`onLoad` не подменяет контент файлов (возвращает `undefined`) — только
наблюдает за реально загружаемыми esbuild'ом модулями, докидывая их токены
поверх blanket-скана `onStart` (защита от пропуска токенов из модулей,
не попавших в текущий конкретный бандл при нескольких точках входа —
как и у `minotation-vite`/`minotation-rollup`).

### Варианты и состояния — без выбора классов в JS

Токены в `className` — только статические строки; вариант — обычный класс на элементе, а
зависящие от него токены уточнены им в записи:

```tsx
<div className={`dF aiC (fx1|o0.5).transition (bg1D2A4D|cF).splash ${variant}`} />   // ✅
<div className={variant === 'splash' ? 'bg1D2A4D cF' : 'fx1 o0.5'} />                 // ✅ тоже: ветви — литералы
<div className={clsx({ 'bg1D2A4D cF': splash })} />                                   // ❌ токенов не будет в CSS
```

Сканер читает литералы, а не исполняет код. Литералы, которые могут стать значением, он берёт
(ветви `?:`, правая часть `&&`, обе части `||`/`??`); аргументы `clsx(...)` и склейку имён токенов
(`'bg' + color`) — нет: сборка зелёная, стилей нет. Запись с уточнением классом всё равно лучше:
она одна на N вариантов, а состояние видно в разметке. Подробно, с примерами (несколько вариантов, состояния
`.active`/`.disabled`, `data-*` и ARIA, состояние родителя, медиа): [core README — «Варианты и
состояния без JS»](../core/README.md#варианты-и-состояния-без-js).

## Динамические пресеты

Как и в `minotation-vite`/`minotation-rollup` — файлы `*.mn.ts`/`*.mn.js`
сканируются на старте сборки, выполняются на внутреннем mn-инстансе.
В отличие от Rollup/Vite, esbuild не даёт перехватить `import`-подключение
пресет-файла из кода приложения (`load`-хука с заменой контента здесь нет) —
пресеты только статические (через опцию `presets`) или найденные сканером.

## Опции

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Здесь — он целиком, с умолчаниями этого плагина,
и опции, которые есть только у него.

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `root` | рабочая директория | корень первичного скана — или несколько (монорепо); с массивом относительные пути `include` — от рабочей директории |
| `extensions` | `.html .jsx .tsx .vue .svelte` | какие файлы сканировать, если не задан `include` |
| `include` | — | какие файлы сканировать: RegExp, путь, функция или массив |
| `exclude` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `false` | пропускать файлы-партиалы `_*` |
| `presets` | стандартный набор | статические пресеты; в стандартном наборе первым — `presetHints` (подсказки о `t0`, `flex`, `text-center`, D-024); точечно — `presetHints({ excludeGroups, excludeHandlers })` в своём списке (D-042); свой список заменяет набор целиком |
| `scopePresets` | `[]` | пресеты, которые могут потребовать пакеты (`requires`); пакет с чужим семейством собирается в своей области ([minotation-build](../minotation-build/README.md#области-семейств-пресетов-d-076-d-078), D-078) |
| `scopes` | `[]` | правила для пакетов и путей без своей декларации — `{ match: '@acme/ui' \| 'src/**' \| /re/, requires, notationMode }`; своя декларация пакета важнее, аварийно — `override: true` (D-082) |

Опции можно задать и в общем файле `minotation.config.js` рабочего каталога — он один для всех плагинов и CLI, опции из кода сливаются поверх ([minotation-build](../minotation-build/README.md#файл-настроек-minotationconfig-d-081)).
| `presetExtensions` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты (`import './app.mn'`) |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |
| `altColor` | `false` | запасное непрозрачное объявление рядом с `rgba` |
| `media` | стандартные | карта именованных медиа: `{ wide: { query: '(min-width: 1200px)' } }` → `p10@wide` |
| `maxDepth`, `maxDepthMode` | —, `'warn'` | предел глубины контекстных селекторов (`<N`, `>N`); режим при превышении: `'warn'` — предупреждение с подсказкой, `'silent'` — молчать, `'strict'` — токен не даёт CSS, сборка падает (D-039) |
| `specificityMode` | `'warn'` | токены с накруткой специфичности `f10*2`: `'warn'` — предупреждение с подсказкой, `'silent'` — молчать, `'strict'` — токен не даёт CSS, сборка падает (D-039) |
| `importantMode` | `'warn'` | токены с `!important` (`f10-i`) — режимы те же (D-039) |
| `childSelectorMode` | `'warn'` | токены с дочерним селектором `>` (`cF00>1`, `cF00>.child`) — режимы те же (D-041) |
| `unknownMediaMode` | `'warn'` | неизвестное имя медиа (`p10@zz`): `'warn'` — как написано и предупреждение, `'silent'` — молча, `'strict'` — брак сборки (D-058) |
| `suspectClassMode` | `'warn'` | класс другой CSS-системы (`fw-bold`, `sr-only`): `'warn'` — предупреждение без CSS, сборку не роняет; `'silent'` — молча; `'strict'` — брак сборки (D-065) |
| `handlerConflictMode` | `'warn'` | одно имя зарегистрировано двумя пресетами — побеждает последний; `'strict'` — ошибка подключения (D-067) |
| `presetConflictMode` | `'warn'` | подключены пресеты несовместимых экосистем (`ecosystems`: `presetStandard` и клон Tailwind) (D-067) |
| `groupSuspectMode` | `'warn'` | группа скобок даёт битый CSS: `cF:is(.a\|.b)`, `cF:h(2n)` (D-077) |
| `groupMode` | `'groups'` | `'css'` — скобки как в CSS, без групп `(a\|b)` (D-077) |
| `notationMode` | `'context-qualified'` | режим синтаксиса классов: `'context-qualified'` (`bg-blue-500:hover@md`), `'tw4-compatible'` (как Tailwind: `md:hover:bg-blue-500`) `'breakpoint-prefixed'` (как quantum-css: `SM_px15`) или `'property-value'` (как Master CSS: `bg:blue:hover@md`); строки пресетов — в режиме пресета (D-045) |
| `contextWhere` | `false` | контекст селектора в `:where()`: специфичность только у класса, как у вариантов Tailwind v4 (`cF00<.card:h` → `.cF00…:is(:where(.card:hover) *)`), во всех режимах (D-049) |
| `mediaNesting` | `false` | вложенные `@media` вместо `and`: `md:hover:` → `@media (width >= 48rem){@media (hover: hover){…}}`, как у Tailwind 4 (D-070) |
| `notationConflictMode` | `'warn'` | один класс в файлах с разными режимами синтаксиса значит разное: `'warn'` — предупреждение, `'strict'` — сборка падает (D-045). Режим файла — комментарий `@minotation notationMode: …` в начале файла или поле `"minotation"` в `package.json` пакета |
| `warningMode` | `'log'` | что делать с предупреждением компиляции: `'log'` — в лог сборки, `'silent'` — молчать, `'error'` — уронить сборку; `maxDepthMode`, `specificityMode`, `importantMode`, `childSelectorMode` не затрагивает |
| `onWarning` | — | колбэк `(warning) => void` на каждое предупреждение, дополнительно к `warningMode` |
| `onError` | — | обработчик ошибок ядра |
| `onScannerWarning` | `console.warn` | колбэк сканера: `syntax: true`, а пакета `typescript` нет |
| `metrics` | `true` → `mn-metrics.json` | статистика употребления токенов — общая и по файлам; строка — свой путь, `false` — не писать |
| `fileName` | `'[name].css'` | имя файла, который пишет плагин без импорта модуля; `[name]`, `[hash]` |
| `manifest` | `true` → `mn-manifest.json` | фактические имена файлов; `false` — не писать |
| `entry` | — | несколько CSS из одной сборки; модуль записи — `virtual:mn/<имя>.css` |

## Имя CSS и кеш

Лучший способ — подключить CSS импортом в коде:

```js
import 'virtual:mn.css';
```

Тогда он идёт в бандл esbuild рядом с JS (`main.css`) и получает имя по `entryNames`
— с хешем, если он там задан (`entryNames: '[name]-[hash]'`). Отдельный файл плагин
в этом случае не пишет.

Без импорта плагин пишет файл сам — по `fileName` (по умолчанию `mn.css`) и кладёт
рядом `mn-manifest.json`. Защита от кеша — `fileName: '[name].[hash].css'`.

## Синтаксический разбор

Токены ищет `createScanner` из ядра — один сканер на все сборщики. Файлы
JS-семейства он разбирает настоящим парсером, у `.vue`/`.svelte`/`.astro` так
разбирается скриптовая часть, остальное — текстом. Отдельно включать ничего не
нужно: способ выбирается по расширению.

Это снимает токены из мест, которые текстовый поиск не отличает от кода:
примеры разметки в JSDoc, закомментированный код, строки с кавычкой внутри
регулярного литерала. Парсер (`typescript`) — необязательная peer-зависимость:
нет его — работает текстовый разбор, молча. Подробности и замеры — в
[README ядра](../core#сканер-текстовый-и-синтаксический).
