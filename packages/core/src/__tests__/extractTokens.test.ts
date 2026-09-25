/**
 * Тесты extractTokens — извлечение MN-токенов из значений атрибута в тексте файла.
 */

import {
  extractTokens,
  extractClassVarTokens,
  extractMergeCallTokens,
  scanTokens,
} from '../extractTokens';

describe('extractTokens', () => {
  test('литеральная строка в двойных кавычках', () => {
    expect(extractTokens('<div class="p10 w50">', 'class')).toEqual(['p10', 'w50']);
  });

  test('литеральная строка в одинарных кавычках', () => {
    expect(extractTokens("<div class='p10 w50'>", 'class')).toEqual(['p10', 'w50']);
  });

  test('JSX-выражение со строкой в одинарных кавычках', () => {
    expect(extractTokens("<div className={'m5'}>", 'className')).toEqual(['m5']);
  });

  test('JSX-выражение со строкой в двойных кавычках', () => {
    expect(extractTokens('<div className={"m5 p10"}>', 'className')).toEqual(['m5', 'p10']);
  });

  test('template literal без интерполяции', () => {
    expect(extractTokens('<div className={`fx1 h100`}>', 'className')).toEqual(['fx1', 'h100']);
  });

  test('template literal с интерполяцией — динамическая часть отбрасывается', () => {
    expect(extractTokens('<div className={`fx1 ${cond ? "a" : "b"} h100`}>', 'className'))
      .toEqual(['fx1', 'h100']);
  });

  test('несколько атрибутов в одном файле', () => {
    const source = '<div class="p10"></div>\n<span class="w50 m5"></span>';
    expect(extractTokens(source, 'class')).toEqual([
      'p10',
      'w50',
      'm5',
    ]);
  });

  test('кастомное имя атрибута (className) не матчит class и наоборот', () => {
    const source = '<div class="p10" data-x="ignored">';
    expect(extractTokens(source, 'className')).toEqual([]);
  });

  test('нет совпадений — пустой массив', () => {
    expect(extractTokens('<div id="app"></div>', 'class')).toEqual([]);
  });

  test('лишние пробелы внутри значения схлопываются, пустые токены отфильтрованы', () => {
    expect(extractTokens('<div class="  p10   w50  ">', 'class')).toEqual(['p10', 'w50']);
  });

  test('пустая строка-значение — пустой массив', () => {
    expect(extractTokens('<div class="">', 'class')).toEqual([]);
  });

  test('свойство объектного литерала (двойные кавычки)', () => {
    expect(extractTokens('{ className: "p10 w50" }', 'className')).toEqual(['p10', 'w50']);
  });

  test('свойство объектного литерала (одинарные кавычки)', () => {
    expect(extractTokens("{ className: 'p10 w50' }", 'className')).toEqual(['p10', 'w50']);
  });

  test('вложенное свойство объектного литерала (MUI slotProps)', () => {
    const source = `
      slotProps={{
        paper: {
          className: 'w320 bg0A0A12.88 bl1 bslS bclF.1 ftbBlur12 cF dF fxdC ov',
        },
      }}
    `;
    expect(extractTokens(source, 'className')).toEqual([
      'w320',
      'bg0A0A12.88',
      'bl1',
      'bslS',
      'bclF.1',
      'ftbBlur12',
      'cF',
      'dF',
      'fxdC',
      'ov',
    ]);
  });
});

describe('extractClassVarTokens', () => {
  /**
   * Классы, собранные в переменной, разбор `class="…"` не видит, а в островах набор
   * токенов почти всегда лежит в константе. Конвенция имени (суффикс `Class`) делает
   * такую переменную видимой для сборки.
   *
   * Механизм жил только в `minotation-vite`; перенесён в ядро 2026-09-25, чтобы
   * esbuild, rollup и webpack перестали молча терять эти токены.
   */
  function tokensOf(source: string, suffixes = ['Class']): string[] {
    return extractClassVarTokens(source, suffixes);
  }

  test('присваивание переменной', () => {
    expect(tokensOf("const thClass = 'py12 px14';")).toEqual(['py12', 'px14']);
  });

  test('свойство объекта', () => {
    expect(tokensOf("{ rowClass: 'p10 m5' }")).toEqual(['p10', 'm5']);
  });

  test('аннотация типа между именем и значением', () => {
    expect(tokensOf("const aClass: string = 'w50';")).toEqual(['w50']);
  });

  test('шаблонная строка: подстановка отбрасывается, статика берётся', () => {
    expect(tokensOf('const aClass = `p10 ${x} m5`;')).toEqual(['p10', 'm5']);
  });

  test('суффикс должен быть концом имени — `thClassy` не подходит', () => {
    expect(tokensOf("const thClassy = 'p10';")).toEqual([]);
  });

  test('имя без суффикса не сканируется', () => {
    expect(tokensOf("const th = 'p10';")).toEqual([]);
  });

  test('свои суффиксы через параметр', () => {
    expect(tokensOf("const aStyles = 'p10';", ['Styles'])).toEqual(['p10']);
  });

  test('пустой список суффиксов отключает механизм', () => {
    expect(extractClassVarTokens("const aClass = 'p10';", [])).toEqual([]);
  });

  test('несколько объявлений в файле', () => {
    expect(tokensOf("const aClass = 'p10';\nconst bClass = 'm5';")).toEqual(['p10', 'm5']);
  });
});

describe('extractMergeCallTokens', () => {
  /**
   * `mne('pt26 pb6', props.class)` — токены записаны прямо в аргументах вызова:
   * ни в `class="…"`, ни в переменной с суффиксом. До 2026-09-25 они молча не попадали
   * в CSS — сборка проходила зелёной, а стилей не было. Живой случай: компоненты
   * `PageHeader`, `TextA`, `StatA` проекта affiliate потеряли `pb6`, `bg--ink`, `c--bg`.
   */
  const NAMES = ['mne', 'mnClass'];

  test('литералы из аргументов', () => {
    expect(extractMergeCallTokens("mne('pt26 pb6', props.class)", NAMES))
      .toEqual(['pt26', 'pb6']);
  });

  test('переменные-аргументы игнорируются, литералы рядом берутся', () => {
    expect(extractMergeCallTokens("mne(baseClass, 'h123')", NAMES)).toEqual(['h123']);
  });

  test('второе имя функции тоже сканируется', () => {
    expect(extractMergeCallTokens("mnClass('w777')", NAMES)).toEqual(['w777']);
  });

  test('вложенный вызов — литералы с любой глубины', () => {
    expect(extractMergeCallTokens("mne(base, cond ? 'w321' : mne(x, 'h321'))", NAMES))
      .toEqual(['w321', 'h321']);
  });

  test('объект и массив внутри аргументов не обрывают разбор', () => {
    expect(extractMergeCallTokens("mne(base, { a: 'p1' }, ['m2'])", NAMES))
      .toEqual(['p1', 'm2']);
  });

  test('подстановка ${…} пропускается', () => {
    expect(extractMergeCallTokens('mne(`w456 ${x} h456`)', NAMES))
      .toEqual(['w456', 'h456']);
  });

  test('экранированная кавычка не завершает литерал', () => {
    expect(extractMergeCallTokens("mne('bgi_a\\\\.png')", NAMES))
      .toEqual(['bgi_a\\\\.png']);
  });

  test('хвост другого идентификатора не считается вызовом', () => {
    expect(extractMergeCallTokens("myMne('w999')", NAMES)).toEqual([]);
    expect(extractMergeCallTokens("obj.mne('w999')", NAMES)).toEqual([]);
    expect(extractMergeCallTokens("mne2('w999')", NAMES)).toEqual([]);
  });

  test('имя без скобки вызовом не считается', () => {
    expect(extractMergeCallTokens("const f = mne;", NAMES)).toEqual([]);
  });

  test('пробелы и перевод строки перед скобкой допустимы', () => {
    expect(extractMergeCallTokens("mne\n  ('p10')", NAMES)).toEqual(['p10']);
  });

  test('несколько вызовов в файле', () => {
    expect(extractMergeCallTokens("mne('p10');\nmne('m5');", NAMES)).toEqual(['p10', 'm5']);
  });

  test('пустой список имён отключает механизм', () => {
    expect(extractMergeCallTokens("mne('p10')", [])).toEqual([]);
  });

  test('своё имя функции', () => {
    expect(extractMergeCallTokens("cx('p10')", ['cx'])).toEqual(['p10']);
  });
});

describe('scanTokens — единая точка сбора', () => {
  test('атрибут, переменная и вызов в одном файле', () => {
    const source = '<div class="h5">'
      + "\nconst aClass = 'p10';"
      + "\nmne(aClass, 'w50');";
    expect(scanTokens(source, {}).sort()).toEqual([
      'h5',
      'p10',
      'w50',
    ]);
  });

  test('своё имя атрибута', () => {
    expect(scanTokens('<div className="p10">', {
      attr: 'className', 
    })).toEqual(['p10']);
  });

  test('механизмы отключаются по отдельности', () => {
    const source = "const aClass = 'p10'; mne(x, 'w50');";
    expect(scanTokens(source, {
      classVarSuffixes: [],
      mergeFnNames: [], 
    })).toEqual([]);
    expect(scanTokens(source, {
      mergeFnNames: [], 
    })).toEqual(['p10']);
    expect(scanTokens(source, {
      classVarSuffixes: [], 
    })).toEqual(['w50']);
  });

  test('повторный вызов с теми же опциями даёт тот же результат', () => {
    const source = "const aClass = 'p10';";
    expect(scanTokens(source, {})).toEqual(['p10']);
    expect(scanTokens(source, {})).toEqual(['p10']);
  });
});

describe('кеш регулярок extractTokens (2026-09-25)', () => {
  /**
   * `extractTokens` зовётся на каждый файл сборки, а имён атрибутов в проекте одно-два.
   * Регулярка кешируется по имени — но у неё флаг `g`, поэтому перед каждым проходом
   * нужен сброс `lastIndex`, иначе второй файл сканировался бы не с начала.
   */
  test('повторные вызовы с тем же атрибутом дают тот же результат', () => {
    const source = '<div class="p10 w50">';
    expect(extractTokens(source, 'class')).toEqual(['p10', 'w50']);
    expect(extractTokens(source, 'class')).toEqual(['p10', 'w50']);
    expect(extractTokens(source, 'class')).toEqual(['p10', 'w50']);
  });

  test('разные атрибуты не мешают друг другу', () => {
    expect(extractTokens('<div class="p10" className="m5">', 'class')).toEqual(['p10']);
    expect(extractTokens('<div class="p10" className="m5">', 'className')).toEqual(['m5']);
    expect(extractTokens('<div class="p10" className="m5">', 'class')).toEqual(['p10']);
  });
});

describe('scanTokens — отключение механизмов (регрессия 2026-09-25)', () => {
  /**
   * Первая версия принимала готовый регексп и решала по его ЗНАЧЕНИЮ: `classVarRegExp([])`
   * возвращал `undefined`, неотличимый от «параметр не передан», и механизм молча
   * включался обратно с суффиксом по умолчанию. Поймано тестом `minotation-vite`
   * «пустой массив отключает механизм». После перехода на ручной разбор регексп из API
   * ушёл вовсе, и отключение выражается единственным способом — пустым списком.
   */
  test('classVarSuffixes: [] отключает разбор переменных', () => {
    expect(scanTokens("const thClass = 'w777';", {
      classVarSuffixes: [], 
    })).toEqual([]);
  });

  test('без ключа работает дефолт ["Class"]', () => {
    expect(scanTokens("const thClass = 'w777';", {})).toEqual(['w777']);
  });

  test('mergeFnNames: [] отключает разбор вызовов', () => {
    expect(scanTokens("mne(x, 'w777')", {
      mergeFnNames: [], 
    })).toEqual([]);
  });
});

describe('кеш регулярок extractTokens (2026-09-25)', () => {
  /**
   * `extractTokens` зовётся на каждый файл сборки, а имён атрибутов в проекте одно-два.
   * Регулярка кешируется по имени — но у неё флаг `g`, поэтому перед каждым проходом
   * нужен сброс `lastIndex`, иначе второй файл сканировался бы не с начала.
   */
  test('повторные вызовы с тем же атрибутом дают тот же результат', () => {
    const source = '<div class="p10 w50">';
    expect(extractTokens(source, 'class')).toEqual(['p10', 'w50']);
    expect(extractTokens(source, 'class')).toEqual(['p10', 'w50']);
    expect(extractTokens(source, 'class')).toEqual(['p10', 'w50']);
  });

  test('разные атрибуты не мешают друг другу', () => {
    expect(extractTokens('<div class="p10" className="m5">', 'class')).toEqual(['p10']);
    expect(extractTokens('<div class="p10" className="m5">', 'className')).toEqual(['m5']);
    expect(extractTokens('<div class="p10" className="m5">', 'class')).toEqual(['p10']);
  });
});


describe('extractClassVarTokens — края ручного разбора (2026-09-25)', () => {
  /**
   * Ветки, которые ручной разбор проходит на невалидном или необычном вводе. Каждая
   * должна молча пропускать совпадение, а не падать и не захватывать лишнее: файл
   * сканируется целиком, и слово с суффиксом легко встречается вне объявления.
   */
  function tokensOf(source: string): string[] {
    return extractClassVarTokens(source, ['Class']);
  }

  test('аннотация типа без `=` — совпадение пропускается', () => {
    expect(tokensOf('interface A { aClass: string; }')).toEqual([]);
  });

  test('аннотация обрывается на переводе строки', () => {
    expect(tokensOf("const aClass: string\n  = 'p10';")).toEqual([]);
  });

  test('после `=` не строка — пропускается', () => {
    expect(tokensOf('const aClass = someVar;')).toEqual([]);
    expect(tokensOf('const aClass = 42;')).toEqual([]);
  });

  test('ни `=`, ни `:` после имени — пропускается', () => {
    expect(tokensOf('foo(aClass)')).toEqual([]);
    expect(tokensOf('const x = aClass;')).toEqual([]);
  });

  test('суффикс в самом конце файла', () => {
    expect(tokensOf('const aClass')).toEqual([]);
  });

  test('оборванный литерал без закрывающей кавычки', () => {
    expect(tokensOf("const aClass = 'p10 w50")).toEqual(['p10', 'w50']);
  });

  test('пустой литерал', () => {
    expect(tokensOf("const aClass = '';")).toEqual([]);
  });

  test('литерал только из пробелов', () => {
    expect(tokensOf("const aClass = '   ';")).toEqual([]);
  });

  test('токен без ведущих пробелов возвращается целиком', () => {
    expect(tokensOf("const aClass = 'p10';")).toEqual(['p10']);
  });

  test('экранированная кавычка внутри значения', () => {
    expect(tokensOf("const aClass = 'bgi_a\\'b';")).toEqual(["bgi_a\\'b"]);
  });

  test('аннотация типа с дженериком — значение всё равно берётся', () => {
    // В дженерике есть запятая и угловые скобки, но нет `;` и перевода строки,
    // поэтому разбор доходит до `=` и читает литерал.
    expect(tokensOf("const aClass: Record<string, string> = 'p10';")).toEqual(['p10']);
  });

  test('суффикс продолжен любым идентификаторным символом — не объявление', () => {
    // Все ветки isIdentChar: буква, цифра, подчёркивание, знак доллара.
    expect(tokensOf("const aClassy = 'p10';")).toEqual([]);
    expect(tokensOf("const aClassX = 'p10';")).toEqual([]);
    expect(tokensOf("const aClass2 = 'p10';")).toEqual([]);
    expect(tokensOf("const aClass_ = 'p10';")).toEqual([]);
    expect(tokensOf("const aClass$ = 'p10';")).toEqual([]);
  });

  test('табуляция и возврат каретки как пробелы', () => {
    expect(tokensOf("const aClass\t=\t'p10';")).toEqual(['p10']);
    // Перевод строки между именем и `=` разбор не прерывает: прерывает он только
    // затянувшуюся аннотацию типа (ветка с `:`).
    expect(tokensOf("const aClass\r\n  = 'p10';")).toEqual(['p10']);
    expect(tokensOf("const aClass =\t'p10 \r\n m5';")).toEqual(['p10', 'm5']);
  });

  test('несколько суффиксов, оба находятся', () => {
    expect(extractClassVarTokens("const aClass = 'p10'; const bCls = 'm5';", ['Class', 'Cls']))
      .toEqual(['p10', 'm5']);
  });
});

describe('extractMergeCallTokens — края разбора вызова (2026-09-25)', () => {
  const NAMES = ['mne'];

  test('незакрытый вызов до конца файла', () => {
    expect(extractMergeCallTokens("mne('p10'", NAMES)).toEqual(['p10']);
  });

  test('вызов без аргументов', () => {
    expect(extractMergeCallTokens('mne()', NAMES)).toEqual([]);
  });

  test('только нестроковые аргументы', () => {
    expect(extractMergeCallTokens('mne(a, b, c)', NAMES)).toEqual([]);
  });

  test('оборванный литерал внутри вызова', () => {
    expect(extractMergeCallTokens("mne('p10", NAMES)).toEqual(['p10']);
  });

  test('имя в самом конце файла', () => {
    expect(extractMergeCallTokens('mne', NAMES)).toEqual([]);
  });

  test('пустой литерал в аргументе', () => {
    expect(extractMergeCallTokens("mne('')", NAMES)).toEqual([]);
  });

  test('вызов внутри строки другого вызова не теряется', () => {
    expect(extractMergeCallTokens("mne('p10'); other(); mne('m5')", NAMES))
      .toEqual(['p10', 'm5']);
  });
});
