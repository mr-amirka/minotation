/**
 * Медиа-шаблоны прямо в токене (`@600`, `@600x800`, `@600-900`) — разбираются
 * без предварительной регистрации именованного медиа-контекста, а также
 * взаимодействие медиа-селектора с глобальным `selectorPrefix`.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(token: string, options?: any): string {
  const mn: any = minotationProvider(options);
  mn.setPresets([presetStandard]);
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('медиа-шаблоны в токене', () => {
  test('одно число — верхняя граница ширины', () => {
    expect(compile('p10@600')).toContain('@media (max-width: 600px)');
  });

  test('ведущий минус — та же верхняя граница', () => {
    expect(compile('p10@-600')).toContain('@media (max-width: 600px)');
  });

  test('диапазон — нижняя и верхняя границы ширины', () => {
    const css = compile('p10@600-900');
    expect(css).toContain('(min-width: 600px)');
    expect(css).toContain('(max-width: 900px)');
  });

  test('ширина x высота', () => {
    const css = compile('p10@600x800');
    expect(css).toContain('(max-width: 600px)');
    expect(css).toContain('(max-height: 800px)');
  });

  test('только высота', () => {
    expect(compile('p10@x800')).toContain('(max-height: 800px)');
  });

  test('диапазон высоты', () => {
    const css = compile('p10@x600-800');
    expect(css).toContain('(min-height: 600px)');
    expect(css).toContain('(max-height: 800px)');
  });

  test('нераспознанный шаблон остаётся именем медиа как есть', () => {
    expect(compile('p10@x')).toContain('@media x');
  });

  test('ширина и высота — диапазон по обеим осям одновременно (v1 parity)', () => {
    // Полный пример из v1 docs-ru.md «Media-queries generation»:
    // f20@768-992x300-600 → все 4 условия сразу, не только по одной оси.
    const css = compile('p10@768-992x300-600');
    expect(css).toContain('(min-width: 768px)');
    expect(css).toContain('(max-width: 992px)');
    expect(css).toContain('(min-height: 300px)');
    expect(css).toContain('(max-height: 600px)');
    // Все 4 условия — ОДИН @media-блок (через 'and'), не четыре раздельных.
    expect(css).toMatch(/@media \(min-width: 768px\) and \(max-width: 992px\) and \(min-height: 300px\) and \(max-height: 600px\)/);
  });
});

describe('приоритет медиа-шаблона через ^N', () => {
  // REGEXP_MEDIA_PRIORITY (`core/utils.ts`) извлекает `^N` ДО разбора самого
  // шаблона — доступно и для именованных медиа, и для шаблонов диапазона.
  test('^N после диапазона задаёт приоритет явно, шаблон разбирается как обычно', () => {
    const css = compile('p10@768-992x300-600^2');
    expect(css).toContain('(min-width: 768px)');
    expect(css).toContain('(max-width: 992px)');
    expect(css).toContain('(min-height: 300px)');
    expect(css).toContain('(max-height: 600px)');
    // ^N — приоритет, а не часть query: сам @media-блок не содержит "^2"
    // (литерал "^2" остаётся только в эхо экранированного имени класса).
    const mediaBlock = /@media[^{]+/.exec(css)?.[0] ?? '';
    expect(mediaBlock).not.toContain('^2');
  });

  test('без явного ^N приоритет шаблона выводится из max-width (регрессия на самодостаточность)', () => {
    // parseMediaTemplate сам вычисляет приоритет из max-значения, если ^N не задан —
    // здесь просто фиксируем, что это не роняет компиляцию и не требует ^N.
    expect(() => compile('p10@768-992')).not.toThrow();
  });
});

describe('медиа-шаблон + другие части токена (родитель/состояние/группа)', () => {
  test('шаблон + родительский контекст', () => {
    const css = compile('p10@600<.parent');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('.parent ');
  });

  test('шаблон + состояние', () => {
    const css = compile('p10:hover@600');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain(':hover');
  });

  test('шаблон + variant group — оба тела в одном @media-блоке', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('(p10|m5)@600-900');
    mn.compile();
    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain('(min-width: 600px)');
    expect(css).toContain('(max-width: 900px)');
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin:5px');
  });
});

describe('parseMediaExpression', () => {
  test('пустое выражение даёт один пустой контекст', () => {
    const mn: any = minotationProvider();
    expect(mn.parseMediaExpression('')).toEqual([[]]);
  });

  test('именованное выражение возвращает кортеж с query', () => {
    const mn: any = minotationProvider({
      media: {
        sm: {
          query: '(max-width: 600px)', 
        }, 
      }, 
    });
    const parsed = mn.parseMediaExpression('sm');

    expect(parsed[0][0]).toBe('sm');
    expect(parsed[0][2]).toContain('max-width: 600px');
  });
});

describe('selectorPrefix и медиа-селектор', () => {
  test('глобальный префикс комбинируется с селектором медиа-контекста', () => {
    const css = compile('p10@dark', {
      selectorPrefix: '.app',
      media: {
        dark: {
          selector: '.theme-dark', 
        }, 
      },
    });

    expect(css).toContain('.theme-dark');
    expect(css).toContain('.app');
    expect(css).toContain('padding:10px');
  });

  test('глобальный префикс без медиа-контекста', () => {
    expect(compile('p10', {
      selectorPrefix: '.app', 
    })).toContain('.app');
  });
});
