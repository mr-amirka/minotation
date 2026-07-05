# minotation

Minimalist Notation — компактная нотация для генерации CSS.
Наследник [minimalist-notation](https://github.com/mr-amirka/minimalist-notation) (1.x).

```bash
npm install minotation
```

## Быстрый старт

```ts
import { createMn, presetStandard, presetSynonyms, presetMedias } from 'minotation';

const mn = createMn();
mn.setPresets([presetStandard, presetSynonyms, presetMedias]);

// Скармливаем токены
mn.check('p10 cF00 fx bgFFF fwBold:h');

// Компилируем
mn.compile();

// Получаем CSS
for (const block of mn.styles$.getValue()) {
  console.log(block.content);
}
// → .p10{padding:10px}.cF00{color:#F00}.fx{display:flex}...
```

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

## API

### `createMn(options?)`

Создаёт экземпляр MN.

```ts
const mn = createMn({
  selectorPrefix: '#app',          // префикс для селекторов
  media: { m: { query: '(max-width: 767px)' } },
  prefixedAttrs: { transform: 1 }, // авто-вендорные префиксы
  prefixes: { '-webkit-': 1, '-moz-': 1 },
});
```

### `mn.setPresets(presets)`

Загружает пресеты (наборы обработчиков).

```ts
mn.setPresets([presetStandard, presetSynonyms]);
```

### `mn.check(tokens)`

Принимает строку токенов (обычно значение `class`).

```ts
mn.check('p10 cF00 fx:h');
```

### `mn.compile()`

Компилирует все накопленные токены в CSS.

### `mn.styles$.getValue()`

Возвращает массив `StyleBlock[]` — скомпилированные CSS-блоки.

### `mn.register(tag, handler)`

Регистрирует обработчик стиля.

```ts
mn.register('cool', (c) => ({
  style: { color: '#' + c.arg },
}));
// coolF00 → color:#F00
```

### `mn.css(selector, rules)`

Регистрирует сырые CSS-правила.

```ts
mn.css('html', { margin: '0', padding: '0' });
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

## Интеграции

| Пакет | Статус |
|-------|--------|
| `minotation-vite` | Vite-плагин (прототип) |
| `minotation-webpack` | Webpack loader + plugin (прототип) |
| `minotation-next` | Next.js `withMn()` (прототип, webpack-only) |

## Миграция с 1.x

| 1.x (`minimalist-notation`) | v2 (`minotation`) |
|---|---|
| `mnProvider()` | `createMn()` |
| `mn('tag', handler, ...)` | `mn.register('tag', handler)` |
| `mn.presets([...])` | `mn.setPresets([...])` |
| `mn.getCompiler('class')(tokens)` | `mn.check(tokens)` |
| `mn.styles$.getValue()` | `mn.styles$.getValue()` ✅ |
| `require('.../presets/styles')` | `import { presetStandard }` |
| `require('.../presets/main')` | `import { presetMain }` |
