# minotation-starter-vite-react

Стартовый шаблон: Vite + React + [`minotation`](../core).

## Запуск

```sh
npm install
npm run dev     # dev-сервер с HMR
npm run build   # production-сборка
```

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

Токены в `className` (`p24`, `dF`, `bgF.06:h`, ...) компилируются в CSS на
этапе сборки плагином `minotation-vite` (см. `vite.config.ts`) — реальный
CSS-файл, не runtime-инъекция. В dev-режиме HMR обновляет стили без
перезагрузки страницы при изменении токенов.

Полный справочник тегов — `core/HANDLERS.md`. Живые интерактивные примеры —
`minotation-docs`/`minotation-playground` в этом монорепо.

## Динамические пресеты

Дополнительные хендлеры/keyframes можно подключить как обычный side-effect
импорт, без правки конфига сборщика:

```tsx
// src/main.tsx
import './mn/app.mn';
```

```ts
// src/mn/app.mn.ts
import type { MnInstance } from 'minotation';

export default (mn: MnInstance) => {
  mn('card', () => ({ style: { borderRadius: '8px' } }));
};
```
