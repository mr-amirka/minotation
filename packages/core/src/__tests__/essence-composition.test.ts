/**
 * Композиция эссенций: `include`-примеси (в т.ч. список и циклическая ссылка),
 * важность (`-i`) и вложенные `childs`/`media` при слиянии.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function cssOf(mn: any): string {
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

function compile(mn: any, token: string): string {
  mn.getCompiler('class')(token);
  mn.compile();
  return cssOf(mn);
}

describe('include — примеси эссенций', () => {
  test('список примесей подмешивает стили каждой', () => {
    const mn: any = minotationProvider();
    mn('typo', () => ({
      style: {
        fontSize: '14px', 
      }, 
    }));
    mn('shadowish', () => ({
      style: {
        boxShadow: '0 0 1px #000', 
      }, 
    }));
    mn('card', () => ({
      style: {
        padding: '8px', 
      },
      include: ['typo', 'shadowish'], 
    }));

    const css = compile(mn, 'card');

    expect(css).toContain('padding:8px');
    expect(css).toContain('font-size:14px');
    expect(css).toContain('box-shadow:0 0 1px #000');
  });

  test('примеси, заданные строкой через пробел', () => {
    const mn: any = minotationProvider();
    mn('alpha', () => ({
      style: {
        color: '#f00', 
      }, 
    }));
    mn('beta', () => ({
      style: {
        display: 'block', 
      }, 
    }));
    mn('gamma', () => ({
      style: {
        margin: '1px', 
      },
      include: 'alpha beta', 
    }));

    const css = compile(mn, 'gamma');

    expect(css).toContain('color:#f00');
    expect(css).toContain('display:block');
    expect(css).toContain('margin:1px');
  });

  test('циклическая ссылка include не зацикливает компиляцию', () => {
    const mn: any = minotationProvider();
    mn('loopone', () => ({
      style: {
        color: '#f00', 
      },
      include: 'looptwo', 
    }));
    mn('looptwo', () => ({
      style: {
        display: 'block', 
      },
      include: 'loopone', 
    }));

    let css = '';
    expect(() => {
      css = compile(mn, 'loopone'); 
    }).not.toThrow();
    expect(css).toContain('color:#f00');
    expect(css).toContain('display:block');
  });
});

describe('important и вложенные части эссенции', () => {
  test('суффикс -i делает объявления !important, включая childs и media', () => {
    const mn: any = minotationProvider({
      media: {
        sm: {
          query: '(max-width: 600px)',
          priority: 0, 
        }, 
      }, 
    });
    mn('box', () => ({
      style: {
        padding: '4px', 
      },
      childs: {
        ' span': {
          style: {
            color: '#f00', 
          }, 
        }, 
      },
      media: {
        sm: {
          style: {
            margin: '2px', 
          }, 
        }, 
      },
    }));

    const css = compile(mn, 'box-i');

    expect(css).toContain('padding:4px!important');
    expect(css).toContain('color:#f00!important');
    expect(css).toContain('margin:2px!important');
  });

  test('стандартный хендлер тоже принимает -i', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);

    expect(compile(mn, 'p10-i')).toContain('padding:10px!important');
  });

  test('пустое значение атрибута не даёт правил', () => {
    const mn: any = minotationProvider();
    mn.setPresets([presetStandard]);
    const compileAttr = mn.getCompiler('class');

    compileAttr('');
    compileAttr('   ');
    mn.compile();

    expect(cssOf(mn)).toBe('');
  });
});
