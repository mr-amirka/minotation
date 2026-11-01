/**
 * Математика в значении — `mathRules` / `mathValue` / `cssVarValue` ядра: термы, операторы, функции, группы,
 * переменные, единицы и знак по правилам свойства, прежняя запись переменной.
 */
import {
  cssVarValue,
  mathBareBegin,
  mathBareEnd,
  mathRules,
  mathValue,
  newVariables,
} from '../core/mathValue';
import {
  MnParseError,
} from '../core/types';
import minotationProvider from '../core/index';

const width = mathRules({
  name: 'w',
  unit: 'px',
  units: [
    'px',
    'rem',
    'vw',
    '%',
  ],
});
const margin = mathRules({
  name: 'm',
  unit: 'px',
  units: [
    'px',
    '%',
  ],
  negative: true,
});
const lineHeight = mathRules({
  name: 'lh',
  unit: '',
  units: [],
});
const border = mathRules({
  name: 'b',
  unit: 'px',
  units: ['px'],
});
/** Длинный список единиц — сообщение даёт образец, а не список. */
const indent = mathRules({
  name: 'ti',
  unit: 'px',
  units: 'px em rem ex ch vw vh vmin vmax %'.split(' '),
});

/** Сообщение ошибки разбора — или `undefined`, если значение прочиталось. */
function errorOf(expr: string, rules = width): string | undefined {
  try {
    mathValue(expr, rules);
  } catch (ex) {
    expect(ex).toBeInstanceOf(MnParseError);
    return (ex as Error).message;
  }
  return undefined;
}

describe('mathValue — термы и операторы', () => {
  test.each([
    [
      '10',
      '10px',
    ],
    [
      '1.5',
      '1.5px',
    ],
    [
      '.5',
      '.5px',
    ],
    [
      '0.5',
      '.5px',
    ],
    [
      '0',
      '0',
    ],
    [
      '0px',
      '0',
    ],
    [
      '10rem',
      '10rem',
    ],
    [
      '1/3',
      '33.33%',
    ],
    [
      '10-5',
      'calc(10px - 5px)',
    ],
    [
      '10+5',
      'calc(10px + 5px)',
    ],
    [
      '1/2+10',
      'calc(50% + 10px)',
    ],
    [
      '100%-2rem+10',
      'calc(100% - 2rem + 10px)',
    ],
    [
      '1rem+.5vw',
      'calc(1rem + .5vw)',
    ],
    [
      '0+5',
      'calc(0px + 5px)',
    ],
    [
      '10*2',
      'calc(10px * 2)',
    ],
    [
      '10*2/4',
      'calc(10px * 2 / 4)',
    ],
    [
      '10rem/2',
      'calc(10rem / 2)',
    ],
    [
      '1/2/2',
      'calc(50% / 2)',
    ],
    [
      '1/.5',
      '200%',
    ],
    [
      '1/3*2',
      'calc(33.33% * 2)',
    ],
    [
      '$a*1/2',
      'calc(var(--a) * 1 / 2)',
    ],
  ])('%s → %s', (expr, css) => {
    expect(mathValue(expr, width)).toBe(css);
  });
});

describe('mathValue — переменные', () => {
  test.each([
    [
      '$a',
      'var(--a)',
    ],
    [
      '$a+5',
      'calc(var(--a) + 5px)',
    ],
    [
      '$gap*2',
      'calc(var(--gap) * 2)',
    ],
    [
      '$w/3',
      'calc(var(--w) / 3)',
    ],
    [
      '100%-2*$gap',
      'calc(100% - 2 * var(--gap))',
    ],
    [
      '2*$a*.5',
      'calc(2 * var(--a) * .5)',
    ],
    [
      '$a*1.125',
      'calc(var(--a) * 1.125)',
    ],
    [
      '0*$a',
      'calc(0 * var(--a))',
    ],
    [
      '$a-10',
      'var(--a-10)',
    ],
    [
      '$a;-10',
      'calc(var(--a) - 10px)',
    ],
    [
      '$my_gap;',
      'var(--my_gap)',
    ],
    [
      '$btn--primary',
      'var(--btn--primary)',
    ],
    [
      '$цвет',
      'var(--цвет)',
    ],
    [
      '$a{10}',
      'var(--a, 10px)',
    ],
    [
      '$a{10+5}',
      'var(--a, calc(10px + 5px))',
    ],
    [
      '$a{$b{10}}',
      'var(--a, var(--b, 10px))',
    ],
    [
      '$a{0}+1',
      'calc(var(--a, 0px) + 1px)',
    ],
    [
      '$$safe-area-inset-top',
      'env(safe-area-inset-top)',
    ],
    [
      '$$x{0}',
      'env(x, 0px)',
    ],
    [
      '10+$$x',
      'calc(10px + env(x))',
    ],
  ])('%s → %s', (expr, css) => {
    expect(mathValue(expr, width)).toBe(css);
  });
});

describe('mathValue — функции и группы', () => {
  test.each([
    [
      'Min{100%,50rem}',
      'min(100%, 50rem)',
    ],
    [
      'Max{50vw,300}',
      'max(50vw, 300px)',
    ],
    [
      'Clamp{1rem,2.5vw+1rem,3rem}',
      'clamp(1rem, 2.5vw + 1rem, 3rem)',
    ],
    [
      'Min{100%,Max{50vw,300}}',
      'min(100%, max(50vw, 300px))',
    ],
    [
      'Min{Max{$a,$b},$c}',
      'min(max(var(--a), var(--b)), var(--c))',
    ],
    [
      'Min{$a{10},50rem}',
      'min(var(--a, 10px), 50rem)',
    ],
    [
      'Min{50rem,{100%-2rem}/3}',
      'min(50rem, (100% - 2rem) / 3)',
    ],
    [
      'Min{1,2}+10',
      'calc(min(1px, 2px) + 10px)',
    ],
    [
      '2*Min{1,2}',
      'calc(2 * min(1px, 2px))',
    ],
    [
      '{100%-2rem}/3',
      'calc((100% - 2rem) / 3)',
    ],
    // Группа на всё значение ничего не группирует — её скобки не пишутся.
    [
      '{10+5}',
      'calc(10px + 5px)',
    ],
    [
      '{10}',
      '10px',
    ],
    [
      '{1+2}*3',
      'calc((1px + 2px) * 3)',
    ],
    [
      '{10}*2',
      'calc((10px) * 2)',
    ],
  ])('%s → %s', (expr, css) => {
    expect(mathValue(expr, width)).toBe(css);
  });
});

describe('mathValue — знак', () => {
  test.each([
    [
      '-10',
      '-10px',
    ],
    [
      '-.5',
      '-.5px',
    ],
    [
      '-10+5',
      'calc(-10px + 5px)',
    ],
    [
      '10-$a',
      'calc(10px - var(--a))',
    ],
    [
      '-$a',
      'calc(var(--a) * -1)',
    ],
    [
      '-$a*2',
      'calc(var(--a) * 2 * -1)',
    ],
    [
      '-{1+2}',
      'calc((1px + 2px) * -1)',
    ],
    [
      '-Min{1,2}',
      'calc(min(1px, 2px) * -1)',
    ],
    [
      '-$a*-1',
      undefined,
    ],
    [
      '-0',
      '0',
    ],
  ])('%s → %s (минус допустим)', (expr, css) => {
    css === undefined
      ? expect(errorOf(expr, margin)).toBe('Value "-$a*-1" is invalid for "m": "-" after "-$a*" is not expected')
      : expect(mathValue(expr, margin)).toBe(css);
  });

  test('минус не допустим — первый терм; результат со знаком вычитания — можно', () => {
    expect(errorOf('-10+5')).toBe('Value "-10+5" is invalid: negative value is not allowed for this property');
    expect(errorOf('-$a')).toBe('Value "-$a" is invalid: negative value is not allowed for this property');
    expect(mathValue('10-20', width)).toBe('calc(10px - 20px)');
  });
});

describe('mathValue — единицы по правилам свойства', () => {
  test.each([
    [
      '1.5',
      '1.5',
    ],
    [
      '1.125',
      '1.125',
    ],
    [
      '1.5+.2',
      'calc(1.5 + .2)',
    ],
    [
      '-.5',
      '-.5',
    ],
    [
      '-1.5',
      '-1.5',
    ],
    [
      '2*-.5',
      undefined,
    ],
  ])('безразмерное: %s → %s', (expr, css) => {
    const rules = mathRules({
      name: 'z',
      unit: '',
      units: [],
      negative: true,
    });
    css === undefined
      ? expect(errorOf(expr, rules)).toBe('Value "2*-.5" is invalid for "z": "-" after "2*" is not expected')
      : expect(mathValue(expr, rules)).toBe(css);
    expect(mathValue('1.5', lineHeight)).toBe('1.5');
  });

  test('минус без терма', () => {
    expect(errorOf('-', margin)).toBe('Value "-" is invalid for "m": "-" needs a term after it');
  });

  test.each([
    [
      '1.5+2rem',
      lineHeight,
      'Value "1.5+2rem" is invalid for "lh": unit "rem" doesn\'t fit: the value is a plain number, as "1.5"',
    ],
    [
      '10s',
      width,
      'Value "10s" is invalid for "w": unit "s" doesn\'t fit: the units are px, rem, vw, %',
    ],
    [
      '0s',
      width,
      'Value "0s" is invalid for "w": unit "s" doesn\'t fit: the units are px, rem, vw, %',
    ],
    [
      '10zz',
      indent,
      'Value "10zz" is invalid for "ti": unit "zz" doesn\'t fit, as "10px"',
    ],
    [
      '10%+2',
      border,
      'Value "10%+2" is invalid: this property takes a length, percent is not allowed',
    ],
    [
      '1/2',
      border,
      'Value "1/2" is invalid: this property takes a length, percent is not allowed',
    ],
    [
      '0%',
      border,
      'Value "0%" is invalid: this property takes a length, percent is not allowed',
    ],
  ])('%s — %s', (
    expr, rules, message,
  ) => {
    expect(errorOf(expr, rules)).toBe(message);
  });
});

describe('mathValue — запись, которая не читается', () => {
  test.each([
    [
      '',
      'a value is expected',
    ],
    [
      '10+',
      '"+" needs a term after it',
    ],
    [
      '10*',
      '"*" needs a term after it',
    ],
    [
      '+5',
      '"+" is not expected'
        + ': a value starts with a number ("10"), a variable ("$x"), a function ("Min{…}") or a group ("{…}")',
    ],
    [
      '10++5',
      '"+" after "10+" is not expected',
    ],
    [
      '10}',
      '"}" after "10" is not expected',
    ],
    [
      '$a.5',
      '"." after "$a" is not expected',
    ],
    [
      '{10',
      '"{" is not closed',
    ],
    [
      '{10)',
      '")" after "{10" is not expected',
    ],
    [
      '1.2.3',
      '"1.2.3" is not a number',
    ],
    [
      '.',
      '"." is not a number',
    ],
    [
      '1/0',
      'a fraction can\'t have a zero total: "1/0"',
    ],
    [
      '1/3rem',
      'a fraction is a number over a number: "1/3" — the unit goes after the fraction is turned into a'
      + ' percent, so it isn\'t written',
    ],
    [
      '1/3%',
      'a fraction is a number over a number: "1/3" — the unit goes after the fraction is turned into a'
      + ' percent, so it isn\'t written',
    ],
    [
      '$',
      'a variable needs a name after "$": "$gap", "$$safe-area-inset-top"',
    ],
    [
      '$$',
      'a variable needs a name after "$$": "$gap", "$$safe-area-inset-top"',
    ],
    [
      '$a,10',
      'a fallback is written in braces: "$a{10}"',
    ],
    [
      '$a*2,10',
      '"," after "$a*2" is not expected',
    ],
    [
      'Min{100%}',
      '"Min" takes at least 2 arguments, got 1',
    ],
    [
      'Clamp{1,2}',
      '"Clamp" takes 3 arguments, got 2',
    ],
    [
      'Clamp{1,2,3,4}',
      '"Clamp" takes 3 arguments, got 4',
    ],
    [
      'Min{1,2',
      '"{" is not closed',
    ],
    [
      'Min{,1}',
      '"," after "Min{" is not expected',
    ],
    [
      'Foo{1,2}',
      'unknown function "Foo". Functions: Min, Max, Clamp',
    ],
    [
      'F00',
      '"F" is not expected'
        + ': a value starts with a number ("10"), a variable ("$x"), a function ("Min{…}") or a group ("{…}")',
    ],
    [
      '10+Foo',
      '"F" after "10+" is not expected',
    ],
    [
      'Calc{1+2}',
      'a sum is written without "Calc": "100%-2rem", a group in braces — "{100%-2rem}/3"',
    ],
    [
      'Min100%',
      'the arguments of "Min" are written in braces: "Min{100%,50rem}"',
    ],
  ])('%j — %s', (expr, reason) => {
    expect(errorOf(expr)).toBe('Value "' + expr + '" is invalid for "w": ' + reason);
  });
});

describe('mathValue — прежняя запись переменной', () => {
  test.each([
    [
      '--a+5',
      '$a+5',
    ],
    [
      '---a',
      '$$a',
    ],
    [
      '10---a',
      '10-$a',
    ],
    [
      '10+--a',
      '10+$a',
    ],
    [
      '--v,10px',
      '$v{10px}',
    ],
    [
      '--a;---b',
      '$a;-$b',
    ],
  ])('%s — CSS нет, сообщение с новой записью %s', (expr, replacement) => {
    expect(errorOf(expr)).toBe('"' + expr + '" was renamed: write "' + replacement + '" — a variable is "$name"'
      + ' (var), "$$name" (env), its fallback in braces: "$name{10px}". The old spelling gives no CSS.');
  });

  test('минус перед прежней переменной — не знак: сообщение о переименовании и там, где минус нельзя', () => {
    expect(errorOf('--a', border)).toContain('was renamed: write "$a"');
  });

  test.each([
    [
      '--a;--b',
      '$a$b',
    ],
    [
      'g--a;-00F',
      'g$a;-00F',
    ],
    [
      '--a_---b',
      '--a_---b'.replace('---', '$$$$').replace('--', '$'),
    ],
    [
      'gtc--a;,--b',
      'gtc$a,$b',
    ],
    [
      'bxsh--a,--b',
      'bxsh$a,$b',
    ],
    [
      'w--v,10px',
      'w$v{10px}',
    ],
    [
      'ff--mono,serif',
      'ff$mono{serif}',
    ],
  ])('newVariables(%s) → %s', (expr, replacement) => {
    expect(newVariables(expr)).toBe(replacement);
  });
});

describe('cssVarValue — значение целиком переменная', () => {
  test.each([
    [
      '$mono',
      'var(--mono)',
    ],
    [
      '$mono;',
      'var(--mono)',
    ],
    [
      '$$x',
      'env(x)',
    ],
    [
      '$mono{serif}',
      'var(--mono, serif)',
    ],
    [
      '$a{$b}',
      'var(--a, var(--b))',
    ],
    [
      '$$x{0}',
      'env(x, 0)',
    ],
    [
      '$a+5',
      undefined,
    ],
    [
      '$a{x',
      undefined,
    ],
    [
      '$',
      undefined,
    ],
    [
      'serif',
      undefined,
    ],
    [
      '-x',
      undefined,
    ],
    [
      '',
      undefined,
    ],
  ])('%j → %s', (s, css) => {
    expect(cssVarValue(s)).toBe(css);
  });

  test('прежняя запись — сообщение с новой', () => {
    expect(() => cssVarValue('--mono')).toThrow('"--mono" was renamed: write "$mono"');
  });
});

describe('mathValue — `{{`: группа в начале группы', () => {
  test.each([
    [
      '{{1+2}*3}',
      'calc((1px + 2px) * 3)',
    ],
    [
      'Min{{100%-2rem}/3,50rem}',
      'min((100% - 2rem) / 3, 50rem)',
    ],
    [
      '{{{1+2}}}',
      'calc(1px + 2px)',
    ],
  ])('%s → %s — интерполяция шаблонов — забота автора', (expr, css) => {
    expect(mathValue(expr, width)).toBe(css);
  });
});

/** Что собрал читатель за одно значение: пары «как написано», «выражение». */
function bareOf(
  expr: string, rules = width, written?: string,
): string[] {
  const outer = mathBareBegin();
  mathValue(
    expr, rules, written,
  );
  return mathBareEnd(outer);
}

describe('mathValue — математика без скобок для bareMathMode', () => {
  test.each([
    '1/2+32',
    '10-20',
    '$a*2',
    '10*2/4',
    '{1+2}*3',
    '3*{1+2}',
    'Min{1,2}+3',
  ])('%s — оператор вне скобок, значение собрано', (expr) => {
    expect(bareOf(expr)).toEqual([
      expr,
      expr,
    ]);
  });

  test.each([
    '10',
    '1/3',
    '{1/2+32}',
    '{3*{1+2}}',
    'Min{10+5,20%}',
    '$a{10+5}',
    '$a',
    'Clamp{1,2+3,4}',
  ])('%s — оператора вне скобок нет', (expr) => {
    expect(bareOf(expr)).toEqual([]);
  });

  test.each([
    '-10',
    '-$a',
  ])('%s — знак не математика', (expr) => {
    expect(bareOf(expr, margin)).toEqual([]);
  });

  test('как написано в токене — отдельно от выражения', () => {
    expect(bareOf(
      '$a*2', width, 'B$a*2',
    )).toEqual([
      'B$a*2',
      '$a*2',
    ]);
  });

  test('сбор вложенный: внутренний не теряет внешний', () => {
    const outer = mathBareBegin();
    mathValue('1+2', width);
    const inner = mathBareBegin();
    mathValue('3+4', width);
    expect([
      mathBareEnd(inner),
      mathBareEnd(outer),
    ]).toEqual([
      [
        '3+4',
        '3+4',
      ],
      [
        '1+2',
        '1+2',
      ],
    ]);
  });

  test('без сбора читатель ничего не копит', () => {
    mathValue('1+2', width);
    expect(mathBareBegin()).toBeUndefined();
    mathBareEnd(undefined);
  });

  test('ошибка в значении не оставляет глубину скобок следующему', () => {
    expect(errorOf('{1+')).toBeDefined();
    expect(bareOf('1+2')).toEqual([
      '1+2',
      '1+2',
    ]);
  });
});

describe('mathRules — опции проверяются при создании', () => {
  test.each([
    [
      {
        name: 'w',
        unit: 'px',
        units: ['px'],
        negativ: true,
      },
      'unknown option "negativ". Did you mean "negative"?',
    ],
    [
      {
        name: 'w',
        unit: 'px',
        units: 'px',
      },
      'option "units" expects an array of strings, got string "px"',
    ],
    [
      {
        name: 'w',
        unit: 'px',
      },
      'mathRules: option "units" is required, got undefined',
    ],
    [
      undefined,
      'mathRules: option "name" is required, got undefined',
    ],
    [
      {
        name: 'w',
        unit: 'em',
        units: ['px'],
      },
      'mathRules: "unit" expects one of "units", got "em"',
    ],
  ])('%j — %s', (options, message) => {
    expect(() => mathRules(options as never)).toThrow(message);
  });

  test('правила заморожены, единицы скопированы', () => {
    const units = ['px'];
    const rules = mathRules({
      name: 'w',
      unit: 'px',
      units,
    });
    units.push('rem');
    expect(Object.isFrozen(rules)).toBe(true);
    expect(rules.units).toEqual(['px']);
    expect(rules.negative).toBe(false);
  });

  test('доступны пресетам через mn.utils', () => {
    const mn = minotationProvider();
    const rules = mn.utils.mathRules({
      name: 'x',
      unit: 'px',
      units: ['px'],
    });
    expect(mn.utils.mathValue('10+$a', rules)).toBe('calc(10px + var(--a))');
    expect(mn.utils.cssVarValue('$a')).toBe('var(--a)');
  });
});
