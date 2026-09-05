/**
 * Реальный TestBed + реальный Angular-рендерер + реальный
 * `minotationProvider` — не моки.
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { minotationProvider, presetStandard } from 'minotation';
import { MnRuntimeDirective } from './mn-runtime.directive';

function makeMn() {
  const mn = minotationProvider();
  mn.setPresets([presetStandard]);
  return mn;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

@Component({
  standalone: true,
  imports: [MnRuntimeDirective],
  template: `<div [mnRuntime]="mn"><span class="p10 dF"></span></div>`,
})
class HostComponent {
  mn = makeMn();
}

describe('MnRuntimeDirective', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-mn-runtime]').forEach((el) => el.remove());
  });

  it('компилирует токены внутри хост-элемента директивы', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    const style = document.querySelector('style[data-mn-runtime]');
    expect(style?.textContent).toContain('.p10{padding:10px}');
    expect(style?.textContent).toContain('.dF{display:flex}');

    fixture.destroy();
    fixture.nativeElement.remove();
  });

  it('останавливает рантайм при destroy — новые узлы после уже не компилируются', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    fixture.destroy();
    fixture.nativeElement.remove();

    const div = document.createElement('div');
    div.className = 'bgF';
    document.body.appendChild(div);
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).not.toContain('bgF');
    div.remove();
  });

  it('mnRuntimeOptions.attr скоупит извлечение на кастомный атрибут', async () => {
    @Component({
      standalone: true,
      imports: [MnRuntimeDirective],
      template: `<div [mnRuntime]="mn" [mnRuntimeOptions]="{ attr: 'data-mn' }"><span data-mn="crP"></span></div>`,
    })
    class CustomAttrHost {
      mn = makeMn();
    }

    const fixture = TestBed.createComponent(CustomAttrHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    const css = document.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('[data-mn~="crP"]{cursor:pointer}');

    fixture.destroy();
    fixture.nativeElement.remove();
  });
});
