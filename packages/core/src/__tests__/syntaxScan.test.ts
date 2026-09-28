/**
 * Синтаксический сканер: трек `scanner-robustness`, задача 3.
 *
 * Главный тест здесь — не список примеров, а сторож паритета: на корректном
 * файле оба сканера обязаны давать один и тот же набор токенов, кроме тех,
 * что текстовый берёт из мест, которые парсер видит как не-код. Разойдутся —
 * значит один из них неправ, и узнать об этом лучше здесь, а не на сборке.
 */
import {
  scanTokens,
} from '../extractTokens';
import {
  scanTokensSyntax,
} from '../syntaxScan';
import {
  createScanner, isSyntaxScannable,
} from '../scanner';

/** Набор без повторов и в стабильном порядке — сравнивать удобно именно его. */
function setOf(tokens: string[]): string[] {
  return Array.from(new Set(tokens)).sort();
}

describe('scanTokensSyntax — что собирается', () => {
  test.each([
    [
      'JSX-атрибут строкой',
      '<div class="p10 w50" />',
      ['p10', 'w50'],
    ],
    [
      'JSX-атрибут выражением',
      '<div class={\'m5\'} />',
      ['m5'],
    ],
    [
      'JSX-атрибут шаблоном',
      '<div class={`fx1 ${x} h100`} />',
      ['fx1', 'h100'],
    ],
    [
      'свойство объекта',
      'const o = { class: \'p10\' };',
      ['p10'],
    ],
    [
      'вложенное свойство',
      'f({ paper: { class: \'w320 dF\' } });',
      ['w320', 'dF'],
    ],
    [
      'переменная с суффиксом',
      'const rowClass = \'p10 m5\';',
      ['p10', 'm5'],
    ],
    [
      'переменная с аннотацией',
      'const rowClass: string = \'p10\';',
      ['p10'],
    ],
    [
      'свойство с суффиксом',
      'const o = { rowClass: \'p10\' };',
      ['p10'],
    ],
    [
      'вызов слияния',
      'mne(base, \'p10 m5\')',
      ['p10', 'm5'],
    ],
    [
      'вложенный вызов',
      'mne(a, cond ? b : mne(c, \'p10\'))',
      ['p10'],
    ],
    [
      'разметка внутри строки',
      'html`<div class="p10">`',
      ['p10'],
    ],
  ])('%s', (
    _name, source, expected,
  ) => {
    expect(setOf(scanTokensSyntax(source, {
      attr: 'class',
    }))).toEqual(setOf(expected));
  });

  test('шаблонная строка с интерполяцией и разметкой', () => {
    const source = 'html`<div class="p10">${x}<span class="m5">`';
    expect(setOf(scanTokensSyntax(source, {
      attr: 'class',
    }))).toEqual(['m5', 'p10']);
  });

  test('чужой метод с тем же именем не считается функцией слияния', () => {
    // Ровно как у текстового сканера: `obj.mne(...)` — не наш вызов.
    expect(scanTokensSyntax('obj.mne(a, \'p10\')', {
      attr: 'class',
    })).toEqual([]);
  });

  test('имя атрибута и суффиксы задаются опциями', () => {
    const source = 'const rowCls = \'p10\';\n<div className="m5" />;';
    expect(setOf(scanTokensSyntax(source, {
      attr: 'className',
      classVarSuffixes: ['Cls'],
    }))).toEqual(['m5', 'p10']);
  });

  test('пустые списки отключают механизмы', () => {
    const source = 'const rowClass = \'p10\';\nmne(a, \'m5\');';
    expect(scanTokensSyntax(source, {
      attr: 'class',
      classVarSuffixes: [],
      mergeFnNames: [],
    })).toEqual([]);
  });

  test('вычисляемое значение не даёт токенов', () => {
    // На этапе сборки оно неизвестно — как и у текстового сканера.
    expect(scanTokensSyntax('<div class={cond ? a : b} />', {
      attr: 'class',
    })).toEqual([]);
    expect(scanTokensSyntax('<div class={x} />', {
      attr: 'class',
    })).toEqual([]);
  });

  test('атрибут без значения игнорируется', () => {
    expect(scanTokensSyntax('<input class />', {
      attr: 'class',
    })).toEqual([]);
  });

  test('пустое JSX-выражение в атрибуте', () => {
    expect(scanTokensSyntax('<div class={} />', {
      attr: 'class',
    })).toEqual([]);
  });

  test('чужие атрибуты не трогаются', () => {
    expect(scanTokensSyntax('<div id="w50" data-x="m5" class="p10" />', {
      attr: 'class',
    })).toEqual(['p10']);
  });

  test('объявление без значения', () => {
    // `let rowClass;` — имя подходит, брать нечего.
    expect(scanTokensSyntax('let rowClass;', {
      attr: 'class',
    })).toEqual([]);
  });

  test('вычисляемое и строковое имя свойства', () => {
    // `['class']: '…'` — то же свойство, записанное строкой; `[key]` — чужое.
    expect(scanTokensSyntax('const o = { \'class\': \'p10\', [key]: \'m5\' };', {
      attr: 'class',
    })).toEqual(['p10']);
  });

  test('деструктуризация с подходящим именем токенов не даёт', () => {
    // Имя узла не Identifier — значения там нет, есть образец разбора.
    expect(scanTokensSyntax('const { rowClass } = props;', {
      attr: 'class',
    })).toEqual([]);
  });
});

describe('scanTokensSyntax — чего НЕ видно парсеру', () => {
  test.each([
    ['строчный комментарий', '// пример: class="p10 w50"\n<div class="m5" />'],
    ['блочный комментарий', '/* <div class="p10 w50"> */\n<div class="m5" />'],
    ['JSDoc с разметкой', '/**\n * <div class="p10 w50">\n */\n<div class="m5" />'],
    ['JSX-комментарий', '<>{/* <div class="p10 w50" /> */}<div class="m5" /></>'],
  ])('%s', (_name, source) => {
    expect(scanTokensSyntax(source, {
      attr: 'class',
    })).toEqual(['m5']);
  });

  test('закомментированный код с регулярным литералом', () => {
    // Здесь текстовый сканер спотыкается: для него кавычка внутри `/"/`
    // открывает строку, и дальше разбор уезжает. Парсеру это безразлично.
    const source = 'const re = /"/;\n// class="p10"\n<div class="m5" />';
    expect(scanTokensSyntax(source, {
      attr: 'class',
    })).toEqual(['m5']);
  });
});

describe('scanTokensSyntax — битый файл', () => {
  test('синтаксическая ошибка: откат к текстовому сканеру', () => {
    // Недописанная скобка — обычное состояние файла в момент сохранения.
    // Сборка из-за этого срываться не должна: стили нужны и такие.
    const source = '<div class="p10"\nfunction (((';
    expect(scanTokensSyntax(source, {
      attr: 'class',
    })).toEqual(['p10']);
  });

  test('откат сохраняет опции', () => {
    const source = 'const rowCls = \'p10\';\nfunction (((';
    expect(scanTokensSyntax(source, {
      attr: 'class',
      classVarSuffixes: ['Cls'],
    })).toEqual(['p10']);
  });
});

describe('scanTokensSyntax — диалекты', () => {
  test('.ts разбирается без JSX: `<T>` это приведение типа', () => {
    // В `.tsx` такой код — незакрытый тег, то есть ошибка разбора.
    const source = 'const v = <string>x;\nconst rowClass = \'p10\';';
    expect(scanTokensSyntax(source, {
      attr: 'class',
      fileName: 'a.ts',
    })).toEqual(['p10']);
  });

  test('.tsx разбирает JSX', () => {
    expect(scanTokensSyntax('<div class="p10" />', {
      attr: 'class',
      fileName: 'a.tsx',
    })).toEqual(['p10']);
  });

  test('имя без расширения разбирается как TSX', () => {
    // Расширения нет — берём диалект, принимающий надмножество остальных.
    expect(scanTokensSyntax('<div class="p10" />', {
      attr: 'class',
      fileName: 'Makefile',
    })).toEqual(['p10']);
  });

  test('без опций: атрибут `class`, суффикс `Class`, функции слияния', () => {
    const source = '<div class="p10" />;\nconst rowClass = \'m5\';\nmne(a, \'w50\');';
    expect(setOf(scanTokensSyntax(source, {}))).toEqual([
      'm5',
      'p10',
      'w50',
    ]);
  });

  test.each([
    ['a.ts', true],
    ['a.tsx', true],
    ['a.js', true],
    ['a.jsx', true],
    ['a.mjs', true],
    ['a.cjs', true],
    ['a.mts', true],
    ['a.cts', true],
    ['a.html', false],
    ['a.vue', false],
    ['a.svelte', false],
    ['a.astro', false],
    ['noext', false],
  ])('isSyntaxScannable(%p) === %p', (fileName, expected) => {
    expect(isSyntaxScannable(fileName)).toBe(expected);
  });
});

/**
 * Сторож паритета из README трека: «на корректном файле оба сканера должны
 * давать одинаковый набор токенов, кроме тех, что текстовый берёт из
 * комментариев». Комментариев в этих образцах нет — значит наборы обязаны
 * совпадать полностью.
 */
describe('паритет с текстовым сканером', () => {
  const SAMPLES: Array<[string, string]> = [
    ['атрибуты', '<div class="p10 w50"><span class={\'m5\'} /></div>'],
    ['шаблон в атрибуте', '<div class={`fx1 ${x} h100`} />'],
    ['переменные', 'const rowClass = \'p10\';\nconst thClass: string = \'m5\';'],
    ['свойство объекта', 'f({ paper: { class: \'w320 dF\' } });'],
    ['вызовы слияния', 'mne(thClass, \'fvTN\');\nmnClass(\'p10\', x);'],
    ['вложенные вызовы', 'mne(a, cond ? b : mne(c, \'p10 m5\'))'],
    ['разметка в строке', 'const s = \'<div class="p10">\';'],
    ['всё вместе', `
      import { mne } from 'minotation/mne';
      const chipClass = 'py7 px12 r b1 bsS';
      export default function Row({ active }) {
        return (
          <tr class="dF fxdC gap8 p16">
            <td class={mne(chipClass, 'fvTN')}>1</td>
            <td class={active ? 'bg--ink' : chipClass}>x</td>
            <div class={\`dG gap12 \${size} wmaxN\`} />
          </tr>
        );
      }
    `],
  ];

  test.each(SAMPLES)('%s', (_name, source) => {
    const options = {
      attr: 'class',
    };
    expect(setOf(scanTokensSyntax(source, options)))
      .toEqual(setOf(scanTokens(source, options)));
  });

  test('расхождение ровно там, где обещано: комментарии', () => {
    const source = '// class="p10"\n<div class="m5" />';
    // Текстовый сканер комментарии вырезает сам — здесь наборы совпадают.
    expect(setOf(scanTokens(source, {
      attr: 'class',
    }))).toEqual(['m5']);
    expect(setOf(scanTokensSyntax(source, {
      attr: 'class',
    }))).toEqual(['m5']);
    // А вот с отключённым вырезанием текстовый берёт лишнее, парсер — нет.
    expect(setOf(scanTokens(source, {
      attr: 'class',
      comments: false,
    }))).toEqual(['m5', 'p10']);
  });
});

/**
 * Выбор сканера. Живёт в ядре, а не в плагинах: механизм, реализованный в
 * одном плагине, в остальных молча отсутствует — так было с `classVarSuffixes`
 * до 2026-09-25.
 */
describe('createScanner', () => {
  const SOURCE = '// class="p10"\nconst re = /"/;\n<div class="m5" />';

  test('без `syntax` — текстовый сканер, имя файла не важно', () => {
    const scan = createScanner({
      attr: 'class',
    });
    expect(scan(SOURCE, '/src/App.tsx')).toEqual(scan(SOURCE));
  });

  test('с `syntax` — разбор для JS/TS, текст для остального', () => {
    const scan = createScanner({
      attr: 'class',
      syntax: true,
    });
    // Разбор видит регулярный литерал и комментарий как есть.
    expect(scan(SOURCE, '/src/App.tsx')).toEqual(['m5']);
    // `.html` парсеру не отдаётся — там своя грамматика.
    expect(scan('<div class="p10">', '/index.html')).toEqual(['p10']);
    // Без имени файла способ разбора выбрать не из чего — текст.
    expect(scan('<div class="p10">')).toEqual(['p10']);
  });

  test('хвост сборщика в имени файла не мешает', () => {
    // Сборщики отдают id с хвостом: `App.tsx?raw`, `App.tsx?used&lang.tsx`.
    const scan = createScanner({
      attr: 'class',
      syntax: true,
    });
    expect(scan(SOURCE, '/src/App.tsx?used&lang.tsx')).toEqual(['m5']);
    expect(scan(SOURCE, '/src/App.tsx?raw')).toEqual(['m5']);
    expect(isSyntaxScannable('/src/App.tsx?raw')).toBe(true);
    expect(isSyntaxScannable('/src/style.css?used')).toBe(false);
  });

  test('парсер недоступен: предупреждение один раз и откат к тексту', () => {
    // Необязательная peer-зависимость: её отсутствие не повод ронять сборку,
    // но и молчать нельзя — режим включён, а не работает.
    jest.resetModules();
    jest.doMock('../syntaxScan', () => {
      throw new Error('Cannot find module \'typescript\'');
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('../scanner') as typeof import('../scanner');
    const said: string[] = [];
    const scan = fresh.createScanner({
      attr: 'class',
      syntax: true,
      onWarning: (m: string) => said.push(m),
    });

    expect(scan(SOURCE, '/src/App.tsx')).toEqual(['m5']);
    expect(scan(SOURCE, '/src/Other.tsx')).toEqual(['m5']);

    expect(said.length).toBe(1);
    expect(said[0]).toContain('парсер недоступен');
    jest.dontMock('../syntaxScan');
    jest.resetModules();
  });

  test('парсер недоступен и своего логгера нет: пишем в console', () => {
    jest.resetModules();
    jest.doMock('../syntaxScan', () => {
      throw new Error('нет парсера');
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('../scanner') as typeof import('../scanner');
    const said: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn')
      .mockImplementation((m) => said.push(String(m)));

    try {
      fresh.createScanner({
        attr: 'class',
        syntax: true,
      })(SOURCE, '/src/App.tsx');
    } finally {
      warnSpy.mockRestore();
      jest.dontMock('../syntaxScan');
      jest.resetModules();
    }

    expect(said.join('')).toContain('[minotation]');
  });
});
