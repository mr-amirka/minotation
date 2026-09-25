/**
 * Формы регистрации эссенций через сам `mn(...)`: строковое имя + хендлер,
 * карта `{ path: … }`, строковое значение (алиас-`exts`), пара
 * `[handler, exts]`, а также реакция на некорректный путь.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeMn(): any {
  const mn: any = minotationProvider();
  mn.setPresets([presetStandard]);
  return mn;
}

function compile(mn: any, ...tokens: string[]): string {
  const c = mn.getCompiler('class');
  for (const t of tokens) {
    c(t);
  }
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('формы регистрации эссенций', () => {
  test('карта «имя → хендлер» регистрирует все разом', () => {
    const mn = makeMn();
    mn({
      redish: () => ({
        style: {
          color: '#f00', 
        }, 
      }),
      blockish: () => ({
        style: {
          display: 'block', 
        }, 
      }),
    });

    const css = compile(
      mn, 'redish', 'blockish',
    );

    expect(css).toContain('color:#f00');
    expect(css).toContain('display:block');
  });

  test('строковое значение работает как алиас на другие токены', () => {
    const mn = makeMn();
    mn('stack', 'p10 mt4');

    const css = compile(mn, 'stack');

    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });

  test('пара [хендлер, шаблон параметров] в карте разбирает суффикс по шаблону', () => {
    const mn = makeMn();
    // второй элемент — паттерн разбора суффикса (как PATTERN_COLOR в пресетах):
    // хендлер получает именованные поля вместо сырой строки
    mn({
      tint: [(p: any) => ({
        style: {
          color: '#' + p.value, 
        }, 
      }), '^(([A-Fa-f0-9]+):value)'], 
    });

    const css = compile(mn, 'tintF00');

    expect(css).toContain('color:#F00');
  });

  test('объектная форма эссенции задаёт стиль без хендлера', () => {
    const mn = makeMn();
    mn('plain', {
      style: {
        color: '#f00', 
      }, 
    });

    expect(compile(mn, 'plain')).toContain('color:#f00');
  });

  test('нестроковое значение эссенции игнорируется, без исключения', () => {
    const mn = makeMn();

    expect(() => mn('numeric', 42 as any)).not.toThrow();

    expect(compile(mn, 'numeric')).toBe('');
  });

  test('нестроковый путь эссенции — предупреждение в консоль, без исключения', () => {
    const mn = makeMn();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let calls: unknown[][];

    try {
      expect(() => mn(123 as any, () => ({
        style: {
          color: '#f00', 
        }, 
      }))).not.toThrow();
    } finally {
      // снимок до mockRestore: он сбрасывает накопленные вызовы
      calls = warnSpy.mock.calls.slice();
      warnSpy.mockRestore();
    }

    expect(String(calls[0]?.[0])).toContain('essencePath value must be an string');
  });
});

describe('обход DOM — обе формы аргумента attrs', () => {
  /** Структурная заглушка DOM-узла: компилятору нужны только эти два свойства. */
  function node(attrs: Record<string, string>, children: any[] = []): any {
    return {
      nodeType: 1,
      getAttribute: (name: string) => attrs[name] ?? null,
      childNodes: children, 
    };
  }

  test('recursiveCheckByAttrs принимает список атрибутов', () => {
    const mn = makeMn();
    mn.recursiveCheckByAttrs(node({
      class: 'p10', 
    }, [node({
      id: 'mt4', 
    })]), ['class', 'id']);
    mn.compile();

    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });

  test('checkOneNodeByAttrs принимает одиночное имя атрибута', () => {
    const mn = makeMn();
    mn.checkOneNodeByAttrs(node({
      class: 'p10', 
    }), 'class');
    mn.compile();

    expect(mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n')).toContain('padding:10px');
  });
});
