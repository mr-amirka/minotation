# minotation-vite

Vite-плагин для [minotation](../minotation) — сборка CSS из MN-токенов во время разработки и продакшен-билда.

```bash
npm install minotation-vite
```

## Быстрый старт

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { mnVite } from 'minotation-vite';
import { presetStandard, presetSynonyms, presetMedias } from 'minotation';

export default defineConfig({
  plugins: [
    mnVite({
      attrs: 'class, className:class', // className в React — тоже класс
      extensions: ['.tsx', '.jsx'],
      presets: [presetStandard, presetSynonyms, presetMedias],
    }),
  ],
});
```

Плагин автоматически сканирует `src/`, извлекает MN-токены из указанных атрибутов и генерирует CSS.

> **Извлечение статическое.** Токены берутся из литеральных значений `class`/`className`
> в исходниках. Классы, собранные в переменных или выражениях (`const th = 'py12 px14'`,
> `clsx(...)`, шаблонные строки) — частый приём в `.astro` и JSX — при таком разборе не видны.

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

Для таких случаев есть два механизма.

### 1. Конвенция имени — `classVarSuffixes` (по умолчанию включена)

Переменная, чьё имя заканчивается на `Class`, считается списком MN-токенов:

```ts
const thClass = 'py12 px14 bb1 bsS';   // ← попадёт в CSS
const th = 'py12 px14';                 // ← нет
<th class={thClass}>…</th>
```

Работает для присваивания и для свойства объекта, для строк в любых кавычках, включая
шаблонные (подстановки `${…}` пропускаются, статические части берутся).

Вызов такой переменной тоже сканируется — это случай `mnClass`, которая возвращает функцию
для дополнительных токенов:

```ts
const thClass = mnClass('py12 px14');
<th class={thClass(`w(|max)150`)}>…</th>   // ← w(|max)150 попадёт в CSS
```

`Class`-переменные и `mnClass` — для **повторно используемых наборов** токенов, а не для
вариантов (ветви `const btnClass = cond ? 'a' : 'b'` сканер прочитает, но вариант лучше выразить
уточнением). Варианты — выше.

Набор суффиксов настраивается:

```ts
mnVite({ classVarSuffixes: ['Class', 'Cls', 'Styles'] })   // заменяет список по умолчанию
mnVite({ classVarSuffixes: [] })                            // отключить механизм
```

### 2. Явный список — `safelist`

Когда переименовать переменную нельзя (чужой код, вычисляемые строки):

```ts
mnVite({ safelist: ['py12 px14 r8', 'crP', 'taL'] })
```

## Как CSS попадает на страницу

CSS отдаётся модулем `virtual:mn.css`, и дальше его ведёт Vite: имя с хешем,
ссылка в HTML, минификация, HMR. Опция `inject` выбирает, как он попадает в
`index.html` SPA:

| `inject` | Что происходит |
|---|---|
| `'inline'` (по умолчанию) | `<style data-mn>` прямо в HTML; в dev — обновление без перезагрузки |
| `'link'` | `<link>` на модуль: Vite выдаёт файл с хешем (`assets/index-3f9a1c2e.css`) и сам ставит ссылку |
| `false` | HTML не трогается — подключите CSS импортом в коде: `import 'virtual:mn.css'` |

Без `index.html` (SSR, мета-фреймворки) CSS подключают импортом `virtual:mn.css`
в точке входа. С записями `entry` — `virtual:mn/<имя>.css` для одной записи.
Лишнего файла `mn.css` рядом со сборкой больше нет.

## Динамические пресеты

Помимо статических пресетов в конфиге, можно подключать пресеты прямо из кода приложения — как обычные side-effect импорты, аналогично `import 'style.scss'`:

```ts
// src/main.tsx
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

Плагин перехватывает файл, выполняет пресет-функцию на внутреннем mn-инстансе и возвращает в бандл пустой модуль — **ноль байт в рантайме**.

При изменении пресет-файла в dev-режиме CSS обновляется без перезагрузки страницы (HMR).

По умолчанию пресет-файлами считаются файлы с расширениями `.mn.ts`, `.mn.js`, `.mn.tsx`.

## Монорепо: общий пакет компонентов

Компоненты с токенами лежат в отдельном пакете, а собирает их приложение:

```
repo/
  components/src/**.tsx        ← общие компоненты (токены в className, пресеты *.mn.ts)
  games/my-game/
    src/**.tsx
    vite.config.ts             ← mnVite здесь
```

По умолчанию сканируется только `games/my-game/src`: токены общего пакета до сборочного CSS не
доходят (модули, которые лишь проходят через Vite, собираются слишком поздно). Решение —
**несколько корней скана**:

```ts
// games/my-game/vite.config.ts
import path from 'node:path';

mnVite({
  attrs: 'className:class',
  root: [
    path.resolve(__dirname, 'src'),
    path.resolve(__dirname, '../../components/src'),
  ],
});
```

- токены и пресеты `*.mn.ts` берутся из **всех** корней — и **только** из них: пресеты второй игры
  из `games/other` в CSS этой игры не попадут;
- `include`/`exclude` по-прежнему отбирают файлы токенов (относительные пути — от корня проекта Vite);
- то же работает в `minotation-webpack`, `minotation-rollup`, `minotation-esbuild` (относительные
  пути `include` при массиве корней — от рабочей директории или `context`).

## Опции

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Здесь — он целиком, с умолчаниями этого плагина,
и опции, которые есть только у него.

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `root` | `<root Vite>/src` | корень первичного скана — или несколько (монорепо, см. ниже) |
| `extensions` | `.html .jsx .tsx .vue .svelte` | какие файлы сканировать, если не задан `include` |
| `include` | — | какие файлы сканировать: RegExp, путь, функция или массив |
| `exclude` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `false` | пропускать файлы-партиалы `_*` |
| `presets` | стандартный набор | статические пресеты; в стандартном наборе первым — `presetHints` (подсказки о `t0`, `flex`, `text-center`, D-024); точечно — `presetHints({ excludeGroups, excludeHandlers })` в своём списке (D-042); свой список заменяет набор целиком |
| `presetExtensions` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты (`import './app.mn'`) |
| `safelist` | `[]` | токены, нужные всегда; группы через пробел |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |
| `selectorPrefix` | — | префикс всех селекторов: `'.app '` → `.app .p10{…}` |
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
| `notationMode` | `'context-qualified'` | режим синтаксиса классов: `'context-qualified'` (`bg-blue-500:hover@md`), `'tw4-compatible'` (как Tailwind: `md:hover:bg-blue-500`) `'breakpoint-prefixed'` (как quantum-css: `SM_px15`) или `'property-value'` (как Master CSS: `bg:blue:hover@md`); строки пресетов — в режиме пресета (D-045) |
| `contextWhere` | `false` | контекст селектора в `:where()`: специфичность только у класса, как у вариантов Tailwind v4 (`cF00<.card:h` → `.cF00…:is(:where(.card:hover) *)`), во всех режимах (D-049) |
| `mediaNesting` | `false` | вложенные `@media` вместо `and`: `md:hover:` → `@media (width >= 48rem){@media (hover: hover){…}}`, как у Tailwind 4 (D-070) |
| `notationConflictMode` | `'warn'` | один класс в файлах с разными режимами синтаксиса значит разное: `'warn'` — предупреждение, `'strict'` — сборка падает (D-045). Режим файла — комментарий `@minotation notationMode: …` в начале файла или поле `"minotation"` в `package.json` пакета |
| `warningMode` | `'log'` | что делать с предупреждением компиляции: `'log'` — в лог сборки, `'silent'` — молчать, `'error'` — уронить сборку; `maxDepthMode`, `specificityMode`, `importantMode`, `childSelectorMode` не затрагивает |
| `onWarning` | — | колбэк `(warning) => void` на каждое предупреждение, дополнительно к `warningMode` |
| `onError` | — | обработчик ошибок ядра |
| `onScannerWarning` | `console.warn` | колбэк сканера: `syntax: true`, а пакета `typescript` нет |
| `metrics` | `true` → `mn-metrics.json` | статистика употребления токенов — общая и по файлам; строка — свой путь, `false` — не писать |
| `entry` | — | несколько CSS из одной сборки; запись подключается модулем `virtual:mn/<имя>.css` |
| `inject` | `'inline'` | только у vite: как CSS попадает в `index.html` — раздел выше |

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
