/**
 * Snapshot-тесты для MN-компилятора.
 *
 * Фиксируют CSS-вывод для набора типовых селекторов.
 * При осознанном изменении поведения компилятора: jest --updateSnapshot.
 */

import {
  parseLexeme, 
} from '../parser/parseLexeme';
import {
  compileSelector, compileClassName, compileStates, 
} from '../compiler/selectorCompiler';

const BASIC_SELECTORS = [
  'cF00',
  'tDark',
  'm12',
  'cF00<.p',
  'cF00<.parent>1.child',
  'cF00<.a>.b',
  'cF00@m<.p:h',
  'tDark@t<.p',
  'cF00*2<.p',
  'cF00*3<.a>.b:h',
  'cF00:h',
  'cF00:f',
  'cF00:a',
  'cF00@m<.page>1.header>2.nav:a',
  'tLight@t<.root>1.body>2.container',
];

// Краевые: парсер бросает на невалидных
const EDGE_SELECTORS = [
  '',
  'x',
  '<.p',
  ':h',
  '*2',
];

const SYNONYMS: Record<string, string> = {
  h: ':hover',
  f: ':focus',
  a: ':active',
  v: ':visited',
  d: ':disabled',
  c: ':checked',
  fi: ':first-child',
  la: ':last-child',
  no: ':not(',
  no_: ')',
};

const TARGET = '.element';

function safeParse(raw: string) {
  try {
    return {
      ok: true,
      lexeme: parseLexeme(raw), 
    } as const;
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).message, 
    } as const;
  }
}

describe('compileSelector — снапшоты', () => {
  test('валидные селекторы', () => {
    const results = BASIC_SELECTORS.map((raw) => ({
      raw,
      css: compileSelector(parseLexeme(raw), TARGET),
    }));
    expect(results).toMatchSnapshot();
  });
});

describe('compileClassName — снапшоты', () => {
  test('валидные селекторы', () => {
    const results = BASIC_SELECTORS.map((raw) => ({
      raw,
      cls: compileClassName(parseLexeme(raw)),
    }));
    expect(results).toMatchSnapshot();
  });
});

describe('compileStates — снапшоты', () => {
  test('валидные селекторы (с синонимами)', () => {
    const results = BASIC_SELECTORS.map((raw) => ({
      raw,
      states: compileStates(parseLexeme(raw), SYNONYMS),
    }));
    expect(results).toMatchSnapshot();
  });
});

describe('Краевые случаи — ошибки парсера', () => {
  test('невалидный ввод бросает Error', () => {
    const results = EDGE_SELECTORS.map((raw) => safeParse(raw));
    expect(results).toMatchSnapshot();
  });
});

describe('Полный компилятор — снапшот', () => {
  test('тройной вывод для каждого селектора', () => {
    const results = BASIC_SELECTORS.map((raw) => {
      const lexeme = parseLexeme(raw);
      return {
        raw,
        className: compileClassName(lexeme),
        selector: compileSelector(lexeme, TARGET),
        states: compileStates(lexeme, SYNONYMS),
      };
    });
    expect(results).toMatchSnapshot();
  });
});
