import {
  parseLexeme, 
} from '../parser/parseLexeme';
import {
  splitStem, extractSelfClasses, 
} from '../parser/splitStem';

// ─────────────────────────────────────────────────────────────────────────────
// Хелперы для компактных таблиц
// ─────────────────────────────────────────────────────────────────────────────

function stem(raw: string) {
  return splitStem(raw);
}
/** selfClasses теперь в ParsedLexeme, не в Stem — проверяем через extractSelfClasses */
function selfCls(raw: string) {
  return extractSelfClasses(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// splitStem — базовый разбор тег/арг
// ─────────────────────────────────────────────────────────────────────────────

describe('splitStem — базовый разбор', () => {
  test.each([
    [
      'ph10',
      'ph',
      '10',
    ],
    [
      'bgF00',
      'bg',
      'F00',
    ],
    [
      'cF',
      'c',
      'F',
    ],
    [
      'c',
      'c',
      '',
    ],
    [
      'mt15',
      'mt',
      '15',
    ],
    [
      'bgcF',
      'bgc',
      'F',
    ],
    [
      'ff_mono',
      'ff',
      '_mono',
    ],
    [
      'lh1',
      'lh',
      '1',
    ],
    [
      'dn',
      'dn',
      '',
    ],
    [
      'sq32',
      'sq',
      '32',
    ],
  ])('%s → tag=%s, arg=%s', (
    raw, expectedTag, expectedArg,
  ) => {
    const s = stem(raw);
    expect(s.tag).toBe(expectedTag);
    expect(s.arg).toBe(expectedArg);
    expect(selfCls(raw)).toEqual([]);
    expect(s.important).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// splitStem — числовой суффикс через точку (НЕ self-class, часть аргумента)
// ─────────────────────────────────────────────────────────────────────────────

describe('splitStem — .DIGIT суффиксы остаются в аргументе', () => {
  test.each([
    [
      'cF.38',
      'c',
      'F.38',
      [],
    ],
    [
      'cF.5',
      'c',
      'F.5',
      [],
    ],
    [
      'bgcF.12',
      'bgc',
      'F.12',
      [],
    ],
    [
      'cF00.5',
      'c',
      'F00.5',
      [],
    ],
    [
      'cFF0000.5',
      'c',
      'FF0000.5',
      [],
    ],
    [
      'cF.38.12',
      'c',
      'F.38.12',
      [],
    ],  // оба числа → всё в arg
  ])('%s → arg=%s, selfClasses=%j', (
    raw, _tag, expectedArg, expectedSelf,
  ) => {
    const s = stem(raw);
    expect(s.arg).toBe(expectedArg);
    expect(selfCls(raw)).toEqual(expectedSelf);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// splitStem — +DIGIT суффиксы остаются в аргументе (симметрично .DIGIT)
// ─────────────────────────────────────────────────────────────────────────────

describe('splitStem — +DIGIT суффиксы остаются в аргументе', () => {
  test.each([
    [
      'cF+38',
      'c',
      'F+38',
      [],
    ],
    [
      'cF+5',
      'c',
      'F+5',
      [],
    ],
    [
      'bgcF+12',
      'bgc',
      'F+12',
      [],
    ],
    [
      'cF+38+12',
      'c',
      'F+38+12',
      [],
    ],  // оба числа → всё в arg
  ])('%s → arg=%s, selfClasses=%j', (
    raw, _tag, expectedArg, expectedSelf,
  ) => {
    const s = stem(raw);
    expect(s.arg).toBe(expectedArg);
    expect(selfCls(raw)).toEqual(expectedSelf);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// splitStem — +WORD self-class условия (adjacent sibling)
// ─────────────────────────────────────────────────────────────────────────────

describe('splitStem — self-class условия (+WORD...)', () => {
  test('cF+active → arg=F, selfClasses=[+active]', () => {
    const s = stem('cF+active');
    expect(s.tag).toBe('c');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['+active']);
    expect(s.important).toBe(false);
  });

  test('cF+paused → arg=F, selfClasses=[+paused]', () => {
    const s = stem('cF+paused');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['+paused']);
  });

  test('bgcF+12+active → arg=F+12, selfClasses=[+active]', () => {
    const s = stem('bgcF+12+active');
    expect(s.tag).toBe('bgc');
    expect(s.arg).toBe('F+12');
    expect(selfCls(s.raw)).toEqual(['+active']);
  });

  test('cF.38+active → arg=F.38, selfClasses=[+active] (mixed . and +)', () => {
    const s = stem('cF.38+active');
    expect(s.arg).toBe('F.38');
    expect(selfCls(s.raw)).toEqual(['+active']);
  });

  test('cF+active.hover → arg=F, selfClasses=[+active, .hover] (mixed + then .)', () => {
    const s = stem('cF+active.hover');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['+active', '.hover']);
  });

  test('cF+active+paused → arg=F, selfClasses=[+active, +paused]', () => {
    const s = stem('cF+active+paused');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['+active', '+paused']);
  });

  test('mt15+active → arg=15, selfClasses=[+active]', () => {
    const s = stem('mt15+active');
    expect(s.arg).toBe('15');
    expect(selfCls(s.raw)).toEqual(['+active']);
  });
});

describe('splitStem — +WORD + important флаг', () => {
  // Правильная форма: -i ДО self-class (cF-i+active)
  test('cF-i+active → arg=F, selfClasses=[+active], important=true', () => {
    const s = stem('cF-i+active');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['+active']);
    expect(s.important).toBe(true);
  });

  // -i ПОСЛЕ +WORD — часть имени self-class, НЕ флаг important
  test('cF+active-i → selfClasses=[+active-i], important=false', () => {
    const s = stem('cF+active-i');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['+active-i']);
    expect(s.important).toBe(false);
  });

  test('bgcF+12+active-i → selfClasses=[+active-i], important=false', () => {
    const s = stem('bgcF+12+active-i');
    expect(s.arg).toBe('F+12');
    expect(selfCls(s.raw)).toEqual(['+active-i']);
    expect(s.important).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// splitStem — self-class условия
// ─────────────────────────────────────────────────────────────────────────────

describe('splitStem — self-class условия (.LETTER...)', () => {
  test('cF.active → arg=F, selfClasses=[.active]', () => {
    const s = stem('cF.active');
    expect(s.tag).toBe('c');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['.active']);
    expect(s.important).toBe(false);
  });

  test('mt15.active → arg=15, selfClasses=[.active]', () => {
    const s = stem('mt15.active');
    expect(s.arg).toBe('15');
    expect(selfCls(s.raw)).toEqual(['.active']);
  });

  test('bgcF.12.active → arg=F.12, selfClasses=[.active]', () => {
    const s = stem('bgcF.12.active');
    expect(s.tag).toBe('bgc');
    expect(s.arg).toBe('F.12');
    expect(selfCls(s.raw)).toEqual(['.active']);
  });

  test('cF.38.active → arg=F.38, selfClasses=[.active]', () => {
    const s = stem('cF.38.active');
    expect(s.arg).toBe('F.38');
    expect(selfCls(s.raw)).toEqual(['.active']);
  });

  test('cF.38.active.hover → arg=F.38, selfClasses=[.active, .hover]', () => {
    const s = stem('cF.38.active.hover');
    expect(s.arg).toBe('F.38');
    expect(selfCls(s.raw)).toEqual(['.active', '.hover']);
  });

  test('cF.active.hover → arg=F, selfClasses=[.active, .hover]', () => {
    const s = stem('cF.active.hover');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['.active', '.hover']);
  });

  test('cF.paused → arg=F, selfClasses=[.paused]', () => {
    const s = stem('cF.paused');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['.paused']);
  });

  test('dn150.paused → tag=dn, arg=150, selfClasses=[.paused]', () => {
    const s = stem('dn150.paused');
    expect(s.tag).toBe('dn');
    expect(s.arg).toBe('150');
    expect(selfCls(s.raw)).toEqual(['.paused']);
  });

  test('crP.active → tag=cr, arg=P, selfClasses=[.active]', () => {
    // 'P' перед точкой: firstAfterDot='a' (буква) → .active — self-class
    const s = stem('crP.active');
    expect(s.tag).toBe('cr');
    expect(s.arg).toBe('P');
    expect(selfCls(s.raw)).toEqual(['.active']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// splitStem — комбинации с -i (important)
// ─────────────────────────────────────────────────────────────────────────────

describe('splitStem — important флаг', () => {
  test('ph10-i → arg=10, important=true, selfClasses=[]', () => {
    const s = stem('ph10-i');
    expect(s.arg).toBe('10');
    expect(s.important).toBe(true);
    expect(selfCls(s.raw)).toEqual([]);
  });

  // Правильная форма: -i ДО self-class (cF-i.active)
  test('cF-i.active → arg=F, selfClasses=[.active], important=true', () => {
    const s = stem('cF-i.active');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['.active']);
    expect(s.important).toBe(true);
  });

  test('cF.38-i.active → arg=F.38, selfClasses=[.active], important=true', () => {
    const s = stem('cF.38-i.active');
    expect(s.arg).toBe('F.38');
    expect(selfCls(s.raw)).toEqual(['.active']);
    expect(s.important).toBe(true);
  });

  // -i ПОСЛЕ .WORD — часть имени self-class, НЕ флаг important
  test('cF.active-i → selfClasses=[.active-i], important=false', () => {
    const s = stem('cF.active-i');
    expect(s.arg).toBe('F');
    expect(selfCls(s.raw)).toEqual(['.active-i']);
    expect(s.important).toBe(false);
  });

  test('cF.38.active-i → selfClasses=[.active-i], important=false', () => {
    const s = stem('cF.38.active-i');
    expect(s.arg).toBe('F.38');
    expect(selfCls(s.raw)).toEqual(['.active-i']);
    expect(s.important).toBe(false);
  });

  test('p-i → arg="", important=true', () => {
    const s = stem('p-i');
    expect(s.arg).toBe('');
    expect(s.important).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLexeme
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLexeme', () => {
  test('простая лексема без контекста: p10', () => {
    const l = parseLexeme('p10');
    expect(l.stem.tag).toBe('p');
    expect(l.stem.arg).toBe('10');
    expect(l.selfClasses).toEqual([]);
    expect(l.context).toEqual([]);
    expect(l.stemMedia).toBeNull();
  });

  test('стем + состояние: cF00:h', () => {
    const l = parseLexeme('cF00:h');
    expect(l.stem.tag).toBe('c');
    expect(l.stem.arg).toBe('F00');
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'state',
      name: 'h',
      args: null, 
    });
  });

  test('стем + родитель: cF00<.p', () => {
    const l = parseLexeme('cF00<.p');
    expect(l.stem.tag).toBe('c');
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p', 
    });
  });

  test('стем + родитель с depth: cF00<1.p', () => {
    const l = parseLexeme('cF00<1.p');
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 1,
      selector: '.p', 
    });
  });

  test('стем + медиа: cF00@m', () => {
    const l = parseLexeme('cF00@m');
    expect(l.stemMedia).toBe('m');
  });

  test('стем + медиа + родитель: cF00@m<.p', () => {
    const l = parseLexeme('cF00@m<.p');
    expect(l.stemMedia).toBe('m');
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p', 
    });
  });

  test('множитель: cF00*2', () => {
    const l = parseLexeme('cF00*2');
    expect(l.multiplier).toBe(2);
  });

  test('множитель с контекстом: cF00<.p*2', () => {
    const l = parseLexeme('cF00<.p*2');
    expect(l.multiplier).toBe(2);
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p', 
    });
  });

  test('цепочка родителей: cF00<.p1<.p2', () => {
    const l = parseLexeme('cF00<.p1<.p2');
    expect(l.context).toHaveLength(2);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p1', 
    });
    expect(l.context[1]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p2', 
    });
  });

  test('смешанная цепочка: cF00<.p>.c', () => {
    const l = parseLexeme('cF00<.p>.c');
    expect(l.context).toHaveLength(2);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p', 
    });
    expect(l.context[1]).toEqual({
      kind: 'child',
      depth: 0,
      selector: '.c', 
    });
  });

  test('состояние + родитель: cF00:h<.p', () => {
    const l = parseLexeme('cF00:h<.p');
    expect(l.context).toHaveLength(2);
    expect(l.context[0]).toEqual({
      kind: 'state',
      name: 'h',
      args: null, 
    });
    expect(l.context[1]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p', 
    });
  });

  test('родитель + состояние: cF00<.p:h', () => {
    const l = parseLexeme('cF00<.p:h');
    expect(l.context).toHaveLength(2);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.p', 
    });
    expect(l.context[1]).toEqual({
      kind: 'state',
      name: 'h',
      args: null, 
    });
  });

  test('функциональный псевдокласс: cF00:nth-child[2]', () => {
    const l = parseLexeme('cF00:nth-child[2]');
    expect(l.context).toHaveLength(1);
    const seg = l.context[0] as { kind: string;
name: string;
args: string | null };
    expect(seg.kind).toBe('state');
    expect(seg.name).toBe('nth-child');
    expect(seg.args).toBe('2');
  });

  test('пустой контекст (только стем)', () => {
    const l = parseLexeme('cF00');
    expect(l.stem.raw).toBe('cF00');
    expect(l.context).toEqual([]);
    expect(l.stemMedia).toBeNull();
    expect(l.multiplier).toBeNull();
  });

  test('-i флаг в аргументе: p10-i', () => {
    const l = parseLexeme('p10-i');
    expect(l.stem.tag).toBe('p');
    expect(l.stem.arg).toBe('10');
    expect(l.stem.important).toBe(true);
  });

  test('-i с контекстом: p10-i<.parent', () => {
    const l = parseLexeme('p10-i<.parent');
    expect(l.stem.important).toBe(true);
    expect(l.stem.arg).toBe('10');
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.parent', 
    });
  });

  // === Edge-кейсы ===
  test('пустая строка → ошибка', () => {
    expect(() => parseLexeme('')).toThrow('Invalid stem');
  });

  test('только дефис → ошибка', () => {
    expect(() => parseLexeme('-')).toThrow('Invalid stem');
  });

  test('--var обрабатывается в compile(), не в parseLexeme', () => {
    expect(() => parseLexeme('--bgColor=#F00')).toThrow('Invalid stem');
  });

  test('стем с подчёркиванием: ff_monospace', () => {
    const l = parseLexeme('ff_monospace');
    expect(l.stem.tag).toBe('ff');
  });

  test('множитель без числа: cF00* → multiplier=null', () => {
    const l = parseLexeme('cF00*');
    expect(l.stem.tag).toBe('c');
    expect(l.multiplier).toBeNull();
  });

  test('несколько токенов — parseLexeme не разбивает по пробелам', () => {
    // Разбиение по пробелам — ответственность MnInstance.check(),
    // parseLexeme разбирает строку как один токен.
    const l = parseLexeme('p10 cF00 m5');
    expect(l.stem.tag).toBe('p');
    // Всё после тега идёт в arg (включая пробелы)
  });

  test('-i в конце без аргумента: p-i', () => {
    const l = parseLexeme('p-i');
    expect(l.stem.tag).toBe('p');
    expect(l.stem.important).toBe(true);
    expect(l.stem.arg).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLexeme — self-class с контекстом
// ─────────────────────────────────────────────────────────────────────────────

describe('parseLexeme — self-class + контекст', () => {
  test('cF.active без контекста', () => {
    const l = parseLexeme('cF.active');
    expect(l.stem.tag).toBe('c');
    expect(l.stem.arg).toBe('F');
    expect(l.selfClasses).toEqual(['.active']);
    expect(l.context).toEqual([]);
  });

  test('cF.active:hover — self-class + pseudo-state', () => {
    const l = parseLexeme('cF.active:hover');
    expect(l.selfClasses).toEqual(['.active']);
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'state',
      name: 'hover',
      args: null, 
    });
  });

  test('cF.active<.parent — self-class + parent', () => {
    const l = parseLexeme('cF.active<.parent');
    expect(l.selfClasses).toEqual(['.active']);
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'parent',
      depth: 0,
      selector: '.parent', 
    });
  });

  test('bgcF.12.active@m — self-class + media', () => {
    const l = parseLexeme('bgcF.12.active@m');
    expect(l.stem.arg).toBe('F.12');
    expect(l.selfClasses).toEqual(['.active']);
    expect(l.stemMedia).toBe('m');
  });

  test('cF.38.active.paused — два self-class условия', () => {
    const l = parseLexeme('cF.38.active.paused');
    expect(l.stem.arg).toBe('F.38');
    expect(l.selfClasses).toEqual(['.active', '.paused']);
    expect(l.context).toEqual([]);
  });

  test('cF-i.active:hover — self-class + important + state', () => {
    const l = parseLexeme('cF-i.active:hover');
    expect(l.stem.arg).toBe('F');
    expect(l.selfClasses).toEqual(['.active']);
    expect(l.stem.important).toBe(true);
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'state',
      name: 'hover',
      args: null, 
    });
  });

  test('cF.active-i:hover — -i после self-class: часть имени класса, не important', () => {
    const l = parseLexeme('cF.active-i:hover');
    expect(l.stem.arg).toBe('F');
    expect(l.selfClasses).toEqual(['.active-i']);
    expect(l.stem.important).toBe(false);
    expect(l.context).toHaveLength(1);
    expect(l.context[0]).toEqual({
      kind: 'state',
      name: 'hover',
      args: null, 
    });
  });

  // Регрессия: обычные токены без self-class не должны измениться
  test('cF.38 — .38 остаётся в arg (не self-class)', () => {
    const l = parseLexeme('cF.38');
    expect(l.stem.arg).toBe('F.38');
    expect(l.selfClasses).toEqual([]);
  });

  test('cF.38:hover — .38 в arg, state в контексте', () => {
    const l = parseLexeme('cF.38:hover');
    expect(l.stem.arg).toBe('F.38');
    expect(l.selfClasses).toEqual([]);
    expect(l.context).toHaveLength(1);
  });
});
