# minotation-starter-next

Стартовый шаблон: Next.js + [`minotation-next`](../minotation-next).

## Запуск

```sh
npm install
npm run dev     # dev-сервер
npm run build   # production-сборка
```

**Важно:** `minotation-next` работает только с webpack-бандлером Next.js —
по умолчанию (без флагов) `next dev`/`next build` уже используют webpack,
просто не добавляйте `--turbopack`.

## Как это работает

Токены в `className` (`p24`, `dF`, `bgF.06:h`, ...) компилируются в CSS
на этапе сборки — `minotation-next`'s `withMn()` (см. `next.config.js`)
подключает webpack-лоадер/плагин, итоговый CSS пишется как отдельный
static-asset (`static/mn.css`).

Полный справочник тегов — `core/HANDLERS.md`. Живые интерактивные примеры —
`minotation-docs`/`minotation-playground` в этом монорепо.
