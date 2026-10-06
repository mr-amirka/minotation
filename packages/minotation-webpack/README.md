# minotation-webpack

Webpack loader + plugin для [minotation](../minotation) — сборка CSS из MN-токенов во время webpack-сборки.

```bash
npm install minotation-webpack
```

## Быстрый старт

```js
// webpack.config.js
const { MnWebpackPlugin } = require('minotation-webpack');
const { presetStandard, presetSynonyms, presetMedias } = require('minotation');

module.exports = {
  module: {
    rules: [
      {
        test: /\.(html|jsx|tsx)$/,
        use: 'minotation-webpack/loader',
      },
    ],
  },
  plugins: [
    new MnWebpackPlugin({
      output: 'dist/app.css',
      presets: [presetStandard, presetSynonyms, presetMedias],
    }),
  ],
};
```

Loader извлекает MN-токены из исходников, plugin компилирует их в CSS и эмитирует как asset.

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

Чтобы webpack перехватывал пресет-файлы, добавьте правило с `preset-loader`:

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      { test: /\.(html|jsx|tsx)$/, use: 'minotation-webpack/loader' },
      { test: /\.mn\.(ts|js|tsx)$/, use: 'minotation-webpack/preset-loader' },
    ],
  },
  plugins: [new MnWebpackPlugin({ output: 'dist/app.css' })],
};
```

`preset-loader` выполняет пресет-функцию на внутреннем mn-инстансе и возвращает в бандл пустой модуль — **ноль байт в рантайме**.

## Опции плагина

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Здесь — он целиком, с умолчаниями этого плагина,
и опции, которые есть только у него.

В webpack набор делится: сканирует лоадер, компилирует плагин.

**Лоадер** (`options` правила):

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `include` | — | какие файлы сканировать: RegExp, путь, функция или массив |
| `exclude` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `false` | пропускать файлы-партиалы `_*` |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |

**Плагин** (`new MnWebpackPlugin({...})`):

| Опция | По умолчанию | Что делает |
|---|---|---|
| `presets` | стандартный набор | статические пресеты |
| `safelist` | `[]` | токены, нужные всегда; группы через пробел |
| `mn` | — | опции ядра целиком: `selectorPrefix`, `altColor`, `strict`, `media`, `maxDepth`, `onWarning`, `onError` |
| `output` | `'app.css'` | путь выходного CSS-файла |
| `selectorPrefix`, `media`, `onWarning` | — | то же, что поля `mn`, на верхнем уровне (исторически у webpack); перекрывают `mn` |

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
