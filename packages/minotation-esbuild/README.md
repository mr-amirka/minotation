# minotation-esbuild

esbuild-плагин для [minotation](../core) — сборка CSS из MN-токенов при билде.

```bash
npm install minotation-esbuild
```

## Быстрый старт

```js
// build.js
const esbuild = require('esbuild');
const { mnEsbuild } = require('minotation-esbuild');

esbuild.build({
  entryPoints: ['src/main.tsx'],
  outdir: 'dist',
  bundle: true,
  plugins: [
    mnEsbuild({ attr: 'className' }),
  ],
});
```

Плагин сканирует `root` (по умолчанию `process.cwd()`) на старте сборки
(`onStart`), извлекает MN-токены из указанных атрибутов и пишет `mn.css`
рядом с `outdir`/`outfile` по завершении (`onEnd`).

**Важно:** в отличие от Rollup/Vite, esbuild не умеет декларативно
"эмитировать asset" — плагин пишет CSS-файл на диск напрямую через `fs`.
`onLoad` не подменяет контент файлов (возвращает `undefined`) — только
наблюдает за реально загружаемыми esbuild'ом модулями, докидывая их токены
поверх blanket-скана `onStart` (защита от пропуска токенов из модулей,
не попавших в текущий конкретный бандл при нескольких точках входа —
как и у `minotation-vite`/`minotation-rollup`).

## Динамические пресеты

Как и в `minotation-vite`/`minotation-rollup` — файлы `*.mn.ts`/`*.mn.js`
сканируются на старте сборки, выполняются на внутреннем mn-инстансе.
В отличие от Rollup/Vite, esbuild не даёт перехватить `import`-подключение
пресет-файла из кода приложения (`load`-хука с заменой контента здесь нет) —
пресеты только статические (через опцию `presets`) или найденные сканером.

## Опции

| Опция | Тип | По умолчанию | Описание |
|-------|-----|-------------|----------|
| `attr` | `string` | `'class'` | Атрибут, в котором ищутся MN-токены |
| `extensions` | `string[]` | `['.html','.jsx','.tsx','.vue','.svelte']` | Расширения файлов приложения |
| `presets` | `Array<(mn) => void>` | стандартный набор | Статические пресеты |
| `presetExtensions` | `string[]` | `['.mn.ts','.mn.js','.mn.tsx']` | Расширения динамических пресет-файлов |
| `fileName` | `string` | `'mn.css'` | Имя выходного CSS-файла |
| `root` | `string` | `process.cwd()` | Корень для сканирования файлов |
| `mn` | `object` | — | Опции mn-инстанса: `selectorPrefix`, `media` |
