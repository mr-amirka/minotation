# minotation-rollup

Rollup-плагин для [minotation](../core) — сборка CSS из MN-токенов при билде.

```bash
npm install minotation-rollup
```

## Быстрый старт

```js
// rollup.config.js
import { mnRollup } from 'minotation-rollup';
import { presetStandard, presetSynonyms, presetMedias } from 'minotation';

export default {
  input: 'src/main.js',
  output: { file: 'dist/bundle.js', format: 'es' },
  plugins: [
    mnRollup({
      attrs: 'class, className:class',
      extensions: ['.tsx', '.jsx'],
      presets: [presetStandard, presetSynonyms, presetMedias],
    }),
  ],
};
```

Плагин сканирует `root` (по умолчанию `process.cwd()`), извлекает MN-токены
из указанных атрибутов и эмитирует `mn.css` как отдельный asset.

**Важно:** в отличие от `minotation-vite`/`minotation-webpack`, у Rollup нет
встроенного понятия "сборщик со сплитом на server/client" — плагин работает
с одним компилятором на билд, но всё равно сканирует файлы по расширениям
(`buildStart`), а не строго по графу импортов — чтобы не терять токены из
модулей, не попавших в конкретный текущий бандл при нескольких точках входа.

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

Как и в `minotation-vite` — файлы `*.mn.ts`/`*.mn.js` подключаются как обычные
side-effect импорты (`import './mn/app.mn'`), плагин выполняет их на внутреннем
mn-инстансе и возвращает в бандл пустой модуль.

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
| `isolateMode` | `'none'` | изоляция областей пакетов: `'class'` — `.p-4._4`, `'where'` — `.p-4:where(._4)`; класс области сборка пишет в разметку файлов пакета ([minotation-build](../minotation-build/README.md#изоляция-областей-пакетов--isolatemode-d-075d-077)) |
| `unreachableClassMode` | `'warn'` | класс задан из JS в файле изолированной области — элемент класса области не получит |

Опции можно задать и в общем файле `minotation.config.js` рабочего каталога — он один для всех плагинов и CLI, опции из кода сливаются поверх ([minotation-build](../minotation-build/README.md#файл-настроек-minotationconfig-d-081)).
| `presetExtensions` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты (`import './app.mn'`) |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |
| `altColor` | `false` | запасное непрозрачное объявление рядом с `rgba` |
| `media` | стандартные | карта именованных медиа: `{ wide: { query: '(width >= 1200px)' } }` → `p10@wide` |
| `maxDepth`, `maxDepthMode` | —, `'warn'` | предел глубины контекстных селекторов (`<N`, `>N`); режим при превышении: `'warn'` — предупреждение с подсказкой, `'silent'` — молчать, `'strict'` — токен не даёт CSS, сборка падает (D-039) |
| `maxSpecificity`, `maxSpecificityMode` | `16`, `'warn'` | предел множителя специфичности `*N` (1…16, выше 16 задать нельзя, D-089); при превышении: `'warn'` — предупреждение с подсказкой, CSS есть до `*16`, выше — нет; `'strict'` — токен без CSS и ошибка сборки |
| `mediaSyntax` | `'range'` | запись условий ширины и высоты (D-087): `'range'` — `(width >= 48rem)`, `(width < 480px)`; `'classic'` — `min-`/`max-` для старых браузеров |
| `axisMode` | `'logical'` | осевые формы `presetStandard` (D-101): `'logical'` — `px16` → `padding-inline:16px`; `'physical'` — `padding-left` + `padding-right` |
| `overflowWrapMode` | `'standard'` | имя свойства у `owr` (D-106): `'standard'` — `owrBW` → `overflow-wrap:break-word`; `'legacy'` — `word-wrap` (IE, старый Edge, Firefox до 49); `'both'` — оба объявления |
| `mediaConflictMode` | `'warn'` | имя из опции `media` совпало с медиа пресета — остаётся определение из опции (D-092); `'warn'` — предупреждение, `'silent'` — молчать, `'strict'` — ошибка подключения пресетов |
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
| `warningMode` | `'log'` | что делать с предупреждением компиляции: `'log'` — в лог сборки, `'silent'` — молчать, `'error'` — уронить сборку; `maxDepthMode`, `maxSpecificityMode`, `specificityMode`, `importantMode`, `childSelectorMode` не затрагивает |
| `onWarning` | — | колбэк `(warning) => void` на каждое предупреждение, дополнительно к `warningMode` |
| `onError` | — | обработчик ошибок ядра |
| `onScannerWarning` | `console.warn` | колбэк сканера: `syntax: true`, а пакета `typescript` нет |
| `metrics` | `true` → `mn-metrics.json` | статистика употребления токенов — общая и по файлам; строка — свой путь, `false` — не писать |
| `fileName` | по `output.assetFileNames` rollup — `assets/mn-[hash].css` | имя CSS; шаблон с `[name]` и `[hash]` (`'mn.css'` — постоянное имя) |
| `manifest` | `true` → `mn-manifest.json` | фактические имена: `{ "mn.css": "assets/mn-3f9a1c2e.css" }`; `false` — не писать |
| `entry` | — | несколько CSS из одной сборки — по файлу на запись |

## Имя CSS и кеш

CSS отдаётся в граф ассетов rollup, и имя ему назначает rollup по `output.assetFileNames`
— по умолчанию с хешем содержимого (`assets/mn-3f9a1c2e.css`), так что после правок
браузер не возьмёт старые стили из кеша. `@rollup/plugin-html` сошлётся на файл сам.
Если ссылку пишете руками, фактическое имя — в `mn-manifest.json`; постоянное имя —
`fileName: 'mn.css'`.

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
