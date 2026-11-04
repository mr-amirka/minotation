/**
 * Опции сканера в одной форме: записи `имя:цель`, план по целям, предупреждение о заменённом умолчании.
 */
import {
  readScanEntries,
  scanDefaultWarnings,
  scanPlanOf,
  SCAN_DEFAULTS,
} from '../scanPlan';
import type {
  ScanPlan,
} from '../scanPlan';
import {
  scanTokens,
} from '../extractTokens';
import {
  scanTokensSfc,
  scanTokensSyntax,
} from '../syntaxScan';
import {
  createScanner,
} from '../scanner';

describe('readScanEntries', () => {
  const PAIRS = [
    [
      'class',
      'class',
    ],
    [
      'className',
      'class',
    ],
    [
      'm',
      'm',
    ],
    [
      '*ClassName',
      'class',
    ],
  ];

  test.each([
    [
      'строка',
      'class, className:class m;*ClassName : class',
    ],
    [
      'массив',
      [
        'class',
        'className:class',
        'm',
        '*ClassName:class',
      ],
    ],
    [
      'объект',
      {
        class: 'class',
        className: 'class',
        m: 'm',
        '*ClassName': 'class',
      },
    ],
  ])('attrs, %s: имя без цели — само себе цель', (_name, value) => {
    expect(readScanEntries('attrs', value)).toEqual(PAIRS);
  });

  test('шаблон attrs без цели и переменная без цели пропускаются — о них говорит схема', () => {
    expect(readScanEntries('attrs', '*ClassName, m')).toEqual([
      [
        'm',
        'm',
      ],
    ]);
    expect(readScanEntries('varNames', [
      'mne',
      '*Class:m',
    ])).toEqual([
      [
        '*Class',
        'm',
      ],
    ]);
  });

  test('undefined — умолчание, пустое — ничего', () => {
    expect(readScanEntries('fnNames', undefined)).toEqual([
      [
        'mne',
        'class',
      ],
      [
        '*Class',
        'class',
      ],
    ]);
    expect(readScanEntries('fnNames', '')).toEqual([]);
    expect(readScanEntries('fnNames', {})).toEqual([]);
  });
});

/** План без читателей групп — их форма, а у каждой группы проверяется, что читатель есть. */
function shapeOf(plan: ScanPlan): unknown[] {
  for (const group of plan[0]) {
    expect(typeof group[4]).toBe('function');
  }
  return [
    plan[0].map((group) => group.slice(0, 4)),
    plan[1],
    plan[2],
  ];
}

describe('scanPlanOf', () => {
  test('умолчания — одна группа class', () => {
    expect(shapeOf(scanPlanOf({}))).toEqual([
      [
        [
          'class',
          ['class'],
          ['*Class'],
          [
            'mne',
            '*Class',
          ],
        ],
      ],
      'class',
      true,
    ]);
  });

  test('группы по цели, в порядке первой записи; маркеры — в class', () => {
    const plan = scanPlanOf({
      attrs: [
        'm',
        'class',
      ],
      varNames: ['*M:m'],
      fnNames: [],
      comments: false,
    });
    expect(shapeOf(plan)).toEqual([
      [
        [
          'm',
          ['m'],
          ['*M'],
          [],
        ],
        [
          'class',
          ['class'],
          [],
          [],
        ],
      ],
      'class',
      false,
    ]);
  });

  test('без группы class маркеры идут в первую; без групп — в class', () => {
    expect(scanPlanOf({
      attrs: ['m'],
      varNames: [],
      fnNames: [],
    })[1]).toBe('m');
    expect(scanPlanOf({
      attrs: [],
      varNames: [],
      fnNames: [],
    })).toEqual([
      [],
      'class',
      true,
    ]);
  });
});

describe('токены по цели', () => {
  const source = '<a className="p10" m="w1" />;\nconst iconM = \'h5\';\nconst rowClass = \'c0\';\n'
    + 'cx(\'b1\'); mne(\'d1\');\n// @mn fx1';
  const options = {
    attrs: [
      'className:class',
      'm',
    ],
    varNames: [
      '*Class:class',
      '*M:m',
    ],
    fnNames: [
      'mne:class',
      '*Class:class',
      'cx:m',
    ],
  };
  const expected = {
    class: [
      'fx1',
      'p10',
      'c0',
      'd1',
    ],
    m: [
      'w1',
      'h5',
      'b1',
    ],
  };

  test('текстом', () => {
    expect(scanTokens(source, options)).toEqual(expected);
  });

  test('разбором — те же наборы', () => {
    const found = scanTokensSyntax(source, options);
    expect(found.class.slice().sort()).toEqual(expected.class.slice().sort());
    expect(found.m.slice().sort()).toEqual(expected.m.slice().sort());
  });

  test('SFC — скрипт разбором, шаблон текстом, наборы сливаются по цели', () => {
    const sfc = '<script lang="ts">\nconst iconM = \'h5\';\n</script>\n<div className="p10" m="w1"></div>';
    expect(scanTokensSfc(sfc, options)).toEqual({
      class: ['p10'],
      m: [
        'h5',
        'w1',
      ],
    });
  });

  test('точное имя вызова — целиком: `mycx` и `obj.cx` не берутся', () => {
    expect(scanTokens('mycx(\'p1\'); obj.cx(\'p2\'); cx(\'p3\')', {
      fnNames: ['cx:class'],
      replaceDefaults: true,
    }).class).toEqual(['p3']);
    expect(scanTokensSyntax('mycx(\'p1\'); obj.cx(\'p2\'); cx(\'p3\')', {
      fnNames: ['cx:class'],
    }).class).toEqual(['p3']);
  });
});

describe('предупреждение о заменённом умолчании', () => {
  test('список без записей умолчания — по сообщению на опцию', () => {
    expect(scanDefaultWarnings({
      attrs: ['className:class'],
      varNames: ['*Styles:class'],
      fnNames: ['cx:class'],
    })).toEqual([
      '[minotation] attrs replaces its default and no longer scans "class:class" (attributes like class="p10"). '
        + 'Add them to the list, or set replaceDefaults: true',
      '[minotation] varNames replaces its default and no longer scans "*Class:class" (variables like const '
        + 'rowClass = \'p10\'). Add them to the list, or set replaceDefaults: true',
      '[minotation] fnNames replaces its default and no longer scans "mne:class", "*Class:class" (calls like '
        + 'mne(\'p10\') and thClass(\'w150\')). Add them to the list, or set replaceDefaults: true',
    ]);
  });

  test('строка и объект сравниваются с умолчанием так же, как массив', () => {
    expect(scanDefaultWarnings({
      attrs: 'class className:class',
      fnNames: {
        mne: 'class',
        '*Class': 'class',
      },
    })).toEqual([]);
    expect(scanDefaultWarnings({
      varNames: {
        '*Styles': 'class',
      },
    })).toHaveLength(1);
  });

  test('называет только потерянные записи', () => {
    expect(scanDefaultWarnings({
      fnNames: [
        'mne:class',
        'cx:class',
      ],
    })).toEqual([
      '[minotation] fnNames replaces its default and no longer scans "*Class:class" (calls like mne(\'p10\') '
        + 'and thClass(\'w150\')). Add them to the list, or set replaceDefaults: true',
    ]);
  });

  test.each([
    [
      'умолчание целиком плюс своё',
      {
        attrs: [
          'class',
          'className:class',
        ],
        fnNames: [
          ...SCAN_DEFAULTS.fnNames,
          'cx:class',
        ],
      },
    ],
    [
      'пустой список — выключено намеренно',
      {
        varNames: [],
        fnNames: [],
      },
    ],
    [
      'replaceDefaults: true',
      {
        attrs: ['className:class'],
        replaceDefaults: true,
      },
    ],
    [
      'опции не заданы',
      {},
    ],
    [
      'пустая строка и пустой объект — тоже выключено',
      {
        attrs: '',
        fnNames: {},
      },
    ],
  ])('нет предупреждения: %s', (_name, options) => {
    expect(scanDefaultWarnings(options)).toEqual([]);
  });

  test('createScanner выводит его один раз, при создании, через onWarning', () => {
    const warnings: string[] = [];
    const scan = createScanner({
      attrs: ['className:class'],
      syntax: false,
      onWarning: (message) => {
        warnings.push(message);
      },
    });
    scan('<a className="p10" />');
    scan('<a className="p10" />');
    expect(warnings).toEqual([
      '[minotation] attrs replaces its default and no longer scans "class:class" (attributes like class="p10"). '
        + 'Add them to the list, or set replaceDefaults: true',
    ]);
  });

  test('без onWarning — console.warn', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      createScanner({
        varNames: ['*Styles:class'],
      });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
