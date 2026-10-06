# minotation-next

Next.js интеграция для [minotation](../minotation) — подключает MN к webpack-сборке Next.js через `withMn`.

```bash
npm install minotation-next
```

> **Ограничение:** работает только в webpack-режиме Next.js.
> Turbopack (по умолчанию в Next.js 15+) не поддерживается.

## Быстрый старт

```ts
// next.config.ts
import { withMn } from 'minotation-next';

export default withMn(
  {
    experimental: { turbo: false },  // отключаем Turbopack
  },
  {
    output: 'static/mn.css',
  },
);
```

Подключите сгенерированный CSS в корневом layout:

```ts
// app/layout.tsx
import '../public/static/mn.css';
```

## Динамические пресеты

Пресеты можно подключать прямо в коде приложения — как обычные side-effect импорты, аналогично `import 'style.scss'`:

```ts
// app/layout.tsx  (или любой entry-файл)
import '../mn/app.mn';
```

Файл пресета (`mn/app.mn.ts`) экспортирует функцию, принимающую `mn`:

```ts
// mn/app.mn.ts
import type { MnFn } from 'minotation';

export function presetApp(mn: MnFn): void {
  mn.setKeyframes('spin', {
    '0%':   { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  });
  mn('spinner', () => ({
    style: { animation: 'spin 1s linear infinite' },
  }));
}
```

`withMn` автоматически добавляет правило для файлов `*.mn.ts` / `*.mn.js` / `*.mn.tsx` —
ничего дополнительно настраивать не нужно. В бандл попадает пустой модуль (**ноль байт в рантайме**).

## Опции

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Здесь — он целиком, с умолчаниями этого плагина,
и опции, которые есть только у него.

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class, className:class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `include` | — | какие файлы сканировать: RegExp, путь, функция или массив |
| `exclude` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `false` | пропускать файлы-партиалы `_*` |
| `presets` | стандартный набор | статические пресеты |
| `safelist` | `[]` | токены, нужные всегда; группы через пробел |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |
| `mn` | — | опции ядра целиком: `selectorPrefix`, `altColor`, `strict`, `media`, `maxDepth`, `onWarning`, `onError` |
| `output` | `'static/mn.css'` | путь выходного CSS-файла |
| `enabled` | `true` | включить/выключить MN (удобно через env-переменную) |
| `selectorPrefix`, `media`, `onWarning` | — | то же, что поля `mn`, на верхнем уровне (как у webpack) |

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
