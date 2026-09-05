# minotation-starter-vite-react

Стартовый шаблон: Vite + React + [`minotation`](../core).

## Запуск

```sh
npm install
npm run dev     # dev-сервер с HMR
npm run build   # production-сборка
```

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
