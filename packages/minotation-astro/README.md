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
  integrations: [mnAstro({ attr: 'class' })],
});
```

По умолчанию сканируются `.html`, `.jsx`, `.tsx`, `.vue`, `.svelte` **и `.astro`**
(в отличие от `minotation-vite`, где `.astro` не в списке по умолчанию — Astro-проекты
не единственный потребитель `minotation-vite`).

## Опции

Совпадают с [`minotation-vite`](../minotation-vite#опции) — `mnAstro(options)`
принимает те же поля (`attr`, `extensions`, `presets`, `presetExtensions`, `mn`)
и передаёт их напрямую в `mnVite(...)`, только дополняя `extensions` по умолчанию `.astro`.
