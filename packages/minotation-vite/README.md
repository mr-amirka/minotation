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

- **Dev:** инжектирует `<style data-mn>` в HTML + HMR без перезагрузки страницы
- **Build:** эмитирует `mn.css` как отдельный asset

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

## Опции

Эталонный набор опций — общий для всех плагинов и CLI, описан в
[`minotation-build`](../minotation-build#эталонный-набор-опций-d-026). Здесь — он целиком, с умолчаниями этого плагина,
и опции, которые есть только у него.

| Опция | По умолчанию | Что делает |
|---|---|---|
| `attrs` | `'class'` | какие атрибуты сканировать и во что разворачивать: `'class, className:class'`; `'class, m'` → `[m~="p10"]` — [подробно](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `root` | `<root Vite>/src` | корень первичного скана |
| `extensions` | `.html .jsx .tsx .vue .svelte` | какие файлы сканировать, если не задан `include` |
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
