# minotation-webpack

Webpack loader + plugin для [minotation](../minotation) — сборка CSS из MN-токенов во время webpack-сборки.

```bash
npm install minotation-webpack
```

## Быстрый старт

```js
// webpack.config.js
const { MnWebpackPlugin } = require('minotation-webpack');

module.exports = {
  plugins: [new MnWebpackPlugin({ attrs: 'class, className:class' })],
};
```

```js
// src/index.js — CSS через конвейер проекта
import 'minotation-webpack/mn.css';
```

Перед каждой сборкой плагин сам сканирует проект (`root`, по умолчанию `src/`; в
watch — заново при правках), поэтому правило-лоадер для разметки не обязательно.

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

## Как CSS попадает на страницу

- **Импорт `minotation-webpack/mn.css`** — CSS идёт тем же конвейером, что
  остальной CSS проекта (`css-loader` + `mini-css-extract-plugin`, нативный CSS
  webpack `experiments.css`): имя с хешем по вашим правилам (`[contenthash]`),
  ссылка через `HtmlWebpackPlugin`, минификация. Отдельный файл плагин не выдаёт.
  Одна запись `entry` — `minotation-webpack/mn.css?entry=admin`.
- **Без импорта** — плагин выдаёт ассет по `fileName`. По умолчанию с хешем, если
  он есть в `output.filename` проекта (`mn.3f9a1c2e.css`), иначе `mn.css`. Ассет
  привязан к точке входа, так что `HtmlWebpackPlugin` сошлётся на него сам; рядом —
  `mn-manifest.json` с фактическими именами.

## Динамические пресеты

Помимо статических пресетов в конфиге плагина, можно подключать пресеты прямо из кода приложения — как обычные side-effect импорты, аналогично `import 'style.scss'`:

```ts
// src/main.ts
import './mn/app.mn';  // ← подключает пресет
```

Файл пресета (`src/mn/app.mn.ts`) экспортирует функцию, принимающую `mn`:

```ts
// src/mn/app.mn.ts
import type { MnInstance } from 'minotation';

export function presetApp(mn: MnInstance): void {
  mn.setKeyframes('spin', {
    '0%':   { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  });
  mn('spinner', () => ({
    style: { animation: 'spin 1s linear infinite' },
  }));
}
```

Пресеты из корня скана плагин выполняет сам. Чтобы webpack перехватывал
импорт пресета (и в бандл не попал его код), добавьте правило с `preset-loader`:

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      { test: /\.mn\.(ts|js|tsx)$/, use: 'minotation-webpack/preset-loader' },
    ],
  },
  plugins: [new MnWebpackPlugin()],
};
```

`preset-loader` выполняет пресет-функцию на внутреннем mn-инстансе и возвращает в бандл пустой модуль — **ноль байт в рантайме**.

## Опции

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Все опции задаются у плагина; лоадеры опций не принимают.

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `root` | `src/`, если есть, иначе корень проекта | корень скана — или несколько (монорепо); с массивом относительные пути `include` — от `context` |
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
| `presetExtensions` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты |
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
| `entry` | — | несколько CSS из одной сборки; импорт записи — `mn.css?entry=<имя>` |
| `fileName` | `[name].[hash].css`, если хеш есть в `output.filename`, иначе `[name].css` | имя ассета без импорта `mn.css` |
| `manifest` | `true` → `mn-manifest.json` | фактические имена ассетов; `false` — не писать |

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

Опции сканера задаются лоадеру, а не плагину:

```js
{
  loader: 'minotation-webpack/loader',
  options: { attrs: 'class, className:class', syntax: false },
}
```
