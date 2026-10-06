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

| Опция | Тип | По умолчанию | Описание |
|-------|-----|-------------|----------|
| `attrs` | `string \| string[] \| Record<string, string>` | `'class'` | Какие атрибуты сканировать и во что разворачивать: `'class, className:class'`, `'class, m, m-n'` → `[m~="p10"]`. Подробно — [`attrs`](../minotation-build#attrs--какие-атрибуты-сканировать-и-во-что-разворачивать) |
| `extensions` | `string[]` | `['.html','.jsx','.tsx','.vue','.svelte']` | Расширения файлов приложения |
| `presets` | `Array<(mn) => void>` | стандартный набор | Статические пресеты |
| `presetExtensions` | `string[]` | `['.mn.ts','.mn.js','.mn.tsx']` | Расширения динамических пресет-файлов |
| `fileName` | `string` | `'mn.css'` | Имя выходного CSS-asset'а |
| `root` | `string` | `process.cwd()` | Корень для сканирования файлов |
| `syntax` | `boolean` | авто | Разбирать `.js/.jsx/.ts/.tsx` парсером вместо текстового поиска; в `.vue`/`.svelte`/`.astro` так разбирается скриптовая часть. По умолчанию — автоматически, по расширению файла. `false` выключает, `true` требует парсер явно (см. [ядро](../core#сканер-текстовый-и-синтаксический)) |
| `mn` | `object` | — | Опции mn-инстанса: `selectorPrefix`, `media` |

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
