/**
 * Тесты продвинутых медиа-возможностей для minotation v2.
 *
 * §13.1 & combinator     — тесты помечены test.failing до реализации
 * §13.2 synonym-with-media — тесты помечены test.failing до реализации
 * §13.3 @(sm|md)         — уже работает, регрессионные тесты
 * §13.4 Числовые шаблоны — уже работает, регрессионные тесты
 *
 * Spec: LABARATORY/PROJECTS_CONTEXT/minotation/AGENT_DRAFT/SPEC/13-media-advanced.md
 */

import {
  createMn, 
} from '../index';

function css(mn: ReturnType<typeof createMn>): string {
  mn.compile();
  return mn.styles$.getValue().map(s => s.content).join('');
}

function makeBase(extra?: Record<string, { query?: string;
selector?: string;
priority?: number }>) {
  const mn = createMn({
    media: {
      sm:     {
        query: '(max-width:640px)',
        priority: 0, 
      },
      md:     {
        query: '(max-width:768px)',
        priority: 0, 
      },
      safari: {
        selector: '.safari', 
      },
      mouse:  {
        selector: '.mouse',  
      },
      ...extra,
    },
  });
  mn('w', (s) => ({
    style: {
      width:   s.arg + 'px', 
    }, 
  }));
  mn('p', (s) => ({
    style: {
      padding: s.arg + 'px', 
    }, 
  }));
  return mn;
}

// ─────────────────────────────────────────────────────────────────────────────
// §13.1 & combinator
// ─────────────────────────────────────────────────────────────────────────────

describe('§13.1 & combinator — объединение query + selector медиа', () => {
  test('w900@sm&safari → @media sm { .safari .token{...} }', () => {
    const mn = makeBase();
    mn.check('w900@sm&safari');
    expect(css(mn)).toBe('@media (max-width:640px){.safari .w900\\@sm&safari{width:900px}}');
  });

  test('w800@sm&safari<.parent → @media sm { .safari .parent .token{...} }', () => {
    const mn = makeBase();
    mn.check('w800@sm&safari<.parent');
    expect(css(mn)).toBe('@media (max-width:640px){.safari .parent .w800\\@sm&safari\\<\\.parent{width:800px}}');
  });

  test('w700@sm&md → два query объединяются через "and"', () => {
    const mn = makeBase();
    mn.check('w700@sm&md');
    expect(css(mn)).toBe('@media (max-width:640px) and (max-width:768px){.w700\\@sm&md{width:700px}}');
  });

  test('w700<.parent@sm&md → query "and", родительский контекст', () => {
    const mn = makeBase();
    mn.check('w700<.parent@sm&md');
    expect(css(mn)).toBe('@media (max-width:640px) and (max-width:768px){.parent .w700\\<\\.parent\\@sm&md{width:700px}}');
  });

  test('selector-only: w900@safari → нет @media, только .safari префикс', () => {
    const mn = makeBase();
    mn.check('w900@safari');
    expect(css(mn)).toBe('.safari .w900\\@safari{width:900px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §13.2 synonym-with-media
// ─────────────────────────────────────────────────────────────────────────────

describe('§13.2 synonym-with-media — синоним с @media в значении', () => {
  function makeSynMouse() {
    const mn = createMn({
      media: {
        mouse: {
          selector: '.mouse', 
        }, 
      }, 
    });
    mn('w', (s) => ({
      style: {
        width: s.arg + 'px', 
      }, 
    }));
    mn.setSynonyms({
      h: '(:hover|.hover)@mouse', 
    });
    return mn;
  }

  test('w900:h → два правила в .mouse медиа (:hover и .hover)', () => {
    const mn = makeSynMouse();
    mn.check('w900:h');
    expect(css(mn)).toBe('.mouse .w900\\:h:hover,.mouse .w900\\:h.hover{width:900px}');
  });

  test('w900:h<.parent → оба правила с родительским контекстом в .mouse', () => {
    const mn = makeSynMouse();
    mn.check('w900:h<.parent');
    expect(css(mn)).toBe('.mouse .parent .w900\\:h\\<\\.parent:hover,.mouse .parent .w900\\:h\\<\\.parent.hover{width:900px}');
  });

  test(':hover@mouse без вариантов — одно правило в .mouse', () => {
    const mn = createMn({
      media: {
        mouse: {
          selector: '.mouse', 
        }, 
      }, 
    });
    mn('w', (s) => ({
      style: {
        width: s.arg + 'px', 
      }, 
    }));
    mn.setSynonyms({
      h: ':hover@mouse', 
    });
    mn.check('w900:h');
    expect(css(mn)).toBe('.mouse .w900\\:h:hover{width:900px}');
  });

  test('w900:h@sm + synonym :hover@mouse → правило в @sm И в .mouse', () => {
    const mn = createMn({
      media: {
        sm:    {
          query: '(max-width:640px)',
          priority: 0, 
        },
        mouse: {
          selector: '.mouse', 
        },
      },
    });
    mn('w', (s) => ({
      style: {
        width: s.arg + 'px', 
      }, 
    }));
    mn.setSynonyms({
      h: ':hover@mouse', 
    });
    mn.check('w900:h@sm');
    expect(css(mn)).toBe('@media (max-width:640px){.mouse .w900\\:h\\@sm:hover{width:900px}}');
  });

  test('(w500|p10):h — variant group + synonym-with-media', () => {
    const mn = createMn({
      media: {
        mouse: {
          selector: '.mouse', 
        }, 
      }, 
    });
    mn('w', (s) => ({
      style: {
        width:   s.arg + 'px', 
      }, 
    }));
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.setSynonyms({
      h: '(:hover|.hover)@mouse', 
    });
    mn.check('(w500|p10):h');
    const result = css(mn);
    // Один HTML-класс, два CSS-селектора, два CSS-тела
    expect(result).toContain('.mouse .\\(w500\\|p10\\)\\:h:hover');
    expect(result).toContain('.mouse .\\(w500\\|p10\\)\\:h.hover');
    expect(result).toContain('width:500px');
    expect(result).toContain('padding:10px');
    expect(result).not.toContain('@media');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §13.3 @(sm|md) variant groups — регрессионные тесты (уже работает)
// ─────────────────────────────────────────────────────────────────────────────

describe('§13.3 @(sm|md) variant groups (регрессия)', () => {
  test('w900@(sm|md) → два отдельных @media блока', () => {
    const mn = makeBase();
    mn.check('w900@(sm|md)');
    const result = css(mn);
    expect(result).toContain('@media (max-width:640px){.w900\\@\\(sm\\|md\\){width:900px}}');
    expect(result).toContain('@media (max-width:768px){.w900\\@\\(sm\\|md\\){width:900px}}');
  });

  test('(w600|p10)@(sm|md) → два блока, каждый с двумя телами', () => {
    const mn = makeBase();
    mn.check('(w600|p10)@(sm|md)');
    const result = css(mn);
    expect(result).toContain('@media (max-width:640px){');
    expect(result).toContain('@media (max-width:768px){');
    expect(result).toContain('.\\(w600\\|p10\\)\\@\\(sm\\|md\\){width:600px}');
    expect(result).toContain('.\\(w600\\|p10\\)\\@\\(sm\\|md\\){padding:10px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §13.4 Числовые шаблоны (регрессия)
// ─────────────────────────────────────────────────────────────────────────────

describe('§13.4 Числовые шаблоны @768, @992- (регрессия)', () => {
  function makeNum() {
    const mn = createMn();
    mn('w', (s) => ({
      style: {
        width: s.arg + 'px', 
      }, 
    }));
    return mn;
  }

  test('w900@768 → @media (max-width: 768px)', () => {
    const mn = makeNum();
    mn.check('w900@768');
    const result = css(mn);
    expect(result).toContain('@media (max-width: 768px)');
    expect(result).toContain('width:900px');
  });

  test('w900@992- → @media (min-width: 992px)', () => {
    const mn = makeNum();
    mn.check('w900@992-');
    const result = css(mn);
    expect(result).toContain('@media (min-width: 992px)');
    expect(result).toContain('width:900px');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §13.5 Комплексные комбинации (v1-parity)
// ─────────────────────────────────────────────────────────────────────────────

describe('§13.5 Комплексные комбинации — v1 parity', () => {
  function makeComplex() {
    const mn = createMn({
      media: {
        m:      {
          query: '(max-width:992px)', 
        },
        d:      {
          query: '(min-width:993px)', 
        },
        dark:   {
          selector: '.dark',   
        },
        iphone: {
          selector: '.iphone', 
        },
        mouse:  {
          selector: '.mouse',  
        },
        print:  {
          query: 'print', 
        },
      },
    });
    mn('c', (s) => ({
      style: {
        color: '#' + s.arg, 
      }, 
    }));
    mn('w', (s) => ({
      style: {
        width:   s.arg + 'px', 
      }, 
    }));
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.setSynonyms({
      hm: '(:hover|.hover)@mouse',
      om: ':focus@m', 
    });
    return mn;
  }

  const CLASS_A = '.\\(w500\\|p10\\)\\:hm\\<\\.parent\\.active\\>\\.child\\@dark&iphone';
  const PRE     = '.dark.iphone.mouse .parent.active ';

  test('§A (w500|p10):hm<.parent.active>.child@dark&iphone — width под :hover + .hover', () => {
    const mn = makeComplex();
    mn.check('(w500|p10):hm<.parent.active>.child@dark&iphone');
    const result = css(mn);
    expect(result).toContain(PRE + CLASS_A + ':hover .child,' + PRE + CLASS_A + '.hover .child{width:500px}');
  });

  test('§A (w500|p10):hm<.parent.active>.child@dark&iphone — padding под :hover + .hover', () => {
    const mn = makeComplex();
    mn.check('(w500|p10):hm<.parent.active>.child@dark&iphone');
    const result = css(mn);
    expect(result).toContain(PRE + CLASS_A + ':hover .child,' + PRE + CLASS_A + '.hover .child{padding:10px}');
  });

  test('§B cF@mouse&m&iphone — три-позиционный &: query + два selector', () => {
    const mn = makeComplex();
    mn.check('cF@mouse&m&iphone');
    expect(css(mn)).toBe('@media (max-width:992px){.mouse.iphone .cF\\@mouse&m&iphone{color:#F}}');
  });

  test('§C cA@print&d&x100 — три-позиционный &: два query + height template', () => {
    const mn = makeComplex();
    mn.check('cA@print&d&x100');
    expect(css(mn)).toBe('@media print and (min-width:993px) and (max-height: 100px){.cA\\@print&d&x100{color:#A}}');
  });

  test('§D w100:om — synonym-with-media (одиночный :focus@m)', () => {
    const mn = makeComplex();
    mn.check('w100:om');
    expect(css(mn)).toBe('@media (max-width:992px){.w100\\:om:focus{width:100px}}');
  });
});
