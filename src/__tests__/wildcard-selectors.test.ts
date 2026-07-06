// @ts-nocheck
/* eslint-disable */
/**
 * Тесты wildcard-селекторов (.*WORD, #*WORD) для minotation v2.
 *
 * `.*WORD` → `[class*=WORD]` — элемент, класс которого СОДЕРЖИТ WORD.
 * `#*WORD` → `[id*=WORD]`   — элемент, id которого СОДЕРЖИТ WORD.
 *
 * Все ожидания верифицированы v1-кодом и v2-реализацией (v1 parity).
 *
 * §A  — self-class .*WORD
 * §B  — parent <.*WORD
 * §C  — child >.*WORD
 * §D  — self-class + child комбинация
 * §E  — self-class #*WORD (id wildcard)
 * §F  — parent <#*WORD
 * §G  — child >#*WORD
 * §H  — .*WORD + state (:hover)
 * §I  — parent .plain + child .*WORD
 * §J  — .*WORD + @media
 * §K  — .*WORD + @media&selector combinator
 * §L  — variant group (a|b).*WORD
 * §M  — parent .*WORD + child .*WORD
 */

import {
  createMn, parseLexeme, 
} from '../index';

function css(mn: ReturnType<typeof createMn>): string {
  mn.compile();
  return mn.styles$.getValue().map(s => s.content).join('');
}

function makeBase() {
  const mn = createMn({
    media: {
      sm:     {
        query: '(max-width:640px)',
        priority: 0, 
      },
      safari: {
        selector: '.safari', 
      },
    },
  });
  mn('c', (s) => ({
    style: {
      color: '#' + s.arg, 
    }, 
  }));
  mn('d', (s) => ({
    style: {
      display: s.arg, 
    }, 
  }));
  return mn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser unit tests — parseLexeme корректно извлекает self-class
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLexeme — wildcard self-class extraction', () => {
  test('cF.*-active: selfClasses = [".*-active"], arg = "F"', () => {
    const l = parseLexeme('cF.*-active');
    expect(l.selfClasses).toEqual(['.*-active']);
    expect(l.stem.arg).toBe('F');
  });

  test('cF#*-disabled: selfClasses = ["#*-disabled"], arg = "F"', () => {
    const l = parseLexeme('cF#*-disabled');
    expect(l.selfClasses).toEqual(['#*-disabled']);
    expect(l.stem.arg).toBe('F');
  });

  test('dB>.*MuiSlider: no selfClasses, child selector нормализован', () => {
    const l = parseLexeme('dB>.*MuiSlider');
    expect(l.selfClasses).toEqual([]);
    expect(l.context[0]).toMatchObject({
      kind: 'child',
      selector: '[class*=MuiSlider]', 
    });
  });

  test('cF<.*-active: parent selector нормализован к [class*=-active]', () => {
    const l = parseLexeme('cF<.*-active');
    expect(l.context[0]).toMatchObject({
      kind: 'parent',
      selector: '[class*=-active]', 
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §A: self-class .*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§A self-class .*WORD → [class*=WORD] на самом элементе', () => {
  test('cF.*-active → CLASS[class*=-active]{color:#F}', () => {
    const mn = makeBase();
    mn.check('cF.*-active');
    expect(css(mn)).toBe('.cF\\.\\*-active[class*=-active]{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §B: parent <.*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§B parent <.*WORD → [class*=WORD] CLASS', () => {
  test('cF<.*-active → [class*=-active] CLASS{color:#F}', () => {
    const mn = makeBase();
    mn.check('cF<.*-active');
    expect(css(mn)).toBe('[class*=-active] .cF\\<\\.\\*-active{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §C: child >.*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§C child >.*WORD → CLASS [class*=WORD]', () => {
  test('dB>.*MuiSlider → CLASS [class*=MuiSlider]{display:B}', () => {
    const mn = makeBase();
    mn.check('dB>.*MuiSlider');
    expect(css(mn)).toBe('.dB\\>\\.\\*MuiSlider [class*=MuiSlider]{display:B}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §D: self-class + child .*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§D self-class .*WORD + child >.*WORD', () => {
  test('cF.*-active>.*MuiSlider → CLASS[class*=-active] [class*=MuiSlider]', () => {
    const mn = makeBase();
    mn.check('cF.*-active>.*MuiSlider');
    expect(css(mn)).toBe('.cF\\.\\*-active\\>\\.\\*MuiSlider[class*=-active] [class*=MuiSlider]{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §E: id wildcard #*WORD self-class
// ─────────────────────────────────────────────────────────────────────────────

describe('§E self-class #*WORD → [id*=WORD] на самом элементе', () => {
  test('cF#*-disabled → CLASS[id*=-disabled]{color:#F}', () => {
    const mn = makeBase();
    mn.check('cF#*-disabled');
    expect(css(mn)).toBe('.cF\\#\\*-disabled[id*=-disabled]{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §F: parent <#*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§F parent <#*WORD → [id*=WORD] CLASS', () => {
  test('cF<#*MuiSlider → [id*=MuiSlider] CLASS{color:#F}', () => {
    const mn = makeBase();
    mn.check('cF<#*MuiSlider');
    expect(css(mn)).toBe('[id*=MuiSlider] .cF\\<\\#\\*MuiSlider{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §G: child >#*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§G child >#*WORD → CLASS [id*=WORD]', () => {
  test('cF>#*Mui-content → CLASS [id*=Mui-content]{color:#F}', () => {
    const mn = makeBase();
    mn.check('cF>#*Mui-content');
    expect(css(mn)).toBe('.cF\\>\\#\\*Mui-content [id*=Mui-content]{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §H: .*WORD + state
// ─────────────────────────────────────────────────────────────────────────────

describe('§H .*WORD + state (:hover)', () => {
  test('cF.*-active:hover → CLASS[class*=-active]:hover', () => {
    const mn = makeBase();
    mn.check('cF.*-active:hover');
    expect(css(mn)).toBe('.cF\\.\\*-active\\:hover[class*=-active]:hover{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §I: plain parent + child .*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§I plain parent <.cls + child >.*WORD', () => {
  test('cF<.parent>.*child-item → .parent CLASS [class*=child-item]', () => {
    const mn = makeBase();
    mn.check('cF<.parent>.*child-item');
    expect(css(mn)).toBe('.parent .cF\\<\\.parent\\>\\.\\*child-item [class*=child-item]{color:#F}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §J: .*WORD + @media
// ─────────────────────────────────────────────────────────────────────────────

describe('§J .*WORD + @media', () => {
  test('cF.*-active@sm → @media sm { CLASS[class*=-active] }', () => {
    const mn = makeBase();
    mn.check('cF.*-active@sm');
    expect(css(mn)).toBe('@media (max-width:640px){.cF\\.\\*-active\\@sm[class*=-active]{color:#F}}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §K: .*WORD + @media&selector combinator
// ─────────────────────────────────────────────────────────────────────────────

describe('§K .*WORD + @media&selector combinator', () => {
  test('cF.*-active@sm&safari → @media sm { .safari CLASS[class*=-active] }', () => {
    const mn = makeBase();
    mn.check('cF.*-active@sm&safari');
    expect(css(mn)).toBe('@media (max-width:640px){.safari .cF\\.\\*-active\\@sm&safari[class*=-active]{color:#F}}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §L: variant group (a|b).*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§L variant group (a|b).*WORD', () => {
  test('(cF|cA).*-active → два тела под одним CLASS[class*=-active]', () => {
    const mn = makeBase();
    mn.check('(cF|cA).*-active');
    const result = css(mn);
    expect(result).toContain('.\\(cF\\|cA\\)\\.\\*-active[class*=-active]{color:#F}');
    expect(result).toContain('.\\(cF\\|cA\\)\\.\\*-active[class*=-active]{color:#A}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §M: parent .*WORD + child .*WORD
// ─────────────────────────────────────────────────────────────────────────────

describe('§M parent <.*WORD + child >.*WORD', () => {
  test('cF<.*-active>.*MuiSlider → [class*=-active] CLASS [class*=MuiSlider]', () => {
    const mn = makeBase();
    mn.check('cF<.*-active>.*MuiSlider');
    expect(css(mn)).toBe('[class*=-active] .cF\\<\\.\\*-active\\>\\.\\*MuiSlider [class*=MuiSlider]{color:#F}');
  });
});
