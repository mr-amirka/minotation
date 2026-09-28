# minotation-runtime-react

React-адаптер [`minotation-runtime`](../minotation-runtime): хук жизненного
цикла и виджет с изолированными стилями.

```bash
pnpm add minotation minotation-runtime minotation-runtime-react
```

## Быстрый старт

```tsx
import { minotationProvider, presetStandard, presetSynonyms } from 'minotation';
import { useMnRuntime } from 'minotation-runtime-react';

// Инстанс создаётся ОДИН раз, вне компонента: рантайм перезапускается при
// смене идентичности `mn`, и новый объект на каждый рендер сбрасывал бы его.
const mn = minotationProvider();
mn.setPresets([presetStandard, presetSynonyms]);

function App() {
  useMnRuntime(mn);
  return <div className="p10 dF gap8">…</div>;
}
```

Хук запускает рантайм на монтировании и останавливает на размонтировании.
Дальше всё делает DOM-наблюдатель ядра: новые узлы и правки `className`
попадают в CSS сами.

## `useMnRuntime(mn, options?)`

Принимает всё, что `createMnRuntime` (`attr`, `root`, `styleAttr`), плюс:

| Опция | Что делает |
|-------|------------|
| `rootRef` | ref на контейнер вместо `root` — резолвится внутри эффекта, когда `ref.current` уже привязан |

```tsx
function Widget() {
  const ref = useRef<HTMLDivElement>(null);
  useMnRuntime(mn, { rootRef: ref });
  return <div ref={ref} className="p10">…</div>;
}
```

`rootRef` нужен, чтобы ограничить наблюдение поддеревом: виджет на чужой
странице не должен компилировать классы всего документа.

**Перезапуск.** Эффект зависит только от `mn`. Изменения `options` между
рендерами рантайм не перезапускают — передавайте стабильную ссылку, если
реакция на смену опций нужна.

**SSR.** На сервере хук ничего не делает: рантайму нужен настоящий `document`.

## `<MnIframe>`

Виджет в `<iframe>` со своим документом, своим mn-инстансом и, значит, своими
стилями — они не пересекаются ни с host-страницей, ни с соседними виджетами.

```tsx
<MnIframe title="Превью темы">
  <div className="p10 bgF r8">Изолированный виджет</div>
</MnIframe>
```

| Проп | По умолчанию | Что делает |
|------|--------------|------------|
| `title` | — (обязателен) | имя iframe для screen reader'ов |
| `presets` | стандартный набор | пресеты для инстанса внутри iframe |
| `attr` | `'class'` | атрибут с токенами внутри iframe |
| `className`, `style` | — | оформление самого элемента `<iframe>` |

Дети рендерятся в `contentDocument.body` через `createPortal`, то есть остаются
частью дерева React: контекст, состояние и обработчики работают как обычно.

Для чего это: превью темы, песочница нотации, встраиваемый виджет в чужой
вёрстке — везде, где нужен свой каскад без протечек в обе стороны.
