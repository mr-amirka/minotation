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

  test('у чужого класса значения нет — ключом становится он сам', () => {
    expect(mnMap('text-center --gap=10px f20')).toEqual({
      'text-center': '',
      '--gap=10px': '',
      f: '20',
    });
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

/**
 * Сплошной проход по контекстным конструкциям грамматики.
 *
 * Первый набор тестов покрывал медиа, состояние и `<`-предка; остальные формы
 * (`>`, `~`, `+`, `[attr]`, `#id`, `.class`, `&`, группы вариантов, числовые
 * медиа-шаблоны, глубина) работали, но проверены не были — 100 % покрытия строк
 * это не ловит, потому что все они идут через один и тот же цикл.
 */
describe('mne — все контекстные конструкции', () => {
  test.each([
    [
      'сосед +',
      'p10+div',
      'p+div',
    ],
    [
      'сосед ~',
      'p10~div',
      'p~div',
    ],
    [
      'прямой потомок',
      'p10>.child',
      'p>.child',
    ],
    [
      'условие-класс',
      'cF00.active',
      'c.active',
    ],
    [
      'условие-id',
      'cF00#main',
      'c#main',
    ],
    [
      'условие-атрибут',
      'cF00[data-x]',
      'c[data-x]',
    ],
    [
      'цепочка состояний',
      'p10:hover:focus',
      'p:hover:focus',
    ],
    [
      'состояние со скобками',
      'cF00:not(.a,.b)',
      'c:not(.a,.b)',
    ],
    [
      'предок с глубиной',
      'p10<2.parent',
      'p<2.parent',
    ],
    [
      'медиа + селектор-медиа',
      'f20@sm&safari',
      'f@sm&safari',
    ],
    [
      'числовой медиа-шаблон',
      'f20@760-1200',
      'f@760-1200',
    ],
    [
      'медиа по высоте',
      'f20@x600',
      'f@x600',
    ],
    [
      'группа вариантов',
      'p10@(sm|md)',
      'p@(sm|md)',
    ],
  ])('%s: ключ = %s → %s', (
    _name, token, expected,
  ) => {
    expect(mnKey(token)).toBe(expected);
  });

  test.each([
    [
      'сосед',
      'p10+div',
      'p12+div',
    ],
    [
      'прямой потомок',
      'p10>.child',
      'p12>.child',
    ],
    [
      'условие-класс',
      'cF00.active',
      'c00F.active',
    ],
    [
      'условие-id',
      'cF00#main',
      'c00F#main',
    ],
    [
      'условие-атрибут',
      'cF00[data-x]',
      'c00F[data-x]',
    ],
    [
      'медиа + селектор-медиа',
      'f20@sm&safari',
      'f24@sm&safari',
    ],
    [
      'числовой медиа-шаблон',
      'f20@760-1200',
      'f24@760-1200',
    ],
    [
      'группа вариантов',
      'p10@(sm|md)',
      'p12@(sm|md)',
    ],
  ])('%s: одинаковый контекст — переопределение срабатывает', (
    _name, base, override,
  ) => {
    expect(mne(base, override)).toBe(override);
  });

  test.each([
    [
      'сосед vs без него',
      'p10',
      'p12+div',
    ],
    [
      'разная глубина предка',
      'p10<1.parent',
      'p12<2.parent',
    ],
    [
      'разные условия-классы',
      'cF00.active',
      'c00F.disabled',
    ],
    [
      'разные числовые медиа',
      'f20@760',
      'f24@760-1200',
    ],
  ])('%s: разные контексты — оба остаются', (
    _name, base, override,
  ) => {
    expect(mne(base, override)).toBe(base + ' ' + override);
  });

  test('старый приём со специфичностью сливается с базой корректно', () => {
    // `f24*2` — ровно тот обходной путь, ради отказа от которого сделана утилита.
    // Ключ у него тот же (`f`), поэтому база вытесняется, и звёздочки становятся
    // не нужны — но если они уже написаны, слияние не ломается.
    expect(mnKey('f24*2')).toBe('f');
    expect(mne('f20', 'f24*2')).toBe('f24*2');
  });

  test('вырожденный предок не приводит к совпадению ключей', () => {
    // `p10<` ядро бракует (Q-08), но утилита работает со строками до компиляции —
    // важно лишь, что такой токен не сольётся с обычным `p10`.
    expect(mnKey('p10<')).toBe('p<');
    expect(mne('p10', 'p12<')).toBe('p10 p12<');
  });

  test('экранированное значение целиком остаётся значением', () => {
    expect(mnKey('bgi_img/a\\.png')).toBe('bgi');
    expect(mne('bgi_img/a\\.png', 'bgi_img/b\\.png')).toBe('bgi_img/b\\.png');
  });
});

describe('mne — краевые случаи разбора', () => {
  test('важность без значения сливается со значением', () => {
    // `p-i` — законный токен (`padding:0!important`). Ключ у него совпадает
    // с `p10-i` не по логике важности, а потому что чужим путём возвращается
    // токен целиком, и он случайно равен `тег + '-i'`. Тест держит это
    // совпадение: если разбор чужих классов поменяют, слияние не должно уехать.
    expect(mnKey('p-i')).toBe('p-i');
    expect(mnKey('p10-i')).toBe('p-i');
    expect(mne('p10-i', 'p-i')).toBe('p-i');
    expect(mne('p-i', 'p10-i')).toBe('p10-i');
  });

  test('ключ `constructor` не считается занятым', () => {
    // `seen` — обычный объект, поэтому проверка строгая (`=== 1`): иначе
    // унаследованный `Object.prototype.constructor` выглядел бы как уже
    // встреченный ключ, и токен молча исчезал бы из результата.
    expect(mne('constructor f20', 'f24')).toBe('constructor f24');
    expect(mne('toString p10', 'p12')).toBe('toString p12');
    expect(mnMap('constructor')).toEqual({
      constructor: '',
    });
  });

  test('нестроковые значения не роняют разбор', () => {
    // В JSX `props.className` бывает чем угодно при ошибке типизации.
    expect(mne('f20', 0 as never)).toBe('f20');
    expect(mne('f20', false as never)).toBe('f20');
  });
});

describe('кеш ключей (2026-09-25)', () => {
  /**
   * `mnKey` зовётся на каждый токен каждой строки при каждом рендере, а набор классов
   * от рендера к рендеру повторяется — поэтому ключи кешируются. Замер: 325 мс без кеша
   * против 207 мс с кешем на 200 000 вызовов `mne` с базой из 11 токенов.
   *
   * Кеш корректен по определению (токен и его ключ связаны навсегда), но у него есть
   * две опасные точки: имена из `Object.prototype` и неограниченный рост.
   */
  test('повторные вызовы дают тот же ключ', () => {
    expect(mnKey('f20')).toBe('f');
    expect(mnKey('f20')).toBe('f');
    expect(mnKey('f20@sm')).toBe('f@sm');
    expect(mnKey('f20@sm')).toBe('f@sm');
  });

  test('токены с именами из Object.prototype не читаются из прототипа', () => {
    // Чтение обычного объекта по такому ключу вернуло бы ФУНКЦИЮ из прототипа.
    // Ключи здесь разные, потому что разбор видит в этих именах обычные токены:
    // `constructor` — весь тег (одни строчные буквы), `toString` — тег `to`
    // со значением `String`, и так далее.
    expect(mnKey('constructor')).toBe('constructor');
    expect(mnKey('toString')).toBe('to');
    expect(mnKey('valueOf')).toBe('value');
    expect(mnKey('hasOwnProperty')).toBe('has');
    // Повторно — уже из кеша, результат тот же, по-прежнему строка.
    expect(mnKey('constructor')).toBe('constructor');
    expect(mnKey('toString')).toBe('to');
    expect(mne('constructor f20', 'f24')).toBe('constructor f24');
  });

  test('переполнение кеша не ломает результат', () => {
    // Предел — 10 000; прогоняем больше, чтобы сброс точно случился.
    for (let i = 0; i < 12000; i++) {
      expect(mnKey('w' + i)).toBe('w');
    }
    // После сброса прежние токены считаются заново и дают то же самое.
    expect(mnKey('f20')).toBe('f');
    expect(mne('f20 p10', 'f24')).toBe('p10 f24');
  });

  test('слияние после переполнения работает как до него', () => {
    expect(mne('py7 px12 bg--panel c--ink', 'bg--ink c--bg'))
      .toBe('py7 px12 bg--ink c--bg');
  });
});
