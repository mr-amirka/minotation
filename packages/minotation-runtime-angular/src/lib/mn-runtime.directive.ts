/**
 * Angular-адаптер `minotation-runtime`: тонкая обвязка жизненного цикла
 * (`ngOnInit`/`ngOnDestroy`) поверх фреймворк-агностичного DOM-рантайма —
 * структурно зеркалит `minotation-runtime-react`'s `useMnRuntime` и
 * `minotation-runtime-vue`'s composable, только через Angular-директиву
 * вместо хука/composable (у Angular нет собственной концепции "хука" —
 * директива, применяемая на элемент, ближайший идиоматичный аналог:
 * жизненный цикл директивы уже привязан к её хост-элементу, что совпадает
 * со scoping-семантикой `root` в {@link createMnRuntime}).
 *
 * Как и в React/Vue-адаптерах: сам DOM-рантайм (`MutationObserver`) не знает
 * и не обязан знать, что именно отрендерило DOM — этому пакету нечего чинить
 * под конкретный Angular-рендер-путь.
 *
 * @module MnRuntimeDirective
 */
import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';
import {
  createMnRuntime,
  MnRuntimeHandle,
  MnRuntimeInstance,
  MnRuntimeOptions,
} from 'minotation-runtime';

/**
 * @example
 * ```ts
 * @Component({
 *   standalone: true,
 *   imports: [MnRuntimeDirective],
 *   template: `<div [mnRuntime]="mn"><span class="p10 dF">...</span></div>`,
 * })
 * class Widget {
 *   mn = minotationProvider();
 *   constructor() { this.mn.setPresets([presetStandard]); }
 * }
 * ```
 */
@Directive({
  selector: '[mnRuntime]',
  standalone: true,
})
export class MnRuntimeDirective implements OnInit, OnDestroy {
  /** Инстанс `minotationProvider()` с уже загруженными пресетами. */
  @Input('mnRuntime') mn!: MnRuntimeInstance;
  /** Опции {@link createMnRuntime} — `root` игнорируется, всегда хост-элемент директивы. */
  @Input() mnRuntimeOptions?: Omit<MnRuntimeOptions, 'root'>;

  private runtime?: MnRuntimeHandle;

  constructor(private readonly elementRef: ElementRef<Element>) {}

  ngOnInit(): void {
    this.runtime = createMnRuntime(this.mn, {
      ...this.mnRuntimeOptions,
      root: this.elementRef.nativeElement,
    });
  }

  ngOnDestroy(): void {
    this.runtime?.stop();
  }
}
