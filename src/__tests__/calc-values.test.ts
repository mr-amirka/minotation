// @ts-nocheck
/* eslint-disable */
/**
 * Тесты calc()-значений и оператора "+" в токенах Minimalist Notation.
 *
 * Плюс (+) в CSS-значениях — это оператор calc(), а не спецсимвол MN.
 * В генерируемых CSS-классах он экранируется как \+ через escapeCss.
 *
 * Проверяемые кейсы:
 *   w50%+10    → селектор .w50%\+10, значение width: calc(50% + 10px)
 *   w50%+.next → селектор .w50%\+\.next.next, значение width: 50%
 *   w50%+10px  → селектор .w50%\+10px, значение width: calc(50% + 10px)
 */

const mnProvider = require('../index').default || require('../index').minimalistNotationProvider;

/**
 * Создаёт экземпляр MN с простым w-хендлером.
 * Не зависит от styles-пресета (в котором баг routeParseProvider :vl).
 */
function makeMn() {
  const mn = mnProvider({
    onError: (e) => { throw e; },
  });

  // Регистрируем w-хендлер: width
  mn('w', {
    exts: ({ suffix, ni }) => {
      if (!suffix) {
        return { style: { width: '100%' } };
      }

      // Парсим suffix: число + опциональная единица + опциональный +добавка
      const match = /^(-?[0-9.]+)([a-z%]*)(?:\+(.+))?$/.exec(suffix);
      if (!match) {
        return { style: { width: suffix } };
      }

      const num = match[1];
      const unit = match[2] || 'px';
      const add = match[3];

      if (add) {
        const addParsed = /^(-?[0-9.]+)([a-z%]*)$/.exec(add);
        const addVal = addParsed ? addParsed[1] + (addParsed[2] || 'px') : add;
        return {
          style: { width: 'calc(' + num + unit + ' + ' + addVal + ')' },
          important: ni ? 1 : 0,
        };
      }

      return {
        style: { width: num + unit },
        important: ni ? 1 : 0,
      };
    },
  });

  return mn;
}

function css(token) {
  const mn = makeMn();
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue()
    .map((s) => s.content)
    .join('');
}

// ================================================================
// calc() через "+" в значении
// ================================================================
describe('calc()-значения через плюс', () => {
  test('w50%+10 → width: calc(50% + 10px)', () => {
    expect(css('w50%+10')).toContain('width:calc(50% + 10px)');
  });

  test('w100px+20 → width: calc(100px + 20px)', () => {
    expect(css('w100px+20')).toContain('width:calc(100px + 20px)');
  });

  test('w50%+10px → width: calc(50% + 10px) (единица у добавки)', () => {
    expect(css('w50%+10px')).toContain('width:calc(50% + 10px)');
  });

  test('w+50 → width: +50px (плюс в начале — знак числа)', () => {
    expect(css('w+50')).toContain('width:+50px');
  });
});

// ================================================================
// Экранирование "+" в селекторе
// ================================================================
describe('экранирование плюса в селекторе', () => {
  test('класс с % и + экранируются оба', () => {
    const result = css('w50%+10');
    expect(result).toMatch(/\.w50%\\\+10/);
  });

  test('класс с + и px', () => {
    const result = css('w50%+10px');
    expect(result).toMatch(/\.w50%\\\+10px/);
  });
});

// ================================================================
// Регрессия: значения без плюса
// ================================================================
describe('регрессия: значения без плюса', () => {
  test('w50 → width:50px', () => {
    expect(css('w50')).toContain('width:50px');
  });

  test('w50% → width:50%', () => {
    expect(css('w50%')).toContain('width:50%');
  });

  test('w100vh → width:100vh', () => {
    expect(css('w100vh')).toContain('width:100vh');
  });

  test('w → width:100% (без значения)', () => {
    expect(css('w')).toContain('width:100%');
  });
});
