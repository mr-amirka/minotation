# minotation

Minotation — компактная нотация для генерации CSS.
Наследник [minimalist-notation](https://github.com/mr-amirka/minimalist-notation) (1.x).

```bash
npm install minotation
```

## Быстрый старт

```ts
import { minotationProvider, presetStandard, presetSynonyms, presetMedias } from 'minotation';

const mn = minotationProvider();
mn.setPresets([presetStandard, presetSynonyms, presetMedias]);

// Скармливаем токены (компилятор по атрибуту: 'class' / 'className')
mn.getCompiler('class')('p10 cF00 fx bgFFF fwBold:h');

// Компилируем
mn.compile();

// Получаем CSS
for (const block of mn.styles$.getValue()) {
  console.log(block.content);
}
// → .p10{padding:10px}.cF00{color:#F00}.fx{display:flex}...
```

## CSS-переменные в значениях

Любой хендлер значения принимает `--name` и отдаёт `var(--name)`; тройной дефис — `env()`.

```
w--sidebar     → width: var(--sidebar)
c--ink         → color: var(--ink)
bg--panel      → background: var(--panel)
bc--line       → border-color: var(--line)
ff--mono       → font-family: var(--mono)
w--gap,10px    → width: var(--gap,10px)
pt---safe-top  → padding-top: env(--safe-top)
```

`_` разделяет части значения, и каждая часть проверяется отдельно — поэтому переменные
работают и внутри шорткатов:

```
ol3px_solid_--marker  → outline: 3px solid var(--marker)
tn_all_0.2s_--ease    → transition: all 0.2s var(--ease)
```

Если `_` нужен в самом имени переменной — имя закрывают `;`:

```
w--my_width;                   → width: var(--my_width)
ol--border_size;_solid_--marker → outline: var(--border_size) solid var(--marker)
```

Это рабочий способ темизации (светлая/тёмная тема на переменных) без дублирования классов.

## Токены

```
p10           → padding: 10px
w50p          → width: 50%
f1_5em        → font-size: 1.5em  (_ = .)
m-5           → margin: -5px
cF00          → color: #F00
bgTransparent → background: transparent
fx            → display: flex
p10-i         → padding: 10px !important  (-i = !important)
```

## Контекст

```
cF00:h        → .cF00:hover          (состояние)
cF00<.parent  → .parent .cF00        (родитель)
cF00@m        → @media (...) {...}   (медиа)
cF00<.p>.c    → .p .cF00 .c          (смешанная цепочка)
```

## Пресеты

| Пресет | Описание |
|--------|----------|
| `presetStandard` | 40+ обработчиков: размеры, отступы, цвета, flex, transform |
| `presetSynonyms` | Синонимы: `h`→`:hover`, `f`→`:focus`, `a`→`:active` |
| `presetMedias` | Медиа-запросы: `m`/`d` (mobile/desktop), `mouse`, `dark` |
| `presetNormalize` | Лёгкий сброс (box-sizing, margin, img) |
| `presetMain` | Полный CSS-сброс (аналог normalize.css) |
| `presetPrefixes` | Опциональные `-webkit-`/`-moz-` дубли для заданного списка свойств (`transform`, `flexDirection`, `appearance`, …) |

## API

### `minotationProvider(options?)`

Создаёт экземпляр MN.

```ts
const mn = minotationProvider({
  presets: [presetStandard, presetSynonyms, presetMedias],
  selectorPrefix: '#app ',         // префикс для селекторов: #app .p10{…}
  media: { m: { query: '(max-width: 767px)' } }, // p10@m
  altColor: false,                 // запасное непрозрачное объявление рядом с rgba
  warningMode: 'log',              // 'log' | 'silent' | 'error' — что делать с предупреждением
  onWarning: (warning) => {},      // колбэк на каждое предупреждение, дополнительно к режиму
  onError: (error) => {},          // ошибки ядра
  maxDepth: 10,                    // предел глубины контекстных селекторов (<N, >N)
  maxDepthMode: 'warn',            // 'warn' | 'block' — что делать при превышении
});
```

Вендорные префиксы подключаются пресетом `presetPrefixes`.

### `mn.setPresets(presets)`

Загружает пресеты (наборы обработчиков).

```ts
mn.setPresets([presetStandard, presetSynonyms]);
```

### `mn.getCompiler(attr)(tokens)`

Возвращает компилятор для атрибута (`'class'`, `'className'`) и принимает строку токенов.

```ts
const compile = mn.getCompiler('class');
compile('p10 cF00 fx:h');
```

### `mn.compile()`

Компилирует все накопленные токены в CSS.

### `mn.styles$.getValue()`

Возвращает массив `StyleBlock[]` — скомпилированные CSS-блоки.

### `mn(tag, handler)`

Регистрирует обработчик стиля. Экземпляр вызывается как функция; аргумент хендлера —
объект разбора токена, имя которого лежит в **`suffix`** (не `arg`).

```ts
mn('cool', (p) => ({
  style: { color: '#' + p.suffix },
}));
// coolF00 → color:#F00
```

### `mn.assign(selectors)`

Назначает MN-токены на CSS-селекторы.

```ts
mn.assign({
  '*, *:before, *:after': 'bxzBorderBox',
  'body': 'm',
});
```

### `mn.setSynonyms(map)`

Синонимы состояний.

```ts
mn.setSynonyms({ h: ':hover', f: ':focus' });
```

### `mn.setKeyframes(name, body)`

Регистрирует @keyframes.

```ts
mn.setKeyframes('fadeIn', {
  '0%': { opacity: '0' },
  '100%': { opacity: '1' },
});
```

## Сканер: текстовый и синтаксический

Токены из исходников собирает `createScanner(options)` — её зовут все плагины
сборщиков и CLI. Способ разбора выбирается **по расширению файла**, отдельно
включать ничего не нужно:

```js
import { createScanner } from 'minotation';

const scan = createScanner({ attr: 'class' });
scan(source, '/src/App.tsx');    // парсером
scan(source, '/src/App.vue');    // скрипт парсером, шаблон текстом
scan(source, '/index.html');     // текстом
```

| Что за файл | Как разбирается |
|---|---|
| `.js .jsx .mjs .cjs .ts .tsx .mts .cts` | целиком парсером |
| `.vue .svelte .astro` | `<script>` и фронтматтер `---` парсером, разметка текстом |
| всё остальное | текстом |

Парсер — TypeScript compiler API. `typescript` объявлен **необязательной**
peer-зависимостью и загружается лениво, при первом подходящем файле; сам
`import 'minotation'` его не тянет. Если парсера в проекте нет — работает
текстовый разбор, молча: точность это приятный бонус, а не условие работы.

**Зачем это нужно.** Текстовый сканер не отличает код от того, что на код
похоже. Комментарии он вырезает, но текстом, и на таком файле ошибается:

```tsx
const re = /"/;
/** Пример: <div class="p99 w999">…</div> */
export const App = () => <div class="p10 m20" />;
```

Кавычка внутри регулярного литерала открывает для него строку, JSDoc перестаёт
считаться комментарием — и `p99 w999` уезжают в CSS правилами, которые не к
чему применить. Парсеру это безразлично.

**Цена** — замерено на одном образце, 300 файлов × 20 прогонов
(`src/__benchmarks__/syntaxScan.bench.ts`):

| | текстовый | с разбором |
|---|---|---|
| JS/TS-файл | 13,3 мкс | 82,0 мкс (6,2×) |
| однофайловый компонент | 8,0 мкс | 45,5 мкс (5,7×) |

На тысячу файлов это меньше десятой доли секунды на полную пересборку.

Управлять этим всё же можно: `syntax: false` — всегда текстом, `syntax: true` —
как обычно, но отсутствие парсера становится предупреждением, а не тишиной.

Оба сканера на корректном файле дают один и тот же набор токенов — это
проверяется тестом-сторожем, а не подразумевается. Файл с синтаксической
ошибкой откатывается к текстовому разбору: недописанная скобка не повод
срывать сборку.

## Форматы сборки

Пакет публикуется в двух форматах, выбор — по полю `exports`:

| Подключение | Файлы |
|---|---|
| `import` (Vite, Node ESM, бандлеры) | `dist/esm/*.mjs` |
| `require` | `dist/*.js` (CommonJS) |

Точки входа одинаковые: `minotation`, `minotation/mne`, `minotation/syntax`.
ESM грузится и Node напрямую, и Vite как исходник workspace-пакета — обходы
вроде `ssr.external: ['minotation']` не нужны. Если в процессе оказались обе
копии (например, ESM-плагин и CJS-накопитель), они совместимы: ошибка разбора
из пресета одной копии распознаётся другой.

## Интеграции

Разбор работает во всех интеграциях одинаково, опция `syntax` — тоже.

| Пакет | Статус |
|-------|--------|
| `minotation-cli` | Команда `mn` для сборки без сборщика |
| `minotation-vite` | Vite-плагин (прототип) |
| `minotation-webpack` | Webpack loader + plugin (прототип) |
| `minotation-next` | Next.js `withMn()` (прототип, webpack-only) |
| `minotation-rollup` | Rollup-плагин (прототип) |
| `minotation-astro` | Astro-интеграция (прототип, обёртка над `minotation-vite`) |
| `minotation-esbuild` | esbuild-плагин (прототип) |

## Миграция с 1.x

| 1.x (`minimalist-notation`) | v2 (`minotation`) |
|---|---|
| `mnProvider()` | `minotationProvider()` |
| `mn('tag', handler, ...)` | `mn('tag', handler)` (без изменений) |
| `mn.presets([...])` | `mn.setPresets([...])` |
| `mn.getCompiler('class')(tokens)` | `mn.getCompiler('class')(tokens)` (без изменений) |
| `mn.styles$.getValue()` | `mn.styles$.getValue()` ✅ |
| `require('.../presets/styles')` | `import { presetStandard }` |
| `require('.../presets/main')` | `import { presetMain }` |
