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

| Опция | Тип | По умолчанию | Описание |
|-------|-----|-------------|----------|
| `output` | `string` | `'app.css'` | Путь выходного CSS-файла |
| `presets` | `Array<(mn) => void>` | стандартный набор | Статические пресеты |
| `selectorPrefix` | `string` | — | Глобальный префикс для всех CSS-селекторов |
| `media` | `object` | — | Карта именованных медиа-контекстов |
