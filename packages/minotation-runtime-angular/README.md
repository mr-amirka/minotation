# minotation-runtime-angular

Angular-адаптер [`minotation-runtime`](../minotation-runtime): директива
жизненного цикла и компонент-виджет с изолированными стилями. Standalone, без
NgModule.

```bash
pnpm add minotation minotation-runtime minotation-runtime-angular
```

## Быстрый старт

```ts
import { Component } from '@angular/core';
import { minotationProvider, presetStandard, presetSynonyms } from 'minotation';
import { MnRuntimeDirective } from 'minotation-runtime-angular';

@Component({
  standalone: true,
  imports: [MnRuntimeDirective],
  template: `
    <div [mnRuntime]="mn">
      <span class="p10 dF gap8">…</span>
    </div>
  `,
})
export class Widget {
  mn = minotationProvider();

  constructor() {
    this.mn.setPresets([presetStandard, presetSynonyms]);
  }
}
```

Директива запускает рантайм в `ngOnInit` и останавливает в `ngOnDestroy`.
Дальше работает DOM-наблюдатель ядра: новые узлы и правки `class` попадают в
CSS сами — включая разметку, пришедшую с сервера или из данных.

## `[mnRuntime]`

| Вход | Что принимает |
|------|---------------|
| `mnRuntime` | инстанс `minotationProvider()` с загруженными пресетами |
| `mnRuntimeOptions` | опции `createMnRuntime` — `attr`, `styleAttr` |

**Корнем наблюдения всегда является хост-элемент директивы**, поэтому `root` из
опций исключён на уровне типа. Это осознанно: директива вешается на элемент, и
наблюдать что-то другое означало бы, что её место в шаблоне ни о чём не
говорит. Нужен весь документ — повесьте её на корневой элемент приложения.

## `<mn-iframe>`

Виджет в `<iframe>` со своим документом, своим mn-инстансом и, значит, своими
стилями — они не пересекаются ни с host-страницей, ни с соседними виджетами.

```ts
@Component({
  standalone: true,
  template: `<div class="p10 bgF r8">Изолированный виджет</div>`,
})
class WidgetContent {}

@Component({
  standalone: true,
  imports: [MnIframeComponent],
  template: `<mn-iframe [component]="widget" title="Превью темы" />`,
})
class Host {
  widget = WidgetContent;
}
```

| Вход | По умолчанию | Что делает |
|------|--------------|------------|
| `component` | — | класс компонента, который рендерится внутри iframe |
| `title` | — (обязателен) | имя iframe для screen reader'ов |
| `presets` | стандартный набор | пресеты для инстанса внутри iframe |
| `attr` | `'class'` | атрибут с токенами внутри iframe |

Внутри поднимается отдельное приложение через `createApplication` с
переопределённым `DOCUMENT` — поэтому передаётся класс компонента, а не
проекция содержимого: контент принадлежит другому документу, и `ng-content`
туда не дотянется. Провайдеры и DI родительского приложения внутрь не
наследуются.

Для чего это: превью темы, песочница нотации, встраиваемый виджет в чужой
вёрстке — везде, где нужен свой каскад без протечек в обе стороны.

## Сборка

Пакет собирается `ng-packagr` (`pnpm build`), тесты — на `TestBed`. Это
полноценная Angular-библиотека, а не набор `.ts`-файлов: иначе потребитель
получал бы её исходники без метаданных компонентов.
