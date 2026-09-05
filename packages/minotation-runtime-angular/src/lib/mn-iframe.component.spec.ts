/**
 * Реальный TestBed + реальный Angular-рендерер (`createApplication` +
 * `DOCUMENT`-override) + реальный `minotationProvider` — не моки. Главное,
 * что нужно доказать эмпирически: два `<mn-iframe>` реально ИЗОЛИРОВАНЫ,
 * и destroy() родителя не падает на попытке уничтожить дочерний
 * ApplicationRef, чей iframe уже мог быть удалён из DOM (та же категория
 * бага, что нашлась в minotation-runtime-vue — onUnmounted vs onBeforeUnmount).
 */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MnIframeComponent } from './mn-iframe.component';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

@Component({
  standalone: true,
  template: `<div class="p10 bgF" data-testid="inner">внутри iframe</div>`,
})
class WidgetA {}

@Component({
  standalone: true,
  template: `<div class="c0">B</div>`,
})
class WidgetB {}

@Component({
  standalone: true,
  imports: [MnIframeComponent],
  template: `<mn-iframe [component]="component" [title]="title" />`,
})
class HostComponent {
  component: unknown = WidgetA;
  title = 'widget';
}

describe('MnIframeComponent', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-mn-runtime]').forEach((el) => el.remove());
  });

  it('контент рендерится внутри contentDocument, стили — в contentDocument.head', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    const inner = iframe.contentDocument!.querySelector('[data-testid="inner"]');
    expect(inner?.textContent).toBe('внутри iframe');

    const style = iframe.contentDocument!.querySelector('style[data-mn-runtime]');
    expect(style?.textContent).toContain('.p10{padding:10px}');
    expect(style?.textContent).toContain('.bgF{background:#fff}');
    expect(document.querySelector('style[data-mn-runtime]')).toBeNull();

    fixture.destroy();
    fixture.nativeElement.remove();
  });

  it('destroy() не падает и останавливает рантайм — новые узлы после не компилируются', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    const iframeDoc = iframe.contentDocument!;

    expect(() => {
      fixture.destroy();
    }).not.toThrow();
    fixture.nativeElement.remove();

    const div = iframeDoc.createElement('div');
    div.className = 'crP';
    iframeDoc.body.appendChild(div);
    await flushMicrotasks();

    const css = iframeDoc.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).not.toContain('crP');
  });

  it('два mn-iframe изолированы друг от друга', async () => {
    @Component({
      standalone: true,
      imports: [MnIframeComponent],
      template: `
        <mn-iframe [component]="widgetA" title="widget-1" />
        <mn-iframe [component]="widgetB" title="widget-2" />
      `,
    })
    class DualHost {
      widgetA = WidgetA;
      widgetB = WidgetB;
    }

    const fixture = TestBed.createComponent(DualHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    const [iframe1, iframe2] = Array.from(fixture.nativeElement.querySelectorAll('iframe')) as HTMLIFrameElement[];
    const css1 = iframe1.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';
    const css2 = iframe2.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';

    expect(css1).toContain('.p10{padding:10px}');
    expect(css1).not.toContain('.c0{');
    expect(css2).toContain('.c0{color:#000}');
    expect(css2).not.toContain('.p10{');

    fixture.destroy();
    fixture.nativeElement.remove();
  });
});
