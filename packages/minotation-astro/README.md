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
mnAstro({ attr: 'class', classVarSuffixes: ['Class', 'Cls'], safelist: ['crP taL vaT'] })
```

## Опции

Совпадают с [`minotation-vite`](../minotation-vite#опции) — `mnAstro(options)`
принимает те же поля (`attr`, `extensions`, `presets`, `presetExtensions`, `safelist`, `classVarSuffixes`, `mn`)
и передаёт их напрямую в `mnVite(...)`, только дополняя `extensions` по умолчанию `.astro`.
