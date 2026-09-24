/**
 * Нормализация значений и слияние эссенций: экранированное подчёркивание,
 * распространение важности на примеси, вложенные формы аргументов `mn.assign`
 * и слияние `exts`/`childs` при повторном объявлении эссенции.
 */
import {
  minotationProvider, 
} from '../core/index';
import {
  spaceNormalize, 
} from '../core/utils';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function cssOf(mn: any): string {
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

function compile(mn: any, ...tokens: string[]): string {
  const c = mn.getCompiler('class');
  for (const t of tokens) {
    c(t);
  }
  mn.compile();
  return cssOf(mn);
}

describe('spaceNormalize', () => {
  test('подчёркивания становятся пробелами', () => {
    expect(spaceNormalize('10px_solid_red')).toBe('10px solid red');
  });

  test('экранированное подчёркивание остаётся подчёркиванием', () => {
    expect(spaceNormalize('a\\_b')).toBe('a_b');
  });

  test('смешанный случай: экранированные и обычные подчёркивания рядом', () => {
    expect(spaceNormalize('snake\\_case_and_spaces')).toBe('snake_case and spaces');
  });
});

describe('нормализация значений в токенах', () => {
  test('подчёркивание в значении content превращается в пробел', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);

    expect(compile(mn, 'cnt_two_words')).toContain('content:two words');
  });
});

describe('важность и примеси', () => {
  test('-i распространяется на примеси include', () => {
    const mn: any = minotationProvider();
    mn('typo', () => ({
      style: {
        fontSize: '14px', 
      }, 
    }));
    mn('card', () => ({
      style: {
        padding: '8px', 
      },
      include: 'typo', 
    }));

    const css = compile(mn, 'card-i');

    expect(css).toContain('padding:8px!important');
    expect(css).toContain('font-size:14px!important');
  });
});

describe('mn.assign — вложенные формы аргументов', () => {
  test('списки селекторов и токенов', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);
    mn.assign(['.a', '.b'], ['p10', 'mt4']);
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('.a');
    expect(css).toContain('.b');
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });

  test('карты вместо списков', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);
    mn.assign({
      '.c': {
        p10: 1,
        mt4: 1, 
      }, 
    });
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('.c');
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });
});

describe('слияние эссенций', () => {
  test('повторное объявление имени сливает exts и childs', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);
    mn('widget', () => ({
      style: {
        color: 'red', 
      },
      childs: {
        ' span': {
          style: {
            display: 'block', 
          }, 
        }, 
      },
    }));
    mn('widget', () => ({
      style: {
        margin: '1px', 
      },
      childs: {
        ' em': {
          style: {
            fontStyle: 'italic', 
          }, 
        }, 
      },
    }));

    const css = compile(mn, 'widget');

    expect(css).toContain('margin:1px');
    expect(css).toContain('font-style:italic');
  });

  test('эссенция с exts подмешивает стили другой эссенции', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);

    const css = compile(
      mn, 'p', 'm',
    );

    // хендлеры без аргумента возвращают exts на значение по умолчанию
    expect(css).toContain('padding:0');
    expect(css).toContain('margin:0');
  });
});

describe('слияние повторных объявлений', () => {
  test('exts из двух объявлений одного имени складываются', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);
    mn('stack', 'p10');
    mn('stack', 'mt4');

    const css = compile(mn, 'stack');

    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });

  test('повторная регистрация имени заменяет хендлер целиком', () => {
    const mn: any = minotationProvider();
    mn('widgetalt', () => ({
      style: {
        color: 'red', 
      }, 
    }));
    mn('widgetalt', () => ({
      style: {
        display: 'block', 
      }, 
    }));

    const css = compile(mn, 'widgetalt');

    expect(css).toContain('display:block');
    expect(css).not.toContain('color:red');
  });

  test('важность не дублируется на примеси, у которой она уже задана', () => {
    const mn: any = minotationProvider();
    mn('typoalt', () => ({
      style: {
        fontSize: '14px', 
      }, 
    }));
    mn('cardalt', () => ({
      style: {
        padding: '8px', 
      },
      include: 'typoalt-i', 
    }));

    const css = compile(mn, 'cardalt-i');

    expect(css).toContain('padding:8px!important');
    expect(css).toContain('font-size:14px!important');
    expect(css).not.toContain('-i-i');
  });
});