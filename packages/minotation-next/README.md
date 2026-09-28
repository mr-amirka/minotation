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

| Опция | Тип | По умолчанию | Описание |
|-------|-----|-------------|----------|
| `output` | `string` | `'static/mn.css'` | Путь выходного CSS-файла |
| `presets` | `Array<(mn) => void>` | стандартный набор | Статические пресеты |
| `selectorPrefix` | `string` | — | Глобальный префикс для CSS-селекторов |
| `media` | `object` | — | Карта именованных медиа-контекстов |
| `enabled` | `boolean` | `true` | Включить/выключить MN (удобно через env-переменную) |
| `attrs` | `string[]` | `['class', 'className']` | Атрибуты, в которых ищутся токены |
| `classVarSuffixes` | `string[]` | `['Class']` | Суффиксы имён переменных со списком токенов |
| `mergeFnNames` | `string[]` | `['mne', 'mnClass']` | Функции слияния, чьи строковые аргументы сканируются |
| `syntax` | `boolean` | авто | Разбирать JS/TS парсером; по умолчанию — по расширению файла |

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
