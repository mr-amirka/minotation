/**
 * Опции сканера в одной форме: записи `имя:цель`, план по целям, предупреждение о заменённом умолчании.
 */
import {
  parseScanEntries,
  scanDefaultWarnings,
  scanPlanOf,
  SCAN_DEFAULTS,
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

describe('parseScanEntries', () => {
  test('attr: имя без цели — само себе цель, шаблон без цели — class', () => {
    expect(parseScanEntries([
      'class',
      'className:class',
      'm',
      '*ClassName',
    ], true)).toEqual([
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
    ]);
  });

  test('переменные и вызовы: пропущенная цель — class', () => {
    expect(parseScanEntries([
      'mne',
      '*Class:m',
    ], false)).toEqual([
      [
        'mne',
        'class',
      ],
      [
        '*Class',
        'm',
      ],
    ]);
  });
});

describe('scanPlanOf', () => {
  test('умолчания — одна группа class', () => {
    expect(scanPlanOf({})).toEqual([
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
      attr: [
        'm',
        'class',
      ],
      classVarName: ['*M:m'],
      classFnName: [],
      comments: false,
    });
    expect(plan).toEqual([
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
      attr: ['m'],
      classVarName: [],
      classFnName: [],
    })[1]).toBe('m');
    expect(scanPlanOf({
      attr: [],
      classVarName: [],
      classFnName: [],
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
    attr: [
      'className:class',
      'm',
    ],
    classVarName: [
      '*Class:class',
      '*M:m',
    ],
    classFnName: [
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
      classFnName: ['cx:class'],
      replaceDefaults: true,
    }).class).toEqual(['p3']);
    expect(scanTokensSyntax('mycx(\'p1\'); obj.cx(\'p2\'); cx(\'p3\')', {
      classFnName: ['cx:class'],
    }).class).toEqual(['p3']);
  });
});

describe('предупреждение о заменённом умолчании', () => {
  test('список без записей умолчания — по сообщению на опцию', () => {
    expect(scanDefaultWarnings({
      attr: ['className:class'],
      classVarName: ['*Styles:class'],
      classFnName: ['cx:class'],
    })).toEqual([
      '[minotation] attr replaces its default and no longer scans "class:class" (attributes like class="p10"). '
        + 'Add them to the list, or set replaceDefaults: true',
      '[minotation] classVarName replaces its default and no longer scans "*Class:class" (variables like const '
        + 'rowClass = \'p10\'). Add them to the list, or set replaceDefaults: true',
      '[minotation] classFnName replaces its default and no longer scans "mne:class", "*Class:class" (calls like '
        + 'mne(\'p10\') and thClass(\'w150\')). Add them to the list, or set replaceDefaults: true',
    ]);
  });

  test('называет только потерянные записи', () => {
    expect(scanDefaultWarnings({
      classFnName: [
        'mne:class',
        'cx:class',
      ],
    })).toEqual([
      '[minotation] classFnName replaces its default and no longer scans "*Class:class" (calls like mne(\'p10\') '
        + 'and thClass(\'w150\')). Add them to the list, or set replaceDefaults: true',
    ]);
  });

  test.each([
    [
      'умолчание целиком плюс своё',
      {
        attr: [
          'class',
          'className:class',
        ],
        classFnName: [
          ...SCAN_DEFAULTS.classFnName,
          'cx:class',
        ],
      },
    ],
    [
      'пустой список — выключено намеренно',
      {
        classVarName: [],
        classFnName: [],
      },
    ],
    [
      'replaceDefaults: true',
      {
        attr: ['className:class'],
        replaceDefaults: true,
      },
    ],
    [
      'опции не заданы',
      {},
    ],
  ])('нет предупреждения: %s', (_name, options) => {
    expect(scanDefaultWarnings(options)).toEqual([]);
  });

  test('createScanner выводит его один раз, при создании, через onWarning', () => {
    const warnings: string[] = [];
    const scan = createScanner({
      attr: ['className:class'],
      syntax: false,
      onWarning: (message) => {
        warnings.push(message);
      },
    });
    scan('<a className="p10" />');
    scan('<a className="p10" />');
    expect(warnings).toEqual([
      '[minotation] attr replaces its default and no longer scans "class:class" (attributes like class="p10"). '
        + 'Add them to the list, or set replaceDefaults: true',
    ]);
  });

  test('без onWarning — console.warn', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      createScanner({
        classVarName: ['*Styles:class'],
      });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});
