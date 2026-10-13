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
| `presetMedias` | Точки по ширине `m…`/`d…` (`@m4` — до 480px, `@d-` — от 992px, `@m4-d` — между), `mouse`, `dark` (D-054) |
| `presetNormalize` | Лёгкий сброс (box-sizing, margin, img) |
| `presetMain` | Полный CSS-сброс (аналог normalize.css) |
| `presetHints` | Подсказки вместо молчания: `t0` → «did you mean `st0`?», `flex` → «в minotation это `dF`», `text-center` → `taC`. Подключать первым — пресет ниже перекрывает его хендлеры. Точечно — фабрикой: `presetHints({ excludeGroups: ['bootstrap'], excludeHandlers: ['flex'] })`; группы — `typos`, `tailwind`, `bootstrap` (D-024, D-042) |
| `presetPrefixes` | Опциональные `-webkit-`/`-moz-` дубли для заданного списка свойств (`transform`, `flexDirection`, `appearance`, …) |

### Режим синтаксиса `notationMode` (D-045, D-046)

`'context-qualified'` (по умолчанию) — запись minotation: `cF00:h@md<.group`.
`'tailwind-compatible'` — варианты перед классом, как в Tailwind: `md:hover:group-hover:cF00`.

```ts
const mn = minotationProvider({ notationMode: 'tailwind-compatible' });
mn.synonyms({ hover: ':hover', invalid: ':invalid' });   // приставки — синонимы и имена mn.media
mn.variantPrefixedSynonyms({ group: '.group', peer: '.peer~' });  // метки: предок и сосед
```

| Класс | CSS |
|---|---|
| `hover:cF00` | `.hover\:cF00:hover{color:#f00}` |
| `md:cF00` | `@media (min-width: 768px){.md\:cF00{…}}` |
| `group-hover:cF00` | `.group:hover .group-hover\:cF00{…}` — `{метка}-{синоним\|медиа}`: метка из `variantPrefixedSynonyms` |
| `group-hover/item:cF00` | `.group\/item:hover .group-hover\/item\:cF00{…}` — именованная метка (класс `group/item`) |
| `peer-invalid:cF00` | `.peer:invalid~.peer-invalid\:cF00{…}` — сосед через `variantPrefixedSynonyms` |
| `!p10` | `.\!p10{padding:10px!important}` |

`'breakpoint-prefixed'` — брейкпоинт перед классом, как в quantum-css: `SM_px15` →
`@media sm {.SM_px15{…}}`. Брейкпоинт — заглавными с `_`, ищется в `mn.media` как записан,
затем строчными; неизвестный — предупреждение.

`'property-value'` — запись Master CSS: `свойство:значение`, затем в любом порядке `!`,
состояния, селекторы и в конце медиа. Имя свойства — хендлер (ядро получает пару «имя,
значение», без разбора регуляркой); режим работает с любыми хендлерами — стандартными или
клона (D-051).

| Класс | CSS |
|---|---|
| `p:10` | `.p\:10{padding:10px}` |
| `c:F00:hover@md` | `@media (min-width: 1024px){.c\:F00\:hover\@md:hover{color:#f00}}` |
| `p:10>li:hover` / `p:10_h1` | `…>li:hover{…}` / `… h1{…}` — ребёнок / потомок |
| `c:F00:checked+span` / `p:10~div` | соседи |
| `p:10[open]` / `c:F00.active` | атрибут / класс самого элемента |
| `c:F00:first` / `:nth(2)` / `:after` | `:first-child` / `:nth-child(2)` / `::after` |
| `p:10!` | `!important` |
| `{p:10;m:5}>li:hover@md` | группа объявлений с общим контекстом |
| `p:10@<md` / `@>=768` / `@768&<1024` | `(max-width: 1023.98px)` / `(min-width: 768px)` / диапазон |
| `p:10@dark` / `@print` / `@landscape` / `@media(any-hover:hover)` | слова медиа и произвольный запрос |

Сравнение с именем (`@<md`) берёт ширину из запроса брейкпоинта (`(min-width: 1024px)`).

В режимах, кроме `'context-qualified'`, действует только грамматика оригинала: конструкции
minotation (`<`, `>`, `@`, `:`, группы) не применяются (D-049).

Имя есть и среди синонимов, и среди медиа — берётся синоним. Метки — только
зарегистрированные, как в Tailwind (`group`, `peer`); `grop-hover:` или своё имя — неизвестная
приставка: предупреждение, CSS нет (своя метка пишется нотацией minotation: `cF00<.vasya:h`). Строки пресета (`assign`, `exts`) разбираются в режиме пресета
(`notationMode` пресет-объекта, по умолчанию `'context-qualified'`), классы разметки — в
режиме проекта.

### Пресет-объект и зависимости (D-045)

Пресет — функция `(mn) => {…}` или объект с метаданными. Зависимости можно перечислять в
`setPresets` в любом порядке: ядро подключит их раньше зависящего.

```ts
const presetApp = {
  name: 'presetApp',
  requires: ['presetStandard', 'presetMedias'],
  setup(mn) {
    mn.assign({ '.card': 'p16 bgF r8 sh2@md' });
  },
};

mn.setPresets([presetApp, presetMedias, presetStandard]);   // порядок — любой
mn.setPresets([presetApp]);
// Error: [minotation] presetApp requires "presetStandard", which is not connected. Connected presets: presetApp
```

Стандартные пресеты — объекты с именами; `presetNormalize` требует `presetStandard`,
`presetMain` — `presetStandard` и `presetMedias`. `presetHints({ … })` возвращает объект
с именем `presetHints`.

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
  maxDepthMode: 'warn',            // 'warn' | 'silent' | 'strict' — что делать при превышении
  specificityMode: 'warn',         // 'warn' | 'silent' | 'strict' — токены f10*2 (накрутка специфичности)
  importantMode: 'warn',           // 'warn' | 'silent' | 'strict' — токены f10-i (!important)
  childSelectorMode: 'warn',       // 'warn' | 'silent' | 'strict' — токены cF00>1 (дочерний селектор)
  notationMode: 'context-qualified', // или 'tailwind-compatible' — запись как в Tailwind: md:hover:p10
  contextWhere: false,             // true — контекст в :where(): .p10…:is(:where(.card:hover) *)
});
```

Вендорные префиксы подключаются пресетом `presetPrefixes`.

Опции проверяются при создании и в `mn.setOptions` (D-038): неизвестный ключ и
значение не того типа — ошибка с подсказкой.

```ts
minotationProvider({ altColor: 'off' });
// Error: [minotation] minotationProvider: option "altColor" expects a boolean, got string "off"

minotationProvider({ selectorPrefx: '#app ' });
// Error: [minotation] minotationProvider: unknown option "selectorPrefx". Did you mean "selectorPrefix"?
```

Тот же проверяльщик экспортируется для своих точек входа: `checkOptions(options,
schema, 'myPlugin')` и проверки `isBoolean`, `isString`, `isStringArray`,
`oneOf(...)`, `optionsOf(schema)` и др.

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
