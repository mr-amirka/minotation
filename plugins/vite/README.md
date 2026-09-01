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
      attr: 'className',           // атрибут для поиска токенов
      extensions: ['.tsx', '.jsx'],
      presets: [presetStandard, presetSynonyms, presetMedias],
    }),
  ],
});
```

Плагин автоматически сканирует `src/`, извлекает MN-токены из указанных атрибутов и генерирует CSS.

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

| Опция | Тип | По умолчанию | Описание |
|-------|-----|-------------|----------|
| `attr` | `string` | `'class'` | Атрибут, в котором ищутся MN-токены |
| `extensions` | `string[]` | `['.html','.jsx','.tsx','.vue','.svelte']` | Расширения файлов приложения |
| `presets` | `Array<(mn) => void>` | стандартный набор | Статические пресеты |
| `presetExtensions` | `string[]` | `['.mn.ts','.mn.js','.mn.tsx']` | Расширения динамических пресет-файлов |
| `mn` | `object` | — | Опции mn-инстанса: `selectorPrefix`, `media` |
