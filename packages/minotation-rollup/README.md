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
| `root` | рабочая директория | корень первичного скана |
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
| `selectorPrefix` | — | префикс всех селекторов: `'.app '` → `.app .p10{…}` |
| `altColor` | `false` | запасное непрозрачное объявление рядом с `rgba` |
| `strict` | `false` | предупреждение компиляции роняет сборку |
| `media` | стандартные | карта именованных медиа: `{ wide: { query: '(min-width: 1200px)' } }` → `p10@wide` |
| `maxDepth`, `maxDepthMode` | `10`, `'warn'` | предел глубины контекстных селекторов (`<N`, `>N`) |
| `onWarning` | в лог сборки | предупреждения компиляции: `'silent'` — молчать, функция — своя обработка |
| `onError` | — | обработчик ошибок ядра |
| `onScannerWarning` | `console.warn` | колбэк сканера: `syntax: true`, а пакета `typescript` нет |
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
