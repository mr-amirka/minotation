/**
 * Комбинаторы глубины и проверка лимитов: жёсткий потолок `MN_MAX_DEPTH_HARD_LIMIT`
 * (всегда, не настраивается) и мягкий `maxDepth` в двух режимах — `'warn'`
 * (предупреждение, токен всё равно компилируется) и `'block'` (`MnParseError`).
 */
import {
  getCombinator,
  getCombinatorByDepth,
  MN_MAX_DEPTH_HARD_LIMIT,
  type MnDepthCheck,
} from '../selectorsCompileProvider/getCombinator';
import {
  MnParseError, 
} from '../core/types';

function makeDepthCheck(over: Partial<MnDepthCheck> = {}): MnDepthCheck & { calls: Array<[number, number]> } {
  const calls: Array<[number, number]> = [];
  return {
    maxDepth: 3,
    maxDepthMode: 'warn',
    token: 'testToken',
    onExceed: (depth, maxDepth) => {
      calls.push([depth, maxDepth]); 
    },
    calls,
    ...over,
  };
}

describe('getCombinatorByDepth', () => {
  test('0 — пустой комбинатор (потомок любой глубины)', () => {
    expect(getCombinatorByDepth(0)).toBe('');
  });

  test('1 — прямой потомок', () => {
    expect(getCombinatorByDepth(1)).toBe('>');
  });

  test('3 — цепочка через универсальный селектор', () => {
    expect(getCombinatorByDepth(3)).toBe('>*>*>');
  });

  test('глубина выше жёсткого потолка клэмпится к нему', () => {
    const atLimit = getCombinatorByDepth(MN_MAX_DEPTH_HARD_LIMIT);
    expect(getCombinatorByDepth(MN_MAX_DEPTH_HARD_LIMIT + 100)).toBe(atLimit);
  });
});

describe('getCombinator', () => {
  test('имя без числового префикса — комбинатор-пробел', () => {
    expect(getCombinator('Parent')).toEqual([' ', 'Parent']);
  });

  test('числовой префикс задаёт глубину', () => {
    expect(getCombinator('1Child')).toEqual(['>', 'Child']);
    expect(getCombinator('2Parent')).toEqual(['>*>', 'Parent']);
  });

  test('только число, без имени — вырожденная форма, бракуется (§14.3)', () => {
    // До 2026-09-24 давало ['>*>', ''] → селектор `*>*>`, то есть правило
    // цеплялось к любому предку. предупреждение и никакого
    // CSS. Отход от v1 сознательный, зафиксирован в §15 спеки.
    expect(() => getCombinator('2')).toThrow(MnParseError);
  });

  test.each([
    ['', 'пустой сегмент'],
    ['0', 'глубина 0 — склеивание классов'],
    ['-1', 'отрицательная глубина — инверсия направления'],
  ])('вырожденная форма %s (%s) бракуется', (name) => {
    expect(() => getCombinator(name)).toThrow(MnParseError);
  });

  test('глубина в пределах maxDepth — предупреждение не вызывается', () => {
    const check = makeDepthCheck();
    expect(getCombinator('3Parent', check)).toEqual(['>*>*>', 'Parent']);
    expect(check.calls).toEqual([]);
  });

  test('режим warn: предупреждение вызывается, комбинатор всё равно возвращается', () => {
    const check = makeDepthCheck();
    expect(getCombinator('5Parent', check)).toEqual(['>*>*>*>*>', 'Parent']);
    expect(check.calls).toEqual([[5, 3]]);
  });

  test('режим block: бросается MnParseError с контекстом токена', () => {
    const check = makeDepthCheck({
      maxDepthMode: 'block', 
    });
    let error: unknown;
    try {
      getCombinator('5Parent', check);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(MnParseError);
    expect((error as MnParseError).name).toBe('MnParseError');
    expect((error as MnParseError).message).toContain('maxDepth (3)');
    expect((error as MnParseError).context).toEqual({
      token: 'testToken',
      handler: '',
      arg: '5Parent',
      utility: 'getCombinator',
      // Тип задаётся явно, а не угадывается ловящей стороной по utility.
      warningType: 'max-depth-exceeded',
    });
    expect(check.calls).toEqual([]);
  });

  test('maxDepth не задан — мягкая проверка пропускается', () => {
    const check = makeDepthCheck({
      maxDepth: undefined, 
    });
    expect(getCombinator('40Parent', check)[0]).toBe(getCombinatorByDepth(MN_MAX_DEPTH_HARD_LIMIT));
    expect(check.calls).toEqual([]);
  });
});
