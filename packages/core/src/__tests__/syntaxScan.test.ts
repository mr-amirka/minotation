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
  scanTokensSfc, scanTokensSyntax,
} from '../syntaxScan';
import {
  createScanner, isSyntaxScannable, syntaxKindOf,
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

  test('вызов переменной с суффиксом — функции из mnClass', () => {
    expect(scanTokensSyntax('<th class={thClass(`w(|max)150`)} />', {
      attr: 'class',
    })).toEqual(['w(|max)150']);
    expect(scanTokensSyntax('el.thClass(\'p10\'); thClassy(\'m5\');', {
      attr: 'class',
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
    // SFC тоже разбираются — по блокам, см. `scanTokensSfc`.
    ['a.vue', true],
    ['a.svelte', true],
    ['a.astro', true],
    ['a.html', false],
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
    ['вызов функции из mnClass', '<th class={thClass(`w(|max)150`)} />;\nrowClass(\'p10\');'],
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
  /**
   * Файл, на котором текстовый сканер ошибается: кавычка внутри регулярного
   * литерала открывает для него строку, и следующий комментарий перестаёт
   * считаться комментарием. Порядок здесь важен — с обратным текстовый
   * справляется.
   */
  const SOURCE = 'const re = /"/;\n// class="p10"\n<div class="m5" />';

  test('по умолчанию — разбор, когда парсер доступен', () => {
    // Точный разбор это не дополнительная возможность, а отсутствие ложных
    // токенов: просить о нём отдельно незачем.
    const scan = createScanner({
      attr: 'class',
    });
    expect(scan(SOURCE, '/src/App.tsx')).toEqual(['m5']);
    // Текстовому сканеру тот же файл даёт лишний токен из комментария:
    // кавычка внутри `/"/` сбивает вырезание комментариев.
    expect(scan(SOURCE)).toEqual(['p10', 'm5']);
  });

  test('`syntax: false` — всегда текст, даже для .tsx', () => {
    const scan = createScanner({
      attr: 'class',
      syntax: false,
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

  test('в автоматическом режиме недоступный парсер — молча текст', () => {
    // Никто не просил синтаксического разбора, текстовый работает — сообщать
    // не о чем.
    jest.resetModules();
    jest.doMock('../syntaxScan', () => {
      throw new Error('Cannot find module \'typescript\'');
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('../scanner') as typeof import('../scanner');
    const said: string[] = [];
    const warnSpy = jest.spyOn(console, 'warn')
      .mockImplementation((m) => said.push(String(m)));

    try {
      const scan = fresh.createScanner({
        attr: 'class',
      });
      expect(scan(SOURCE, '/src/App.tsx')).toEqual(['p10', 'm5']);
    } finally {
      warnSpy.mockRestore();
      jest.dontMock('../syntaxScan');
      jest.resetModules();
    }

    expect(said).toEqual([]);
  });

  test('`syntax: true` и парсера нет: предупреждение один раз и откат к тексту', () => {
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

    // Без парсера остаётся текстовый разбор — с его ложным токеном.
    const textual = ['p10', 'm5'];
    expect(scan(SOURCE, '/src/App.tsx')).toEqual(textual);
    expect(scan(SOURCE, '/src/Other.tsx')).toEqual(textual);

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

/**
 * Однофайловые компоненты. Целиком парсером JS их не разобрать — у Vue,
 * Svelte и Astro свои компиляторы, то есть свои зависимости. Но ложные токены
 * берутся из скриптовой части, а она — обычный TS.
 */
describe('scanTokensSfc — Vue, Svelte, Astro', () => {
  const OPTIONS = {
    attr: 'class',
  };

  test('Vue: скрипт парсером, шаблон текстом', () => {
    const source = [
      '<template>',
      '  <div class="p10"><!-- <div class="p99"> --></div>',
      '</template>',
      '<script setup lang="ts">',
      'const re = /"/;',
      '/** Пример: <div class="p88 w888"> */',
      'const rowClass = "m20";',
      'mne(rowClass, "w50");',
      '</script>',
    ].join('\n');

    expect(setOf(scanTokensSfc(source, OPTIONS))).toEqual([
      'm20',
      'p10',
      'w50',
    ]);
  });

  test('Svelte: то же деление', () => {
    const source = [
      '<script lang="ts">',
      '  const re = /"/;',
      '  // class="p77"',
      '  const rowClass = "m30";',
      '</script>',
      '<div class="p20"></div>',
    ].join('\n');

    expect(setOf(scanTokensSfc(source, OPTIONS))).toEqual(['m30', 'p20']);
  });

  test('Astro: фронтматтер `---` разбирается как скрипт', () => {
    const source = [
      '---',
      'const re = /"/;',
      '// class="p66"',
      'const rowClass = "m40";',
      '---',
      '<div class="p30"></div>',
    ].join('\n');

    expect(setOf(scanTokensSfc(source, OPTIONS))).toEqual(['m40', 'p30']);
  });

  test('Astro: несколько блоков — фронтматтер и <script>', () => {
    const source = [
      '---',
      'const headClass = "m40";',
      '---',
      '<div class="p30"></div>',
      '<script>',
      '  const bodyClass = "m50";',
      '</script>',
    ].join('\n');

    expect(setOf(scanTokensSfc(source, OPTIONS))).toEqual([
      'm40',
      'm50',
      'p30',
    ]);
  });

  test('`lang="tsx"` разбирается с JSX, `lang="ts"` — без', () => {
    // В обычном `<script lang="ts">` символ `<` это generic или сравнение.
    const ts = '<script lang="ts">const v = <string>x; const aClass = "m20";</script>';
    expect(scanTokensSfc(ts, OPTIONS)).toEqual(['m20']);

    const tsx = '<script lang="tsx">const el = <div class="p10" />;</script>';
    expect(scanTokensSfc(tsx, OPTIONS)).toEqual(['p10']);
  });

  test('файл без скрипта — просто текстовый разбор', () => {
    const source = '<template><div class="p10"></div></template>';
    expect(scanTokensSfc(source, OPTIONS)).toEqual(['p10']);
  });

  test('незакрытый `<script` не ломает разбор остального', () => {
    // Файл в процессе редактирования — обычное дело.
    expect(scanTokensSfc('<div class="p10"></div><script', OPTIONS)).toEqual(['p10']);
    expect(scanTokensSfc('<div class="p10"></div><script>', OPTIONS)).toEqual(['p10']);
  });

  test('фронтматтер без закрывающего `---`', () => {
    expect(scanTokensSfc('---\nconst aClass = "m20";', OPTIONS)).toEqual(['m20']);
  });

  test('переводы строк вырезанного скрипта сохраняются', () => {
    // Иначе склеились бы соседние строки, и `class=` из-под скрипта попал бы
    // в чужой контекст.
    const source = '<script>\nconst a = 1;\n</script>\n<div class="p10"></div>';
    expect(scanTokensSfc(source, OPTIONS)).toEqual(['p10']);
  });

  test('через `createScanner` выбирается по расширению', () => {
    const scan = createScanner(OPTIONS);
    const source = '<script lang="ts">\n// class="p99"\nconst aClass = "m20";\n</script>\n'
      + '<div class="p10"></div>';

    expect(setOf(scan(source, 'App.vue'))).toEqual(['m20', 'p10']);
    expect(setOf(scan(source, 'App.svelte'))).toEqual(['m20', 'p10']);
    expect(setOf(scan(source, 'Page.astro'))).toEqual(['m20', 'p10']);
  });

  test.each([
    ['App.vue', 2],
    ['App.svelte', 2],
    ['Page.astro', 2],
    ['App.tsx', 1],
    ['App.ts', 1],
    ['index.html', 0],
    ['style.css', 0],
    // Скриптовый блок Vue приходит от сборщика отдельным id.
    ['App.vue?vue&type=script&lang.ts', 1],
  ])('syntaxKindOf(%p) === %p', (fileName, expected) => {
    expect(syntaxKindOf(fileName)).toBe(expected);
  });
});
