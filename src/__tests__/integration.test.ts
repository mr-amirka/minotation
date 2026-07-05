import {
  createMn, 
} from '../preset/MnInstance';
import {
  presetStandard, 
} from '../preset/presets/standard';
import {
  presetSynonyms, 
} from '../preset/presets/synonyms';
import {
  presetMedias, 
} from '../preset/presets/medias';

describe('MnInstance — полный пайплайн', () => {
  test('p10 → padding:10px', () => {
    const mn = createMn();
    mn('p', (ctx) => ({
      style: {
        padding: ctx.arg + 'px', 
      },
    }));
    mn.check('p10');
    mn.compile();

    const styles = mn.styles$.getValue();
    expect(styles).toHaveLength(1);
    expect(styles[0].content).toContain('.p10{padding:10px}');
  });

  test('два токена → один блок', () => {
    const mn = createMn();
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn('m', () => ({
      style: {
        margin: '5px', 
      }, 
    }));
    mn.check('p10 m5');
    mn.compile();

    const styles = mn.styles$.getValue();
    expect(styles).toHaveLength(1);
    const content = styles[0].content;
    expect(content).toContain('padding:10px');
    expect(content).toContain('margin:5px');
  });

  test('родительский селектор: cF00<.p', () => {
    const mn = createMn();
    mn('c', (ctx) => ({
      style: {
        color: '#' + ctx.arg, 
      },
    }));
    mn.check('cF00<.p');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('.p');
    expect(content).toContain('color:#F00');
  });

  test('состояние с синонимом: cF00:h', () => {
    const mn = createMn();
    mn.setSynonyms({
      h: ':hover', 
    });
    mn('c', (ctx) => ({
      style: {
        color: '#' + ctx.arg, 
      },
    }));
    mn.check('cF00:h');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain(':hover');
  });

  test('selectorPrefix', () => {
    const mn = createMn({
      selectorPrefix: '.scope', 
    });
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toBe('.scope .p10{padding:10px}');
  });

  test('множитель *2', () => {
    const mn = createMn();
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10*2');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    // *2 не добавляется к селектору (только через контекст)
    expect(content).toContain('padding:10px');
  });

  test('styles$ observable', () => {
    const mn = createMn();
    const emitted: unknown[] = [];
    mn.styles$.on((styles) => emitted.push(styles));

    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10');
    mn.compile();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toHaveLength(1);
  });

  test('-i флаг (!important) в аргументе', () => {
    const mn = createMn();
    mn('p', (ctx) => ({
      style: {
        padding: ctx.arg + 'px', 
      },
    }));
    mn.check('p10-i');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('!important');
  });

  test('-i с родительским селектором', () => {
    const mn = createMn();
    mn('p', (ctx) => ({
      style: {
        padding: ctx.arg + 'px', 
      },
    }));
    mn.check('p10-i<.parent');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('!important');
  });

  test('без -i — без !important', () => {
    const mn = createMn();
    mn('p', (ctx) => ({
      style: {
        padding: ctx.arg + 'px', 
      },
    }));
    mn.check('p10');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).not.toContain('!important');
  });

  test('медиа-запрос: p10@m', () => {
    const mn = createMn({
      media: {
        m: {
          query: '(max-width: 991px)',
          priority: 0, 
        }, 
      }, 
    });
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10@m');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('@media (max-width: 991px)');
    expect(content).toContain('padding:10px');
  });

  test('короткий формат медиа: p10@768', () => {
    const mn = createMn();
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10@768');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('@media (max-width: 768px)');
  });

  test('селекторное медиа (user-agent): p10@safari', () => {
    const mn = createMn({
      media: {
        safari: {
          selector: '.safari', 
        }, 
      }, 
    });
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10@safari');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('.safari');
    expect(content).not.toContain('@media');
  });

  test('mn.css() — raw CSS', () => {
    const mn = createMn();
    mn.css('html', {
      margin: '0',
      padding: '0', 
    });
    mn.compile();

    const content = mn.styles$.getValue()
      .find(s => s.content.includes('html'))?.content || '';
    expect(content).toContain('margin:0');
    expect(content).toContain('padding:0');
  });

  test('атрибутный компилятор: getCompiler("m")', () => {
    const mn = createMn();
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    const comp = mn.getCompiler('m');
    comp.check('p10');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('[m~="p10"]');
  });

  test('атрибутный компилятор с классом: оба работают', () => {
    const mn = createMn();
    mn('p', () => ({
      style: {
        padding: '10px', 
      }, 
    }));
    mn.check('p10');
    mn.getCompiler('m').check('p10');
    mn.compile();

    const contents = mn.styles$.getValue().map(s => s.content);
    const hasClass = contents.some(c => c.includes('.p10'));
    const hasAttr = contents.some(c => c.includes('[m~="p10"]'));
    expect(hasClass).toBe(true);
    expect(hasAttr).toBe(true);
  });

  test('группа в стеме: (cF00|cF11)<.p', () => {
    const mn = createMn();
    mn('c', (ctx) => ({
      style: {
        color: '#' + ctx.arg, 
      }, 
    }));
    mn.check('(cF00|cF11)<.p');
    mn.compile();

    const content = mn.styles$.getValue()[0].content;
    expect(content).toContain('.p');
    expect(content).toContain('color:#F00');
    expect(content).toContain('color:#F11');
  });

  test('группа в родителе: cF00<(.p1|.p2)', () => {
    const mn = createMn();
    mn('c', (ctx) => ({
      style: {
        color: '#' + ctx.arg, 
      }, 
    }));
    mn.check('cF00<(.p1|.p2)');
    mn.compile();

    const contents = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(contents).toContain('.p1');
    expect(contents).toContain('.p2');
  });

  test('mn.assign() — назначение эссенций на селекторы', () => {
    const mn = createMn();
    mn('bxzbb', () => ({
      style: {
        boxSizing: 'border-box', 
      }, 
    }));
    mn.assign({
      '*, *:before, *:after': 'bxzbb', 
    });
    mn.compile();

    const css = mn.styles$.getValue()
      .find(s => s.content.includes('box-sizing'))?.content || '';
    expect(css).toContain('*, *:before, *:after');
    expect(css).toContain('box-sizing:border-box');
  });

  test('mn.setPresets() — загрузка пресета', () => {
    const mn = createMn();
    mn.setPresets([(m) => {
      m('p', () => ({
        style: {
          padding: '10px', 
        }, 
      }));
    }]);
    mn.check('p10');
    mn.compile();

    expect(mn.styles$.getValue()[0].content).toContain('padding:10px');
  });

  test('стандартный пресет: реальный пример', () => {
    const mn = createMn();
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
    ]);

    // Типичная карточка
    mn.check('p20 mb10 bgFFF r8 fx fxaCenter fyaCenter w200 h100');
    // Текст с hover и медиа
    mn.check('f14 c333 fwBold:h crPointer:h w300@m p10@m');
    // Проценты и отрицательные
    mn.check('w50p m-5');

    mn.compile();
    const allCss = mn.styles$.getValue().map(s => s.content).join(' ');

    // Размеры и отступы
    expect(allCss).toContain('padding:20px');
    expect(allCss).toContain('margin-bottom:10px');
    expect(allCss).toContain('width:200px');
    expect(allCss).toContain('height:100px');

    // Проценты и отрицательные
    expect(allCss).toContain('width:50%');
    expect(allCss).toContain('margin:-5px');

    // Цвета
    expect(allCss).toContain('background:#FFF');
    expect(allCss).toContain('color:#333');

    // CamelCase значения
    expect(allCss).toContain('justify-content:center');
    expect(allCss).toContain('align-items:center');

    // hover через синонимы
    expect(allCss).toContain(':hover');
    expect(allCss).toContain('font-weight:bold');

    // Медиа
    expect(allCss).toContain('@media (max-width: 991.98px)');
  });

  test('exts — расширение стилей', () => {
    const mn = createMn();
    mn('base', () => ({
      style: {
        fontSize: '14px', 
      }, 
    }));
    mn('p', (ctx) => ({
      style: {
        padding: (parseFloat(ctx.arg) || 0) + 'px', 
      },
      exts: 'base',
    }));
    mn.check('p10');
    mn.compile();
    const css = mn.styles$.getValue()[0].content;
    expect(css).toContain('padding:10px');
    expect(css).toContain('font-size:14px');
  });

  test('include — примесь стилей', () => {
    const mn = createMn();
    mn('base', () => ({
      style: {
        fontSize: '14px', 
      }, 
    }));
    mn('p', (ctx) => ({
      style: {
        padding: (parseFloat(ctx.arg) || 0) + 'px', 
      },
      include: 'base',
    }));
    mn.check('p10');
    mn.compile();
    const css = mn.styles$.getValue()[0].content;
    expect(css).toContain('padding:10px');
    expect(css).toContain('font-size:14px');
  });

  test('--var=value: CSS custom properties', () => {
    const mn = createMn();
    mn.check('--bgColor=#F00');
    mn.compile();
    const css = mn.styles$.getValue()
      .find(s => s.content.includes('--bgColor'))?.content || '';
    expect(css).toContain('--bgColor:#F00');
  });

  test('_ → пробел в custom property', () => {
    const mn = createMn();
    mn.check('--transition=all_0.3s_ease');
    mn.compile();
    const css = mn.styles$.getValue()[0]?.content || '';
    expect(css).toContain('all 0.3s ease');
  });

  test('vendor-префиксы', () => {
    const mn = createMn({
      prefixedAttrs: {
        transform: 1, 
      },
      prefixes: {
        '-webkit-': 1,
        '-moz-': 1, 
      },
    });
    mn('scale', (ctx) => ({
      style: {
        transform: `scale(${ctx.arg})`, 
      },
    }));
    mn.check('scale2');
    mn.compile();
    const css = mn.styles$.getValue()[0].content;
    expect(css).toContain('-webkit-transform');
    expect(css).toContain('-moz-transform');
    expect(css).toContain('transform:scale(2)');
  });

  test('setKeyframes', () => {
    const mn = createMn();
    mn.setKeyframes('fadeIn', {
      from: {
        opacity: '0', 
      },
      to: {
        opacity: '1', 
      },
    });
    mn.compile();
    const css = mn.styles$.getValue()
      .find(s => s.content.includes('keyframes'))?.content || '';
    expect(css).toContain('@keyframes fadeIn');
    expect(css).toContain('opacity:0');
    expect(css).toContain('opacity:1');
  });

  // ================================================================
  // Callable API: mn(key, value) и mn(map)
  // ================================================================
  describe('callable mn(key, value)', () => {
    test('mn(key, fn) — регистрация хендлера через вызов', () => {
      const mn = createMn();
      mn('p', (c) => ({
        style: {
          padding: c.arg + 'px', 
        }, 
      }));
      mn.check('p15');
      mn.compile();
      expect(mn.styles$.getValue()[0].content).toContain('padding:15px');
    });

    test('mn(key, StyleResult) — статический объект', () => {
      const mn = createMn();
      mn('abs', {
        style: {
          position: 'absolute', 
        }, 
      });
      mn.check('abs');
      mn.compile();
      expect(mn.styles$.getValue()[0].content).toContain('position:absolute');
    });

    test('mn(key, string) — строковый макрос (full-token expansion)', () => {
      const mn = createMn();
      mn('p', (c) => ({
        style: {
          padding: c.arg + 'px', 
        }, 
      }));
      mn('m', (c) => ({
        style: {
          margin: c.arg + 'px', 
        }, 
      }));
      mn('box', 'p10 m5');
      mn.check('box');
      mn.compile();
      const css = mn.styles$.getValue().map(s => s.content).join('');
      expect(css).toContain('padding:10px');
      expect(css).toContain('margin:5px');
    });

    test('mn(map) — карта из трёх форматов', () => {
      const mn = createMn();
      mn({
        p: (c) => ({
          style: {
            padding: c.arg + 'px', 
          }, 
        }),
        abs: {
          style: {
            position: 'absolute', 
          }, 
        },
        box: 'p20',
      });
      mn.check('p5 abs box');
      mn.compile();
      const css = mn.styles$.getValue().map(s => s.content).join('');
      expect(css).toContain('padding:5px');
      expect(css).toContain('position:absolute');
      expect(css).toContain('padding:20px');
    });

    test('mn(key, string) с MN-контекстом в значении', () => {
      const mn = createMn();
      mn('p', (c) => ({
        style: {
          padding: c.arg + 'px', 
        }, 
      }));
      mn('m', (c) => ({
        style: {
          margin: c.arg + 'px', 
        }, 
      }));
      mn('card', '(p10|m5)');
      mn.check('card');
      mn.compile();
      const css = mn.styles$.getValue().map(s => s.content).join('');
      expect(css).toContain('padding:10px');
      expect(css).toContain('margin:5px');
    });

    test('mn() возвращает себя — цепочка вызовов', () => {
      const mn = createMn();
      const result = mn('p', (c) => ({
        style: {
          padding: c.arg + 'px',
        },
      }))('m', (c) => ({
        style: {
          margin: c.arg + 'px',
        },
      }));
      result.check('p8 m4');
      result.compile();
      const css = mn.styles$.getValue().map(s => s.content).join('');
      expect(css).toContain('padding:8px');
      expect(css).toContain('margin:4px');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-class условия — полный пайплайн с presetStandard
//
// Контракт из MN 1.x: `cF.active` → `.cF\.active.active{color:#FFF}`
// Правило: применяется только когда элемент имеет ОБА класса — `cF.active` И `active`.
// ─────────────────────────────────────────────────────────────────────────────

describe('self-class условия — полный CSS пайплайн', () => {
  function mn() {
    const inst = createMn();
    inst.setPresets([presetStandard, presetSynonyms]);
    return inst;
  }
  function css(tokens: string): string {
    const inst = mn();
    inst.check(tokens);
    inst.compile();
    return inst.styles$.getValue().map(s => s.content).join('\n');
  }

  // ── Базовые self-class ───────────────────────────────────────────────────

  test('cF.active → .cF\\.active.active{color:#FFF}', () => {
    const result = css('cF.active');
    expect(result).toContain('.cF\\.active.active');
    expect(result).toContain('color:#FFF');
    // НЕ должен быть безусловный .cF\.active без .active
    expect(result).not.toContain('.cF\\.active{');
  });

  test('cF.38 (только opacity — НЕ self-class) → .cF\\.38{color:rgba(255,255,255,.38)}', () => {
    const result = css('cF.38');
    expect(result).toContain('.cF\\.38{');
    expect(result).toContain('rgba(255,255,255,.38)');
    // Никаких дополнительных классов-условий
    expect(result).not.toContain('.cF\\.38.38');
  });

  test('cF.38.active → .cF\\.38\\.active.active содержит rgba(…0.38…)', () => {
    const result = css('cF.38.active');
    expect(result).toContain('.cF\\.38\\.active.active');
    expect(result).toContain('rgba(255,255,255,.38)');
    expect(result).not.toContain('.cF\\.38\\.active{');
  });

  test('bgcF.12.active → .bgcF\\.12\\.active.active содержит rgba(…0.12…)', () => {
    const result = css('bgcF.12.active');
    expect(result).toContain('.bgcF\\.12\\.active.active');
    expect(result).toContain('rgba(255,255,255,.12)');
  });

  // ── Сочетание с другими контекстами ─────────────────────────────────────

  test('cF.active:hover → self-class перед pseudo-class', () => {
    // raw = 'cF.active:hover' → класс .cF\.active\:hover, self-class .active, state :hover
    const result = css('cF.active:hover');
    expect(result).toContain('.cF\\.active\\:hover.active:hover');
    expect(result).toContain('color:#FFF');
  });

  test('cF.active<.parent → родительский селектор + self-class', () => {
    // raw = 'cF.active<.parent' → класс .cF\.active\<\.parent, self-class .active
    const result = css('cF.active<.parent');
    expect(result).toContain('.parent');
    expect(result).toContain('.cF\\.active\\<\\.parent.active');
  });

  // ── Important ────────────────────────────────────────────────────────────

  test('cF-i.active → .cF-i\\.active.active + !important (правильный порядок)', () => {
    const result = css('cF-i.active');
    expect(result).toContain('.cF-i\\.active.active');
    expect(result).toContain('!important');
    expect(result).toContain('color:#FFF');
  });

  test('cF.active-i → -i после self-class: часть имени класса .active-i, нет important', () => {
    const result = css('cF.active-i');
    expect(result).toContain('.cF\\.active-i.active-i');
    expect(result).not.toContain('!important');
  });

  test('cF.38-i.active → opacity + self-class + important (правильный порядок)', () => {
    const result = css('cF.38-i.active');
    expect(result).toContain('.cF\\.38-i\\.active.active');
    expect(result).toContain('rgba(255,255,255,.38)');
    expect(result).toContain('!important');
  });

  // ── Несколько self-class условий ─────────────────────────────────────────

  test('cF.active.paused → оба условия в селекторе', () => {
    const result = css('cF.active.paused');
    expect(result).toContain('.cF\\.active\\.paused.active.paused');
  });

  // ── Обработчик получает только чистый arg (регрессия) ───────────────────

  test('обработчик видит arg="F", не "F.active"', () => {
    const inst = createMn();
    let receivedArg: string | undefined;
    inst('c', (ctx) => {
      receivedArg = ctx.arg;
      return {
        style: {
          color: ctx.arg, 
        }, 
      };
    });
    inst.check('cF.active');
    inst.compile();
    expect(receivedArg).toBe('F');
  });

  test('обработчик видит arg="F.38", не "F.38.active"', () => {
    const inst = createMn();
    let receivedArg: string | undefined;
    inst('c', (ctx) => {
      receivedArg = ctx.arg;
      return {
        style: {
          color: ctx.arg, 
        }, 
      };
    });
    inst.check('cF.38.active');
    inst.compile();
    expect(receivedArg).toBe('F.38');
  });

  // ── Регрессии — обычные токены без self-class не сломались ──────────────

  test('регрессия: cF → .cF{color:#FFF} (без self-class)', () => {
    const result = css('cF');
    expect(result).toContain('.cF{');
    expect(result).toContain('color:#FFF');
  });

  test('регрессия: p8 → .p8{padding:8px}', () => {
    const result = css('p8');
    expect(result).toContain('.p8{');
    expect(result).toContain('padding:8px');
  });

  test('регрессия: cF.38 → rgba(255,255,255,.38)', () => {
    const result = css('cF.38');
    expect(result).toContain('.cF\\.38{');
    expect(result).toContain('rgba(255,255,255,.38)');
  });

  // ── Реальные токены из демки ─────────────────────────────────────────────

  test('crP — cursor:pointer (нет self-class, arg=P)', () => {
    const inst = createMn();
    inst.setPresets([presetStandard]);
    inst.check('crP');
    inst.compile();
    const result = inst.styles$.getValue().map(s => s.content).join('');
    expect(result).toContain('.crP{');
    expect(result).toContain('pointer');
  });

  test('полная строка из демки: crP cF.38 cF.active bgcF.12.active', () => {
    const result = css('crP cF.38 cF.active bgcF.12.active');
    // crP — без условия
    expect(result).toContain('.crP{');
    // cF.38 — opacity без условия
    expect(result).toContain('.cF\\.38{');
    expect(result).toContain('rgba(255,255,255,.38)');
    // cF.active — цвет только с классом .active
    expect(result).toContain('.cF\\.active.active');
    expect(result).not.toContain('.cF\\.active{');
    // bgcF.12.active — фон с opacity только с классом .active
    expect(result).toContain('.bgcF\\.12\\.active.active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-class через '+' (adjacent sibling) — полный CSS пайплайн
// ─────────────────────────────────────────────────────────────────────────────

describe('self-class +WORD условия — полный CSS пайплайн', () => {
  function css(tokens: string): string {
    const inst = createMn();
    inst.setPresets([presetStandard]);
    inst.check(tokens);
    inst.compile();
    return inst.styles$.getValue().map(s => s.content).join('');
  }

  test('cF+38 — числовой суффикс, нет self-class (нет adjacent sibling)', () => {
    // +38 остаётся в arg; colorVal не обрабатывает + как opacity-разделитель
    const result = css('cF+38');
    expect(result).toContain('.cF\\+38{');
    // Нет adjacent sibling условия — просто класс без суффикса
    expect(result).not.toContain('.cF\\+38+');
  });

  test('cF+active → .cF\\+active+active{color:#FFF}', () => {
    const result = css('cF+active');
    // Селектор: adjacent sibling
    expect(result).toContain('.cF\\+active+active');
    // НЕ должно быть простого .cF\+active{ без условия
    expect(result).not.toContain('.cF\\+active{');
    expect(result).toContain('color:#FFF');
  });

  test('bgcF+12+active → .bgcF\\+12\\+active+active', () => {
    // +12 в arg, +active — self-class; colorVal не обрабатывает + как opacity
    const result = css('bgcF+12+active');
    expect(result).toContain('.bgcF\\+12\\+active+active');
  });

  test('cF.38+active → .cF\\.38\\+active+active', () => {
    // opacity (.38) в arg, +active — self-class
    const result = css('cF.38+active');
    expect(result).toContain('.cF\\.38\\+active+active');
    expect(result).toContain('rgba(255,255,255,.38)');
  });

  test('cF+active — обработчик получает arg="F", не "F+active"', () => {
    const inst = createMn();
    let receivedArg: string | undefined;
    inst('c', (ctx) => {
      receivedArg = ctx.arg;
      return {
        style: {
          color: ctx.arg, 
        }, 
      };
    });
    inst.check('cF+active');
    inst.compile();
    expect(receivedArg).toBe('F');
  });

  test('bgcF+12+active — обработчик получает arg="F+12"', () => {
    const inst = createMn();
    let receivedArg: string | undefined;
    inst('bgc', (ctx) => {
      receivedArg = ctx.arg;
      return {
        style: {
          background: ctx.arg, 
        }, 
      };
    });
    inst.check('bgcF+12+active');
    inst.compile();
    expect(receivedArg).toBe('F+12');
  });

  test('cF-i+active → adjacent sibling + !important (правильный порядок)', () => {
    const result = css('cF-i+active');
    expect(result).toContain('.cF-i\\+active+active');
    expect(result).toContain('!important');
    expect(result).toContain('color:#FFF');
  });

  test('cF+active-i → -i после self-class: часть имени класса, нет important', () => {
    const result = css('cF+active-i');
    expect(result).toContain('.cF\\+active-i+active-i');
    expect(result).not.toContain('!important');
  });
});

describe('hex-цвет с opacity — полный CSS пайплайн', () => {
  function css(tokens: string): string {
    const inst = createMn();
    inst.setPresets([presetStandard, presetSynonyms]);
    inst.check(tokens);
    inst.compile();
    return inst.styles$.getValue().map(s => s.content).join('\n');
  }

  // ── bg (background) ───────────────────────────────────────────────────────

  test('bg0A0A12.88 → background:rgba(10,10,18,.88)', () => {
    const result = css('bg0A0A12.88');
    expect(result).toContain('.bg0A0A12\\.88');
    expect(result).toContain('background:rgba(10,10,18,.88)');
  });

  test('bg0A0A12 (без opacity) → background:#0A0A12', () => {
    const result = css('bg0A0A12');
    expect(result).toContain('.bg0A0A12{');
    expect(result).toContain('background:#0A0A12');
  });

  test('bg0A0A12.5 → background:rgba(10,10,18,.5)', () => {
    const result = css('bg0A0A12.5');
    expect(result).toContain('background:rgba(10,10,18,.5)');
  });

  // ── bgc (background-color) ────────────────────────────────────────────────

  test('bgc0A0A12.88 → background-color:rgba(10,10,18,.88)', () => {
    const result = css('bgc0A0A12.88');
    expect(result).toContain('.bgc0A0A12\\.88');
    expect(result).toContain('background-color:rgba(10,10,18,.88)');
  });

  test('bgcF.88 → background-color:rgba(255,255,255,.88)', () => {
    const result = css('bgcF.88');
    expect(result).toContain('background-color:rgba(255,255,255,.88)');
  });

  test('bgcF.12 → background-color:rgba(255,255,255,.12)', () => {
    const result = css('bgcF.12');
    expect(result).toContain('background-color:rgba(255,255,255,.12)');
  });

  // ── c (color) ─────────────────────────────────────────────────────────────

  test('cF.88 → color:rgba(255,255,255,.88)', () => {
    const result = css('cF.88');
    expect(result).toContain('color:rgba(255,255,255,.88)');
  });

  test('c0A0A12.88 → color:rgba(10,10,18,.88)', () => {
    const result = css('c0A0A12.88');
    expect(result).toContain('color:rgba(10,10,18,.88)');
  });

  // ── self-class + hex opacity ──────────────────────────────────────────────

  test('bg0A0A12.88.active → rgba + self-class', () => {
    const result = css('bg0A0A12.88.active');
    expect(result).toContain('.bg0A0A12\\.88\\.active.active');
    expect(result).toContain('background:rgba(10,10,18,.88)');
  });

  test('bgcF.12.active → rgba + self-class (регрессия)', () => {
    const result = css('bgcF.12.active');
    expect(result).toContain('.bgcF\\.12\\.active.active');
    expect(result).toContain('background-color:rgba(255,255,255,.12)');
  });

  // ── hex fallback (только в новом MN — НЕ генерируется) ───────────────────
  // Старая версия MN выводила background:#hex + background:rgba(...) (два объявления).
  // Новая версия выводит только rgba(...). Это намеренное поведение.
  // Если понадобится hex-фолбэк — реализовать через опцию altColor в colorVal.

  test('bg0A0A12.88 — только rgba, без hex-фолбэка (в отличие от старой версии)', () => {
    const result = css('bg0A0A12.88');
    expect(result).toContain('rgba(10,10,18,.88)');
    // Старая версия: background:#0a0a12;background:rgba(...)
    // Новая версия: только rgba
    expect(result).not.toContain('background:#');
  });
});
