/**
 * Утилита слияния токенов — `mne` / `mnClass` / `mnMap` / `mnKey`.
 *
 * Проверяется главное свойство: переопределение выигрывает БЕЗ повышения
 * специфичности — перекрытый токен просто не попадает в атрибут.
 */
import {
  mne, mnClass, mnKey, mnMap,
} from '../mne';
import {
  REGEXP_SELECTOR_EXCEPTIONS,
} from '../selectorsCompileProvider/constants';

describe('mne — базовый сценарий', () => {
  test('переопределение вытесняет базовый токен того же тега', () => {
    expect(mne('f20 dB bgC', 'f24 bg4')).toBe('dB f24 bg4');
  });

  test('непересекающиеся токены сохраняются оба', () => {
    expect(mne('f20 dB', 'p10')).toBe('f20 dB p10');
  });

  test('пустое переопределение возвращает базу как есть', () => {
    expect(mne('f20 dB bgC')).toBe('f20 dB bgC');
    expect(mne('f20 dB bgC', undefined)).toBe('f20 dB bgC');
    expect(mne('f20 dB bgC', null)).toBe('f20 dB bgC');
    expect(mne('f20 dB bgC', '')).toBe('f20 dB bgC');
  });

  test('пустая база возвращает переопределение', () => {
    expect(mne('', 'f24')).toBe('f24');
    expect(mne(undefined, 'f24')).toBe('f24');
    expect(mne(null, null)).toBe('');
  });

  test('несколько переопределений: чем правее, тем выше приоритет', () => {
    expect(mne(
      'f20', 'f24', 'f28',
    )).toBe('f28');
  });

  test('повтор внутри одной строки: побеждает последний', () => {
    expect(mne('f20 f24')).toBe('f24');
  });

  test('лишние пробелы не дают пустых токенов', () => {
    expect(mne('  f20   dB  ', '  f24 ')).toBe('dB f24');
  });

  test('порядок оставшихся токенов сохраняется', () => {
    expect(mne('p10 f20 dB bgC m4', 'f24')).toBe('p10 dB bgC m4 f24');
  });
});

describe('mne — контекст входит в ключ', () => {
  test.each([
    [
      'медиа',
      'f20',
      'f24@sm',
      'f20 f24@sm',
    ],
    [
      'состояние',
      'cF00',
      'c00F:hover',
      'cF00 c00F:hover',
    ],
    [
      'предок',
      'p10',
      'p12<.parent',
      'p10 p12<.parent',
    ],
    [
      'прямой потомок',
      'p10',
      'p12>.child',
      'p10 p12>.child',
    ],
    [
      'условие-класс',
      'cF00',
      'c00F.active',
      'cF00 c00F.active',
    ],
  ])('%s: разные контексты — оба токена остаются', (
    _name, base, override, expected,
  ) => {
    expect(mne(base, override)).toBe(expected);
  });

  test.each([
    [
      'один медиа-контекст',
      'f20@sm',
      'f24@sm',
      'f24@sm',
    ],
    [
      'одно состояние',
      'cF00:hover',
      'c00F:hover',
      'c00F:hover',
    ],
    [
      'один предок',
      'p10<.parent',
      'p12<.parent',
      'p12<.parent',
    ],
  ])('%s: переопределение срабатывает', (
    _name, base, override, expected,
  ) => {
    expect(mne(base, override)).toBe(expected);
  });

  test('`!important` не вытесняется обычным токеном', () => {
    // В CSS `!important` побеждает независимо от порядка — убирать базу нельзя.
    expect(mne('p10-i', 'p12')).toBe('p10-i p12');
  });

  test('`!important` вытесняется другим `!important`', () => {
    expect(mne('p10-i', 'p12-i')).toBe('p12-i');
  });
});

describe('mne — значения, похожие на границу контекста', () => {
  test.each([
    [
      'десятичное значение',
      'f1.5em',
      'f2em',
      'f2em',
    ],
    [
      'слагаемое-число',
      'w10+5',
      'w20',
      'w20',
    ],
    [
      'слагаемое-переменная',
      'w10+--a',
      'w20',
      'w20',
    ],
    [
      'hex после решётки',
      'bg#F00',
      'bg#00F',
      'bg#00F',
    ],
    [
      'экранированная точка',
      'bgi_img/a\\.png',
      'bgi_img/b\\.png',
      'bgi_img/b\\.png',
    ],
  ])('%s не принимается за контекст', (
    _name, base, override, expected,
  ) => {
    expect(mne(base, override)).toBe(expected);
  });

  test('альфа через точку — это значение, а не условие-класс', () => {
    expect(mne('cF00.5', 'c00F.5')).toBe('c00F.5');
  });
});

describe('mne — чужие классы проходят насквозь', () => {
  test.each([
    [
      'tailwind-кебаб',
      'btn f20',
      'btn-primary f24',
      'btn btn-primary f24',
    ],
    [
      'utility-кебаб',
      'text-center f20',
      'text-left f24',
      'text-center text-left f24',
    ],
    [
      'семантический класс',
      'card f20',
      'active f24',
      'card active f24',
    ],
  ])('%s', (
    _name, base, override, expected,
  ) => {
    expect(mne(base, override)).toBe(expected);
  });

  test('кебаб не путается с отрицательным значением', () => {
    // `mt-10` — это MN (отрицательный margin), `mt-auto` — чужой класс.
    expect(mnKey('mt-10')).toBe('mt');
    expect(mnKey('mt-auto')).toBe('mt-auto');
    expect(mne('mt-10', 'mt4')).toBe('mt4');
    expect(mne('mt-auto', 'mt4')).toBe('mt-auto mt4');
  });

  test('объявление переменной отменяет только само себя', () => {
    expect(mnKey('--gap=10px')).toBe('--gap=10px');
    expect(mne('--gap=10px p10', 'p12')).toBe('--gap=10px p12');
  });

  test('одинаковый чужой класс не дублируется', () => {
    expect(mne('active btn', 'btn')).toBe('active btn');
  });
});

describe('mnKey', () => {
  test.each([
    ['f20', 'f'],
    ['f24@sm', 'f@sm'],
    ['cF00:hover', 'c:hover'],
    ['p10<.parent', 'p<.parent'],
    ['p10-i', 'p-i'],
    ['bgC', 'bg'],
    ['dB', 'd'],
    ['text-center', 'text-center'],
    ['someClass', 'some'],
  ])('%s → %s', (token, expected) => {
    expect(mnKey(token)).toBe(expected);
  });
});

describe('mnClass — предвычисленная база', () => {
  test('даёт тот же результат, что mne', () => {
    const textAClass = mnClass('f20 dB bgC');

    expect(textAClass('f24 bg4')).toBe(mne('f20 dB bgC', 'f24 bg4'));
    expect(textAClass()).toBe('f20 dB bgC');
    expect(textAClass(undefined)).toBe('f20 dB bgC');
  });

  test('база не портится между вызовами', () => {
    const textAClass = mnClass('f20 dB');

    expect(textAClass('f24')).toBe('dB f24');
    expect(textAClass('f28')).toBe('dB f28');
    expect(textAClass()).toBe('f20 dB');
  });

  test('принимает несколько переопределений', () => {
    expect(mnClass('f20')('f24', 'f28')).toBe('f28');
  });

  test('пустая база', () => {
    expect(mnClass()('f24')).toBe('f24');
    expect(mnClass('')()).toBe('');
  });
});

describe('mnMap — разобранные токены для фреймворка', () => {
  test('форма из примера владельца', () => {
    expect(mnMap('f24 bg4 active someClass')).toEqual({
      f: '24',
      bg: '4',
      active: '',
      some: 'Class',
    });
  });

  test('контекст попадает в ключ, значение остаётся чистым', () => {
    expect(mnMap('f24@sm p10-i cF00:hover')).toEqual({
      'f@sm': '24',
      'p-i': '10',
      'c:hover': 'F00',
    });
  });

  test('пустой вход', () => {
    expect(mnMap()).toEqual({});
    expect(mnMap('')).toEqual({});
  });
});

/**
 * `mne.ts` намеренно не импортирует ядро (иначе в бандл потребителя уехал бы
 * `fundamentool`), поэтому исключения грамматики там — копия. Тест держит копию
 * и оригинал в одной форме: разойдутся — упадёт здесь, а не в чужом проекте.
 */
describe('исключения совпадают с грамматикой ядра', () => {
  const CASES = [
    '.5',
    '+3',
    '+--a',
    '#F00',
    '#FF0000',
    '#FF0000FF',
    '\\.',
    ':hover',
    '<.parent',
    '@sm',
    '.active',
    '#main',
    '+div',
  ];

  test.each(CASES)('%s трактуется одинаково', (fragment) => {
    // Источник истины — REGEXP_SELECTOR_EXCEPTIONS ядра; копия в mne.ts
    // проверяется через наблюдаемое поведение mnKey: если фрагмент —
    // значение, он НЕ обрывает ключ, если граница — обрывает.
    const isValue = REGEXP_SELECTOR_EXCEPTIONS.test(fragment)
      && REGEXP_SELECTOR_EXCEPTIONS.exec(fragment)!.index === 0;
    const key = mnKey('x' + fragment);

    expect(key === 'x').toBe(isValue);
  });
});
