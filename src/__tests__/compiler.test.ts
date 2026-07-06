// @ts-nocheck
/* eslint-disable */
import {
  parseLexeme, 
} from '../parser/parseLexeme';
import {
  compileSelector, compileClassName, compileStates, escapeCss, 
} from '../compiler/selectorCompiler';

// ─────────────────────────────────────────────────────────────────────────────
// escapeCss
// ─────────────────────────────────────────────────────────────────────────────

describe('escapeCss', () => {
  test('точка экранируется', () => {
    expect(escapeCss('.p10')).toBe('\\.p10');
  });

  test('двоеточие экранируется', () => {
    expect(escapeCss('cF00:h')).toBe('cF00\\:h');
  });

  test('угловые скобки экранируются', () => {
    expect(escapeCss('cF<.p')).toBe('cF\\<\\.p');
  });

  test('точки в имени класса', () => {
    expect(escapeCss('cF.38.active')).toBe('cF\\.38\\.active');
  });

  test('+ экранируется (self-class в имени класса)', () => {
    expect(escapeCss('cF+active')).toBe('cF\\+active');
  });

  test('+ и . вместе', () => {
    expect(escapeCss('cF.38+active')).toBe('cF\\.38\\+active');
  });
});

describe('compileSelector', () => {
  function sel(notation: string, target = '.el'): string {
    return compileSelector(parseLexeme(notation), target).replace(/\s+/g, ' ').trim();
  }

  test('без контекста — только target', () => {
    expect(sel('p10')).toBe('.el');
  });

  test('родитель без depth: <.p', () => {
    expect(sel('cF00<.p')).toBe('.p .el');
  });

  test('родитель с depth=1: <1.p', () => {
    expect(sel('cF00<1.p')).toBe('.p>.el');
  });

  test('родитель с depth=2: <2.p', () => {
    expect(sel('cF00<2.p')).toBe('.p>*>.el');
  });

  test('два родителя: <.p1<.p2', () => {
    expect(sel('cF00<.p1<.p2')).toBe('.p2 .p1 .el');
  });

  test('потомок без depth: >.c', () => {
    const result = sel('cF00>.c');
    expect(result).toBe('.el .c');
  });

  test('потомок с depth=1: >1.c', () => {
    expect(sel('cF00>1.c')).toBe('.el>.c');
  });

  test('смешанная цепочка: <.p>.c', () => {
    expect(sel('cF00<.p>.c')).toBe('.p .el .c');
  });
});

describe('compileClassName', () => {
  test('p10 — без спецсимволов', () => {
    expect(compileClassName(parseLexeme('p10'))).toBe('.p10');
  });

  test('cF00<.p — с экранированием угловой скобки', () => {
    const cn = compileClassName(parseLexeme('cF00<.p'));
    expect(cn).toContain('cF00');
    expect(cn).toContain('\\<');
  });

  // Имя класса всегда строится из raw-токена (включая dots, self-class суффиксы)
  test('cF.38 → .cF\\.38', () => {
    expect(compileClassName(parseLexeme('cF.38'))).toBe('.cF\\.38');
  });

  test('cF.active → .cF\\.active', () => {
    expect(compileClassName(parseLexeme('cF.active'))).toBe('.cF\\.active');
  });

  test('cF.38.active → .cF\\.38\\.active', () => {
    expect(compileClassName(parseLexeme('cF.38.active'))).toBe('.cF\\.38\\.active');
  });

  test('bgcF.12.active → .bgcF\\.12\\.active', () => {
    expect(compileClassName(parseLexeme('bgcF.12.active'))).toBe('.bgcF\\.12\\.active');
  });
});

describe('compileStates', () => {
  test('без состояний — пусто', () => {
    expect(compileStates(parseLexeme('p10'))).toBe('');
  });

  test(':h без синонима', () => {
    expect(compileStates(parseLexeme('cF00:h'))).toBe(':h');
  });

  test(':h с синонимом', () => {
    expect(compileStates(parseLexeme('cF00:h'), {
      h: ':hover', 
    })).toBe(':hover');
  });

  test(':nth-child[2] с синонимом', () => {
    expect(compileStates(parseLexeme('cF00:n[2]'), {
      n: ':nth-child', 
    })).toBe(':nth-child(2)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-class условия в полном селекторе (интеграция compileClassName + selfClasses)
//
// Сборка targetName происходит в MnInstance, здесь проверяем sub-компоненты.
// ─────────────────────────────────────────────────────────────────────────────

describe('self-class — имя класса и self-class условие', () => {
  // Хелпер: эмулирует то, что делает MnInstance при сборке targetName
  function buildTarget(token: string): string {
    const l = parseLexeme(token);
    const selfClassSuffix = l.selfClasses.join('');
    const states = compileStates(l);
    return compileClassName(l) + selfClassSuffix + states;
  }

  test('cF — без self-class', () => {
    expect(buildTarget('cF')).toBe('.cF');
  });

  test('cF.38 — opacity суффикс, не self-class', () => {
    expect(buildTarget('cF.38')).toBe('.cF\\.38');
  });

  test('cF.active → .cF\\.active.active', () => {
    expect(buildTarget('cF.active')).toBe('.cF\\.active.active');
  });

  test('cF.38.active → .cF\\.38\\.active.active', () => {
    expect(buildTarget('cF.38.active')).toBe('.cF\\.38\\.active.active');
  });

  test('bgcF.12.active → .bgcF\\.12\\.active.active', () => {
    expect(buildTarget('bgcF.12.active')).toBe('.bgcF\\.12\\.active.active');
  });

  test('cF.active.paused → .cF\\.active\\.paused.active.paused', () => {
    expect(buildTarget('cF.active.paused')).toBe('.cF\\.active\\.paused.active.paused');
  });

  test('mt15.active → .mt15\\.active.active', () => {
    expect(buildTarget('mt15.active')).toBe('.mt15\\.active.active');
  });

  // self-class идёт ДО псевдокласса
  // Имя класса включает ПОЛНЫЙ raw-токен (с экранированным ':hover'),
  // self-class добавляется ПОСЛЕ имени, ДО состояния.
  test('cF.active:hover → .cF\\.active\\:hover.active:hover', () => {
    // raw = 'cF.active:hover', поэтому класс = '.cF\.active\:hover'
    // self-class = '.active', state = ':hover'
    expect(buildTarget('cF.active:hover')).toBe('.cF\\.active\\:hover.active:hover');
  });

  test('cF.active:h с синонимом h=:hover → …\\:h.active:hover', () => {
    const l = parseLexeme('cF.active:h');
    const selfClassSuffix = l.selfClasses.join('');
    const states = compileStates(l, {
      h: ':hover', 
    });
    const target = compileClassName(l) + selfClassSuffix + states;
    // raw = 'cF.active:h', класс = '.cF\.active\:h', selfClass='.active', state=':hover'
    expect(target).toBe('.cF\\.active\\:h.active:hover');
  });

  // self-class + parent context → parent применяется вокруг полного targetName.
  // Имя класса включает '<.parent' (raw-токен), поэтому класс содержит '\<\.parent'.
  test('cF.active<.parent: контекстный селектор с родителем', () => {
    const l = parseLexeme('cF.active<.parent');
    const selfClassSuffix = l.selfClasses.join('');
    const states = compileStates(l);
    const target = compileClassName(l) + selfClassSuffix + states;
    // raw = 'cF.active<.parent' → class = '.cF\.active\<\.parent'
    const full = compileSelector(l, target).replace(/\s+/g, ' ').trim();
    expect(full).toBe('.parent .cF\\.active\\<\\.parent.active');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Self-class условия через '+' (adjacent sibling)
// ─────────────────────────────────────────────────────────────────────────────

describe('self-class (+WORD) — имя класса и adjacent sibling условие', () => {
  function buildTarget(token: string): string {
    const l = parseLexeme(token);
    const selfClassSuffix = l.selfClasses.join('');
    const states = compileStates(l);
    return compileClassName(l) + selfClassSuffix + states;
  }

  test('cF+38 — числовой суффикс, не self-class', () => {
    // +38 → часть аргумента, класс остаётся cF+38
    expect(buildTarget('cF+38')).toBe('.cF\\+38');
  });

  test('cF+active → .cF\\+active+active', () => {
    // +active → self-class, adjacent sibling в CSS
    expect(buildTarget('cF+active')).toBe('.cF\\+active+active');
  });

  test('bgcF+12+active → .bgcF\\+12\\+active+active', () => {
    // +12 → arg, +active → self-class
    expect(buildTarget('bgcF+12+active')).toBe('.bgcF\\+12\\+active+active');
  });

  test('cF.38+active → .cF\\.38\\+active+active', () => {
    // .38 → opacity в arg, +active → self-class
    expect(buildTarget('cF.38+active')).toBe('.cF\\.38\\+active+active');
  });

  test('cF+active+paused → .cF\\+active\\+paused+active+paused', () => {
    // два +WORD условия
    expect(buildTarget('cF+active+paused')).toBe('.cF\\+active\\+paused+active+paused');
  });

  test('compileClassName cF+active → .cF\\+active', () => {
    expect(compileClassName(parseLexeme('cF+active'))).toBe('.cF\\+active');
  });

  test('compileClassName bgcF+12+active → .bgcF\\+12\\+active', () => {
    expect(compileClassName(parseLexeme('bgcF+12+active'))).toBe('.bgcF\\+12\\+active');
  });
});
