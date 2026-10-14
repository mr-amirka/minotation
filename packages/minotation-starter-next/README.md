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

### Варианты и состояния — без выбора классов в JS

Токены в `className` — только статические строки; вариант — обычный класс на элементе, а
зависящие от него токены уточнены им в записи:

```tsx
<div className={`dF aiC (fx1|o0.5).transition (bg1D2A4D|cF).splash ${variant}`} />   // ✅
<div className={variant === 'splash' ? 'bg1D2A4D cF' : 'fx1 o0.5'} />                 // ❌ токенов не будет в CSS
```

Сканер читает литералы, а не исполняет код: ветви `?:`, `clsx(...)`, склейка имён токенов
не видны — сборка зелёная, стилей нет. Подробно, с примерами (несколько вариантов, состояния
`.active`/`.disabled`, `data-*` и ARIA, состояние родителя, медиа): [core README — «Варианты и
состояния без JS»](../core/README.md#варианты-и-состояния-без-js).

## Как это работает

Токены в `className` (`p24`, `dF`, `bgF.06:h`, ...) компилируются в CSS
на этапе сборки — `minotation-next`'s `withMn()` (см. `next.config.js`)
подключает webpack-лоадер/плагин, итоговый CSS пишется как отдельный
static-asset (`static/mn.css`).

Полный справочник тегов — `core/HANDLERS.md`. Живые интерактивные примеры —
`minotation-docs`/`minotation-playground` в этом монорепо.
