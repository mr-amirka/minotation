# minotation-astro

Astro-интеграция для [minotation](../core) — тонкая обёртка над
[`minotation-vite`](../minotation-vite): Astro сам собирается через Vite,
интеграция просто подключает уже готовый Vite-плагин.

```bash
npm install minotation-astro
```

## Быстрый старт

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { mnAstro } from 'minotation-astro';

export default defineConfig({
  integrations: [mnAstro({ attrs: 'class' })],
});
```

Если острова написаны на React, там атрибут `className`, а в `.astro` — `class`.
Чтобы `className` давал те же классы, его разворачивают в `class`:

```js
mnAstro({ attrs: 'class, className:class' })
```

Без `:class` (`attrs: ['class', 'className']`) токены из `className` компилируются
в селектор по атрибуту `[className~="p10"]`, и стили к элементу не применятся —
подробно в [`attrs`](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать).

По умолчанию сканируются `.html`, `.jsx`, `.tsx`, `.vue`, `.svelte` **и `.astro`**
(в отличие от `minotation-vite`, где `.astro` не в списке по умолчанию — Astro-проекты
не единственный потребитель `minotation-vite`).

## Как CSS попадает на страницу

- **`astro build`** — `mn.css` кладётся в корень сборки, а в каждую страницу
  вставляется `<link rel="stylesheet" href="/mn.css">`.
- **`astro dev`** — `mn.css` отдаёт dev-сервер (middleware `minotation-vite`), ссылка
  на него и HMR-слушатель вставляются в каждую страницу. Правка разметки или
  `*.mn.ts` обновляет стили без перезагрузки страницы.

Оба пути учитывают `base` из конфига Astro: при `base: '/docs'` ссылка — `/docs/mn.css`.

## Особенность Astro: классы в frontmatter

В `.astro` классы часто собирают в переменных frontmatter и подставляют как `class={th}` —
статическое извлечение такие токены не видит. Достаточно назвать переменную с суффиксом `Class`:

```astro
---
const thClass = 'py12 px14 bb1 bsS';
---
<th class={thClass}>Сервис</th>
```

Набор суффиксов настраивается (`classVarSuffixes`), а для случаев, когда переименовать нельзя,
остаётся явный `safelist`:

```js
mnAstro({ attrs: 'class', classVarSuffixes: ['Class', 'Cls'], safelist: ['crP taL vaT'] })
```

## Опции

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Здесь — он целиком, с умолчаниями этого плагина,
и опции, которые есть только у него.

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `root` | `<root Astro>/src` | корень первичного скана |
| `extensions` | `.html .jsx .tsx .vue .svelte .astro` | какие файлы сканировать, если не задан `include` |
| `include` | — | какие файлы сканировать: RegExp, путь, функция или массив |
| `exclude` | — | какие файлы пропускать; важнее `include` |
| `skipPartials` | `false` | пропускать файлы-партиалы `_*` |
| `presets` | стандартный набор | статические пресеты |
| `presetExtensions` | `.mn.ts .mn.js .mn.tsx` | динамические пресеты (`import './app.mn'`) |
| `safelist` | `[]` | токены, нужные всегда; группы через пробел |
| `classVarSuffixes` | `['Class']` | переменные со списком токенов: `const thClass = 'p10'` |
| `mergeFnNames` | `['mne', 'mnClass']` | функции, чьи строковые аргументы — токены |
| `syntax` | авто | разбирать JS/TS парсером; `false` — только текст |
| `mn` | — | опции ядра целиком: `selectorPrefix`, `altColor`, `strict`, `media`, `maxDepth`, `onWarning`, `onError` |

Под капотом — [`minotation-vite`](../minotation-vite): `mnAstro(options)` передаёт опции
в `mnVite(...)`, дополняя `extensions` по умолчанию `.astro`.

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

Для `.astro` это значит: фронтматтер `---…---` разбирается парсером, разметка —
текстом. Острова на `.tsx`/`.jsx` (React, Preact, Solid) разбираются целиком.
