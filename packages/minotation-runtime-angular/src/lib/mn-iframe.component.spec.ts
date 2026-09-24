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
import { presetStandard } from 'minotation';
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

  it('iframe ещё грузится: монтирование откладывается до события load', async () => {
    // В jsdom contentDocument доступен сразу (readyState === 'complete'), поэтому
    // реальный браузерный тайминг «iframe ещё не загружен» воспроизводится
    // подменой геттера: до load документа нет, после — есть. Сам компонент
    // настоящий, монтирование идёт через реальный createApplication.
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const realDoc = iframe.contentDocument!;
    let loaded = false;
    Object.defineProperty(iframe, 'contentDocument', { get: () => (loaded ? realDoc : null) });

    const cmp = new MnIframeComponent();
    cmp.component = WidgetA;
    cmp.title = 'deferred';
    (cmp as unknown as { iframeElRef: { nativeElement: HTMLIFrameElement } }).iframeElRef = { nativeElement: iframe };

    cmp.ngAfterViewInit();
    await flushMicrotasks();
    expect(realDoc.querySelector('[data-testid="inner"]')).toBeNull();

    loaded = true;
    iframe.dispatchEvent(new Event('load'));
    await flushMicrotasks();

    expect(realDoc.querySelector('[data-testid="inner"]')?.textContent).toBe('внутри iframe');
    expect(realDoc.querySelector('style[data-mn-runtime]')?.textContent).toContain('.p10{padding:10px}');

    cmp.ngOnDestroy();
    iframe.remove();
  });

  it('load пришёл, а contentDocument так и нет — монтирования нет, destroy не падает', async () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    Object.defineProperty(iframe, 'contentDocument', { get: () => null });

    const cmp = new MnIframeComponent();
    cmp.component = WidgetA;
    cmp.title = 'never-loads';
    (cmp as unknown as { iframeElRef: { nativeElement: HTMLIFrameElement } }).iframeElRef = { nativeElement: iframe };

    cmp.ngAfterViewInit();
    expect(() => {
      iframe.dispatchEvent(new Event('load'));
    }).not.toThrow();
    await flushMicrotasks();

    // ngOnDestroy при неинициализированных runtime/childApp
    expect(() => {
      cmp.ngOnDestroy();
    }).not.toThrow();
    iframe.remove();
  });

  it('кастомные presets и attr применяются вместо умолчаний', async () => {
    @Component({
      standalone: true,
      template: `<div data-mn="p10 c0">через data-mn</div>`,
    })
    class WidgetAttr {}

    @Component({
      standalone: true,
      imports: [MnIframeComponent],
      template: `<mn-iframe [component]="widget" [presets]="presets" attr="data-mn" title="custom" />`,
    })
    class CustomHost {
      widget = WidgetAttr;
      presets = [presetStandard];
    }

    const fixture = TestBed.createComponent(CustomHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await flushMicrotasks();

    const iframe = fixture.nativeElement.querySelector('iframe') as HTMLIFrameElement;
    const css = iframe.contentDocument!.querySelector('style[data-mn-runtime]')?.textContent || '';
    expect(css).toContain('[data-mn~="p10"]{padding:10px}');
    expect(css).toContain('[data-mn~="c0"]{color:#000}');

    fixture.destroy();
    fixture.nativeElement.remove();
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
