/**
 * `mn.assign` — статическая привязка MN-токенов к произвольному CSS-селектору
 * (без атрибутов в разметке). Привязки живут в `$$statics` и переживают
 * `clear`/`recompile`, в отличие от обычных значений атрибутов.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import {
  mediaFilterIteratee, 
} from '../selectorsCompileProvider';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeMn(options?: any) {
  const mn: any = minotationProvider(options);
  mn.setPresets([presetStandard]);
  return mn;
}

function cssOf(mn: any): string {
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('mn.assign', () => {
  test('привязывает токены к селектору', () => {
    const mn = makeMn();
    mn.assign('.btn', 'p10 mt4');
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
    expect(css).toContain('.btn');
  });

  test('объектная форма задаёт несколько селекторов разом', () => {
    const mn = makeMn();
    mn.assign({
      '.card': 'p10',
      '.title': 'mt4', 
    });
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('.card');
    expect(css).toContain('.title');
  });

  test('привязки переживают полный пересчёт', () => {
    const mn = makeMn();
    mn.assign('.btn', 'p10');
    mn.compile();
    expect(cssOf(mn)).toContain('padding:10px');

    mn.recompile();

    expect(cssOf(mn)).toContain('padding:10px');
    expect(cssOf(mn)).toContain('.btn');
  });

  test('медиа-контекст по умолчанию применяется ко всей привязке', () => {
    const mn = makeMn({
      media: {
        sm: {
          query: '(max-width: 600px)',
          priority: 0, 
        }, 
      }, 
    });
    mn.assign(
      '.btn', 'p10', 'sm',
    );
    mn.compile();

    expect(cssOf(mn)).toContain('@media (max-width: 600px)');
  });
});

describe('mediaFilterIteratee', () => {
  test('реэкспортируется из barrel и фильтрует записи медиа', () => {
    expect(typeof mediaFilterIteratee).toBe('function');
  });
});
