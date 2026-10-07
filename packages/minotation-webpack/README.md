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
| `root` | `src/`, если есть, иначе корень проекта | корень скана |
| `extensions` | `.html .jsx .tsx .vue .svelte` | какие файлы сканировать, если не задан `include` |
| `include` | — | какие файлы сканировать: RegExp, путь, функция или массив |
| `exclude` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `false` | пропускать файлы-партиалы `_*` |
| `presets` | стандартный набор | статические пресеты |
| `presetExtensions` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты |
| `safelist` | `[]` | токены, нужные всегда; группы через пробел |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |
| `selectorPrefix` | — | префикс всех селекторов: `'.app '` → `.app .p10{…}` |
| `altColor` | `false` | запасное непрозрачное объявление рядом с `rgba` |
| `strict` | `false` | предупреждение компиляции роняет сборку |
| `media` | стандартные | карта именованных медиа: `{ wide: { query: '(min-width: 1200px)' } }` → `p10@wide` |
| `maxDepth`, `maxDepthMode` | `10`, `'warn'` | предел глубины контекстных селекторов (`<N`, `>N`) |
| `onWarning` | в лог сборки | предупреждения компиляции: `'silent'` — молчать, функция — своя обработка |
| `onError` | — | обработчик ошибок ядра |
| `onScannerWarning` | `console.warn` | колбэк сканера: `syntax: true`, а пакета `typescript` нет |
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
