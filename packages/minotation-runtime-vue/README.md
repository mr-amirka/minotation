# minotation-runtime-vue

Vue-адаптер [`minotation-runtime`](../minotation-runtime): composable
жизненного цикла и виджет с изолированными стилями. Vue 3, Composition API.

```bash
pnpm add minotation minotation-runtime minotation-runtime-vue
```

## Быстрый старт

```vue
<script setup lang="ts">
import { minotationProvider, presetStandard, presetSynonyms } from 'minotation';
import { useMnRuntime } from 'minotation-runtime-vue';

// Инстанс один на приложение: обычно его создают в отдельном модуле и
// импортируют, а не собирают заново в каждом компоненте.
const mn = minotationProvider();
mn.setPresets([presetStandard, presetSynonyms]);

useMnRuntime(mn);
</script>

<template>
  <div class="p10 dF gap8">…</div>
</template>
```

Composable запускает рантайм в `onMounted` и останавливает в `onUnmounted`.
Дальше работает DOM-наблюдатель ядра: новые узлы и правки `class` попадают в
CSS сами — включая разметку, пришедшую с сервера или из данных.

## `useMnRuntime(mn, options?)`

Принимает всё, что `createMnRuntime` (`attr`, `root`, `styleAttr`), плюс:

| Опция | Что делает |
|-------|------------|
| `rootRef` | template ref на контейнер вместо `root` — резолвится внутри `onMounted`, когда ref уже привязан к узлу |

```vue
<script setup lang="ts">
const widget = ref<HTMLElement | null>(null);
useMnRuntime(mn, { rootRef: widget });
</script>

<template>
  <div ref="widget" class="p10">…</div>
</template>
```

`rootRef` ограничивает наблюдение поддеревом: виджет на чужой странице не
должен компилировать классы всего документа.

**Опции читаются один раз**, на момент монтирования. Нужно поменять их на
лету — пересоздайте компонент (`:key`).

**SSR.** На сервере composable ничего не делает: рантайму нужен настоящий
`document`.

## `<MnIframe>`

Виджет в `<iframe>` со своим документом, своим mn-инстансом и, значит, своими
стилями — они не пересекаются ни с host-страницей, ни с соседними виджетами.

```vue
<MnIframe title="Превью темы">
  <div class="p10 bgF r8">Изолированный виджет</div>
</MnIframe>
```

| Проп | По умолчанию | Что делает |
|------|--------------|------------|
| `title` | — (обязателен) | имя iframe для screen reader'ов |
| `presets` | стандартный набор | пресеты для инстанса внутри iframe |
| `attr` | `'class'` | атрибут с токенами внутри iframe |

Содержимое монтируется отдельным `createApp()`-инстансом прямо в
`contentDocument.body` — это не портал: у Vue портал (`<Teleport>`) остаётся в
том же приложении и том же документе, а здесь нужен именно свой документ.
Отсюда следствие: provide/inject и глобальные плагины родительского приложения
внутрь не передаются.

Для чего это: превью темы, песочница нотации, встраиваемый виджет в чужой
вёрстке — везде, где нужен свой каскад без протечек в обе стороны.
