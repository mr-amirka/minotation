/**
 * Angular-компонент для монтирования контента внутри `<iframe>` с ПОЛНОСТЬЮ
 * изолированными стилями — Angular-аналог `minotation-runtime-react`'s
 * `<MnIframe>` и `minotation-runtime-vue`'s `<MnIframe>` (см. их module doc
 * для полного обоснования изоляции vs. старый 1.x `browser/
 * reactFrameProvider.js`, который шарил один `mn.styles$` на все iframe сразу).
 *
 * ## Отличие от React/Vue-версий: `component: Type`, не children/slot
 *
 * У Angular нет способа спроецировать произвольный шаблон в СОВСЕМ ДРУГОЙ
 * `ApplicationRef` (в отличие от React's `createPortal` или даже Vue's
 * отдельного `createApp()`, которому можно передать функцию рендера слота) —
 * `ApplicationRef.bootstrap()` принимает только КЛАСС компонента, не
 * шаблон/слот. Поэтому здесь контент задаётся через `[component]` — Angular
 * class, который будет забутстрапан как корень отдельного `ApplicationRef`
 * внутри iframe. Если контенту нужны данные — передавайте через DI
 * (Angular-провайдеры), не через props/inputs (`ApplicationRef.bootstrap`
 * их не поддерживает).
 *
 * Проверено эмпирически (реальный TestBed): `createApplication({ providers:
 * [{ provide: DOCUMENT, useValue: iframeDoc }] })` + `app.bootstrap(Component,
 * rootEl)` корректно создаёт узлы через документ `rootEl` — `ownerDocument
 * === iframeDoc`, не глобальный `document`.
 *
 * @module MnIframeComponent
 */
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  type ApplicationRef,
  type Type,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import {
  minotationProvider,
} from 'minotation';
import type { MnInstance } from 'minotation';
import type { MnPreset } from 'minotation';
import { createMnRuntime, type MnRuntimeHandle } from 'minotation-runtime';

/** Сообщение о забытом `presets`: набора по умолчанию нет (D-110). */
const MSG_PRESETS_REQUIRED = '[minotation] mn-iframe: "presets" is required — no preset is connected by default'
  + ' (D-110). List them: [presets]="[presetStandard, presetSynonyms, presetMedias]"';

/**
 * @example
 * ```ts
 * @Component({ standalone: true, template: `<div class="p10 bgF r8">Изолированный виджет</div>` })
 * class WidgetContent {}
 *
 * @Component({
 *   standalone: true,
 *   imports: [MnIframeComponent],
 *   template: `<mn-iframe [component]="widget" [presets]="presets" title="Виджет 1" />`,
 * })
 * class Host {
 *   widget = WidgetContent;
 *   presets = [presetStandard];
 * }
 * ```
 */
@Component({
  selector: 'mn-iframe',
  standalone: true,
  template: `<iframe #iframeEl [attr.title]="title"></iframe>`,
})
export class MnIframeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('iframeEl', { static: true }) private readonly iframeElRef!: ElementRef<HTMLIFrameElement>;

  /** Класс компонента, монтируемый как корень ОТДЕЛЬНОГО `ApplicationRef` внутри iframe. */
  @Input({ required: true }) component!: Type<unknown>;
  /** Пресеты инстанса iframe — обязательно (D-110): набора по умолчанию нет, `[]` — явный пустой набор. */
  @Input({ required: true }) presets!: MnPreset[];
  /** Атрибут `class` внутри iframe. @default 'class' */
  @Input() attr?: string;
  /** Обязателен для доступности — у `<iframe>` без `title` нет осмысленного имени для screen reader'ов. */
  @Input({ required: true }) title!: string;

  private childApp?: ApplicationRef;
  private runtime?: MnRuntimeHandle;

  ngAfterViewInit(): void {
    // `required` проверяет только шаблон; компонент, созданный кодом, без набора — ошибка, а не пустой CSS.
    if (!this.presets) throw new Error(MSG_PRESETS_REQUIRED);
    const iframe = this.iframeElRef.nativeElement;
    const handleLoad = (): void => {
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc) void this.mountChild(iframeDoc);
    };
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad();
    } else {
      iframe.addEventListener('load', handleLoad, { once: true });
    }
  }

  private async mountChild(iframeDoc: Document): Promise<void> {
    const rootEl = iframeDoc.createElement('div');
    iframeDoc.body.appendChild(rootEl);

    this.childApp = await createApplication({
      providers: [{ provide: DOCUMENT, useValue: iframeDoc }],
    });
    this.childApp.bootstrap(this.component, rootEl);

    const mn = minotationProvider();
    mn.setPresets(this.presets);
    this.runtime = createMnRuntime(mn, { root: iframeDoc, attr: this.attr });
  }

  ngOnDestroy(): void {
    this.runtime?.stop();
    this.childApp?.destroy();
  }
}
