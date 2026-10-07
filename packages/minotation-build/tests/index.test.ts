/**
 * Каркас плагинов сборщиков: трек `tooling-gaps`, задача 4.
 *
 *
 * Сюда переехало то, что дублировалось в четырёх плагинах: учёт токенов по
 * файлам, снятие файла с учёта, компиляция с кешем, проброс предупреждений и
 * обход директории. Тесты здесь — общие для всех плагинов сразу; раньше
 * каждый проверял своё, и разница между ними была не видна.
 */
import {
  mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  createAttrsScanner, createBuildCollector, createFileFilter, createTokenCollector,
  formatFileName, manifestFileName, manifestOf, metricsFileName, parseAttrs, walkFiles,
} from '../src/index';
import {
  presetStandard,
} from 'minotation';

const OPTIONS = {
  attrs: 'class',
  presets: [presetStandard],
};

describe('createTokenCollector — учёт токенов', () => {
  test('собирает токены файла в CSS', () => {
    const collector = createTokenCollector(OPTIONS);

    expect(collector.add('/a.html', '<div class="p10 dF">')).toBe(true);
    const css = collector.css();
    expect(css).toContain('padding:10px');
    expect(css).toContain('display:flex');
  });

  test('набор файла заменяется, а не дополняется', () => {
    // Иначе токен, убранный при редактировании, оставался бы в CSS до
    // перезапуска сборки — именно этим болел плоский Set до Q-09.
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10 m20">');
    collector.add('/a.html', '<div class="p10">');

    const css = collector.css();
    expect(css).toContain('padding:10px');
    expect(css).not.toContain('margin:20px');
  });

  test('повторный `add` с тем же набором не считается изменением', () => {
    // По этому признаку плагины решают, нужна ли пересборка.
    const collector = createTokenCollector(OPTIONS);
    expect(collector.add('/a.html', '<div class="p10">')).toBe(true);
    expect(collector.add('/a.html', '<div class="p10">')).toBe(false);
    // Другой порядок тех же токенов — тоже не изменение.
    expect(collector.add('/a.html', '<div class="p10 p10">')).toBe(false);
  });

  test('тот же размер набора, но другой состав — это изменение', () => {
    // Сравнение по количеству токенов пропустило бы такую правку, и CSS
    // остался бы от прошлой версии файла.
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10 m20">');
    expect(collector.add('/a.html', '<div class="p10 w50">')).toBe(true);

    const css = collector.css();
    expect(css).toContain('width:50px');
    expect(css).not.toContain('margin:20px');
  });

  test('`set` принимает готовые токены — для webpack, где сканирует лоадер', () => {
    const collector = createTokenCollector(OPTIONS);

    expect(collector.set('/a.html', ['p10', 'm20'])).toBe(true);
    expect(collector.set('/a.html', ['p10', 'm20'])).toBe(false);
    expect(collector.css()).toContain('padding:10px');

    // Пустой список снимает файл с учёта, как и пустой исходник.
    expect(collector.set('/a.html', [])).toBe(true);
    expect(collector.has('/a.html')).toBe(false);
  });

  test('файл без токенов снимается с учёта', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10">');

    expect(collector.has('/a.html')).toBe(true);
    expect(collector.add('/a.html', '<div>')).toBe(true);
    expect(collector.has('/a.html')).toBe(false);
    expect(collector.css()).not.toContain('padding:10px');
  });

  test('`remove` убирает токены файла из CSS', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10">');
    collector.add('/b.html', '<div class="m20">');

    expect(collector.remove('/a.html')).toBe(true);
    // Файла нет на учёте — убирать нечего.
    expect(collector.remove('/a.html')).toBe(false);

    const css = collector.css();
    expect(css).not.toContain('padding:10px');
    expect(css).toContain('margin:20px');
  });

  test('`clear` забывает и токены, и пресеты', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10">');
    collector.setPreset('/theme.mn.ts', (mn) => {
      mn('brand', () => ({
        style: {
          color: '#f00',
        },
      }));
    });
    collector.add('/b.html', '<div class="brand">');

    collector.clear();

    expect(collector.css()).not.toContain('padding:10px');
    expect(collector.has('/a.html')).toBe(false);
  });

  test('safelist попадает в CSS, даже если в файлах не встретился', () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      safelist: ['m20'],
    });
    collector.add('/a.html', '<div class="p10">');

    expect(collector.css()).toContain('margin:20px');
  });

  test('attr массивом — class из .astro и className из .tsx в одной сборке', () => {
    // `affiliate`: страницы `.astro` пишут `class`, React-компоненты — `className`.
    const collector = createTokenCollector({
      ...OPTIONS,
      attrs: ['class', 'className:class'],
    });
    collector.add('/Page.astro', '<div class="p10"></div>');
    collector.add('/Card.tsx', 'export const Card = () => <Box className="m10" />;');
    collector.add('/Mixed.html', '<div class="w20" className="h30"></div>');

    const css = collector.css();
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin:10px');
    expect(css).toContain('width:20px');
    expect(css).toContain('height:30px');
  });

  test('имя файла доходит до сканера — .tsx разбирается парсером', () => {
    // Сканер выбирает способ разбора по расширению; каркас обязан передать
    // ему имя, иначе `.tsx` разбирался бы текстом, как раньше.
    const collector = createTokenCollector(OPTIONS);
    collector.add('/App.tsx', 'const re = /"/;\n// class="p99"\n<div class="p10" />');

    const css = collector.css();
    expect(css).toContain('padding:10px');
    expect(css).not.toContain('padding:99px');
  });
});

describe('createTokenCollector — пресеты', () => {
  test('динамический пресет применяется к компиляции', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.setPreset('/theme.mn.ts', (mn) => {
      mn('brand', () => ({
        style: {
          color: '#f00',
        },
      }));
    });
    collector.add('/a.html', '<div class="brand">');

    expect(collector.css()).toContain('color:#f00');
  });

  test('снятый пресет перестаёт применяться', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.setPreset('/theme.mn.ts', (mn) => {
      mn('brand', () => ({
        style: {
          color: '#f00',
        },
      }));
    });
    collector.add('/a.html', '<div class="brand p10">');
    expect(collector.css()).toContain('color:#f00');

    expect(collector.removePreset('/theme.mn.ts')).toBe(true);
    expect(collector.removePreset('/theme.mn.ts')).toBe(false);

    const css = collector.css();
    expect(css).not.toContain('color:#f00');
    expect(css).toContain('padding:10px');
  });

  test('без `presets` работают одни динамические', () => {
    const collector = createTokenCollector({
      attrs: 'class',
    });
    collector.setPreset('/theme.mn.ts', (mn) => {
      mn('brand', () => ({
        style: {
          color: '#f00',
        },
      }));
    });
    collector.add('/a.html', '<div class="brand p10">');

    const css = collector.css();
    expect(css).toContain('color:#f00');
    // Стандартного пресета нет — `p10` компилировать нечем.
    expect(css).not.toContain('padding:10px');
  });
});

describe('createTokenCollector — кеш', () => {
  test('без изменений CSS не пересчитывается', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10">');

    const first = collector.css();
    // Та же ссылка означает, что второй компиляции не было: строки в JS
    // неизменяемы, и новая компиляция вернула бы новый объект.
    expect(collector.css()).toBe(first);
  });

  test('изменение набора сбрасывает кеш', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="p10">');
    const first = collector.css();

    collector.add('/b.html', '<div class="m20">');
    const second = collector.css();

    expect(second).not.toBe(first);
    expect(second).toContain('margin:20px');
  });

  test('новый пресет сбрасывает кеш, хотя токены те же', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="brand">');
    const before = collector.css();

    collector.setPreset('/theme.mn.ts', (mn) => {
      mn('brand', () => ({
        style: {
          color: '#f00',
        },
      }));
    });

    expect(collector.css()).not.toBe(before);
    expect(collector.css()).toContain('color:#f00');
  });

  test('снятие пресета тоже сбрасывает кеш', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.setPreset('/theme.mn.ts', (mn) => {
      mn('brand', () => ({
        style: {
          color: '#f00',
        },
      }));
    });
    collector.add('/a.html', '<div class="brand">');
    const before = collector.css();

    collector.removePreset('/theme.mn.ts');

    expect(collector.css()).not.toBe(before);
  });
});

describe('createTokenCollector — предупреждения', () => {
  test('битый токен доходит до вызывающего и очередь очищается', () => {
    const collector = createTokenCollector(OPTIONS);
    collector.add('/a.html', '<div class="w10zz p10">');
    collector.css();

    const warnings = collector.takeWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].token).toBe('w10zz');
    // Забрали — очередь пуста, иначе сборщик печатал бы одно и то же дважды.
    expect(collector.takeWarnings()).toEqual([]);
  });

  test("`warningMode: 'silent'` гасит предупреждения", () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      warningMode: 'silent',
    });
    collector.add('/a.html', '<div class="w10zz">');
    collector.css();

    expect(collector.takeWarnings()).toEqual([]);
  });

  test('своя функция вызывается и накопление не отменяет', () => {
    const seen: string[] = [];
    const collector = createTokenCollector({
      ...OPTIONS,
      onWarning: (warning) => {
        seen.push(warning.token);
      },
    });
    collector.add('/a.html', '<div class="w10zz">');
    collector.css();

    expect(seen).toEqual(['w10zz']);
    expect(collector.takeWarnings().length).toBe(1);
  });
});

describe('walkFiles', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mn-walk-'));
  });

  afterEach(() => {
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  });

  function write(name: string): string {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), {
      recursive: true,
    });
    writeFileSync(
      full, '', 'utf8',
    );
    return full;
  }

  test('обходит рекурсивно и фильтрует по расширению', () => {
    write('a.html');
    write('nested/b.tsx');
    write('nested/c.css');

    expect(walkFiles(dir, ['.html', '.tsx']).sort()).toEqual([join(dir, 'a.html'), join(dir, 'nested/b.tsx')].sort());
  });

  test('скрытые директории и node_modules пропускаются', () => {
    write('a.html');
    write('.git/b.html');
    write('node_modules/pkg/c.html');

    expect(walkFiles(dir, ['.html'])).toEqual([join(dir, 'a.html')]);
  });

  test('глубина ограничена — защита от циклических симлинков', () => {
    write('deep/deeper/d.html');

    expect(walkFiles(
      dir, ['.html'], 1,
    )).toEqual([]);
    expect(walkFiles(
      dir, ['.html'], 2,
    )).toEqual([join(dir, 'deep/deeper/d.html')]);
  });

  test('нечитаемые пути не ломают обход', () => {
    // Битый симлинк или каталог без прав — не повод ронять сборку.
    write('a.html');
    symlinkSync(join(dir, 'нет-такого'), join(dir, 'broken.html'));

    expect(walkFiles(dir, ['.html'])).toEqual([join(dir, 'a.html')]);
    expect(walkFiles(join(dir, 'нет-такого'), ['.html'])).toEqual([]);
  });
});

describe('attrs — карта «сканируемый → целевой атрибут», как в v1 (D-025)', () => {
  test.each([
    [
      'строка',
      'class, className:class',
      {
        class: 'class',
        className: 'class', 
      },
    ],
    [
      'строка с | и ;',
      'class|m;m-n',
      {
        class: 'class',
        m: 'm',
        'm-n': 'm-n', 
      },
    ],
    [
      'массив',
      ['class', 'className:class'],
      {
        class: 'class',
        className: 'class', 
      },
    ],
    [
      'объект',
      {
        className: 'class',
        class: 'class', 
      },
      {
        className: 'class',
        class: 'class', 
      },
    ],
    [
      'по умолчанию',
      undefined,
      {
        class: 'class', 
      },
    ],
  ])('%s', (
    _name, attrs, expected,
  ) => {
    expect(parseAttrs(attrs as never)).toEqual(expected);
  });

  test.each([
    ['пустая строка', ''],
    ['пустой массив', []],
    ['объект без строковых значений', {
      class: '', 
    }],
  ])('%s — ошибка, а не сборка без единого токена', (_name, attrs) => {
    expect(() => parseAttrs(attrs as never)).toThrow('attrs is empty');
  });

  test('пример владельца: attrs [class, className] — className в свой атрибут', () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      attrs: ['class', 'className'],
    });
    collector.add('/a.html', '<div class="ws" className="ws">...</div>');

    expect(collector.css()).toContain('.ws,[className~="ws"]{white-space:nowrap}');
  });

  test('className:class — оба атрибута дают один класс', () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      attrs: 'class, className:class',
    });
    collector.add('/a.html', '<div class="ws" className="ws">...</div>');

    const css = collector.css();
    expect(css).toContain('.ws{white-space:nowrap}');
    expect(css).not.toContain('[className');
  });

  test('m и m-n — селекторы по атрибуту', () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      attrs: [
        'class',
        'm',
        'm-n',
      ],
    });
    collector.add('/a.html', '<div m="p10" m-n="w20" class="h30"></div>');

    const css = collector.css();
    expect(css).toContain('[m~="p10"]{padding:10px}');
    expect(css).toContain('[m-n~="w20"]{width:20px}');
    expect(css).toContain('.h30{height:30px}');
  });

  test('переменные *Class и вызовы mne идут в class, а не в каждую цель', () => {
    const scan = createAttrsScanner({
      attrs: ['m', 'class'],
    });
    expect(scan("const aClass = 'p10'; mne(x, 'w20'); <i m=\"h30\" />", '/a.tsx').sort())
      .toEqual([
        'class p10',
        'class w20',
        'm h30',
      ]);
  });

  test('без группы class переменные идут в первую цель', () => {
    const scan = createAttrsScanner({
      attrs: 'm',
    });
    expect(scan("const aClass = 'p10'; <i m=\"h30\" />", '/a.tsx').sort())
      .toEqual(['m h30', 'm p10']);
  });

});

describe('createFileFilter — отбор файлов, как в v1 (D-026, D-027)', () => {
  const ROOT = '/proj';

  test('по умолчанию — по расширениям; пресеты не сканируются', () => {
    const filter = createFileFilter({}, ROOT);
    expect(filter.accepts('/proj/src/a.tsx')).toBe(true);
    expect(filter.accepts('/proj/src/a.css')).toBe(false);
    expect(filter.accepts('/proj/src/app.mn.ts')).toBe(false);
    expect(filter.isPreset('/proj/src/app.mn.ts')).toBe(true);
  });

  test.each([
    ['RegExp', /\.tpl$/],
    ['функция', (path: string) => path.endsWith('.tpl')],
    ['путь от корня', './src/a.tpl'],
    ['абсолютный путь', '/proj/src/a.tpl'],
    ['массив', [/\.php$/, 'src/a.tpl']],
  ])('include: %s', (_name, include) => {
    const filter = createFileFilter({
      include: include as never, 
    }, ROOT);
    expect(filter.accepts('/proj/src/a.tpl')).toBe(true);
    expect(filter.accepts('/proj/src/a.html')).toBe(false);
  });

  test('RegExp с флагом g не теряет совпадения между файлами', () => {
    const filter = createFileFilter({
      include: /\.tpl$/g, 
    }, ROOT);
    expect(filter.accepts('/proj/a.tpl')).toBe(true);
    expect(filter.accepts('/proj/b.tpl')).toBe(true);
  });

  test('exclude важнее include и extensions', () => {
    const filter = createFileFilter({
      exclude: /vendor/, 
    }, ROOT);
    expect(filter.accepts('/proj/vendor/a.html')).toBe(false);
    expect(filter.accepts('/proj/src/a.html')).toBe(true);
  });

  test('skipPartials — только по имени файла, не по каталогу', () => {
    const filter = createFileFilter({
      skipPartials: true, 
    }, ROOT);
    expect(filter.accepts('/proj/src/_header.html')).toBe(false);
    expect(filter.accepts('/proj/_layouts/page.html')).toBe(true);
    expect(createFileFilter({}, ROOT).accepts('/proj/src/_header.html')).toBe(true);
  });

  test('safelist — группы токенов через пробел', () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      safelist: ['p10  m20', ''],
    });
    const css = collector.css();
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin:20px');
  });
});

describe('createBuildCollector — записи entry (D-030)', () => {
  test('без entry — одна запись mn', () => {
    const build = createBuildCollector(OPTIONS, '/proj');
    build.add('/proj/a.html', '<div class="p10">');
    expect(build.names).toEqual(['mn']);
    expect(build.outputs()[0].css).toContain('padding:10px');
  });

  test('файл достаётся записям по их include/exclude', () => {
    const build = createBuildCollector({
      ...OPTIONS,
      entry: {
        site: {
          include: /site/, 
        },
        admin: {
          include: /admin/,
          selectorPrefix: '.adm ', 
        },
        all: {},
      },
    }, '/proj');
    build.add('/proj/site/a.html', '<div class="p10">');
    build.add('/proj/admin/b.html', '<div class="m20">');
    const [
      site,
      admin,
      all,
    ] = build.outputs();
    expect(site.css).toContain('padding:10px');
    expect(site.css).not.toContain('margin:20px');
    expect(admin.css).toContain('.adm .m20{margin:20px}');
    expect(admin.css).not.toContain('padding:10px');
    expect(all.css).toContain('padding:10px');
    expect(all.css).toContain('margin:20px');
  });

  test('у записи могут быть свои attrs', () => {
    const build = createBuildCollector({
      ...OPTIONS,
      entry: {
        a: {},
        b: {},
        c: {
          attrs: 'm', 
        }, 
      },
    }, '/proj');
    build.add('/proj/x.html', '<div class="p10" m="w20">');
    const [
      a,
      b,
      c,
    ] = build.outputs();
    expect(a.css).toBe(b.css);
    expect(a.css).toContain('.p10{padding:10px}');
    expect(c.css).toContain('[m~="w20"]{width:20px}');
    expect(c.css).not.toContain('.p10');
  });

  test('remove, set, has, пресеты и clear — по всем записям', () => {
    const build = createBuildCollector({
      ...OPTIONS,
      entry: {
        a: {},
        b: {
          include: /never/, 
        }, 
      },
    }, '/proj');
    expect(build.set('/proj/a.html', ['class p10'])).toBe(true);
    expect(build.has('/proj/a.html')).toBe(true);
    build.setPreset('/proj/x.mn.ts', (mn) => mn('pToken', 'cF00'));
    build.set('/proj/b.html', ['class pToken']);
    expect(build.outputs()[0].css).toContain('color:#f00');
    expect(build.removePreset('/proj/x.mn.ts')).toBe(true);
    expect(build.removePreset('/proj/x.mn.ts')).toBe(false);
    expect(build.remove('/proj/a.html')).toBe(true);
    expect(build.remove('/proj/a.html')).toBe(false);
    build.clear();
    expect(build.has('/proj/b.html')).toBe(false);
  });

  test('предупреждения общих токенов не дублируются', () => {
    const build = createBuildCollector({
      ...OPTIONS,
      entry: {
        a: {},
        b: {}, 
      },
    }, '/proj');
    build.add('/proj/a.html', '<div class="w10qq">');
    build.outputs();
    expect(build.takeWarnings()).toHaveLength(1);
  });

  test('пустой entry — ошибка', () => {
    expect(() => createBuildCollector({
      entry: {}, 
    }, '/proj')).toThrow('entry is empty');
  });
});

describe('formatFileName и манифест (D-031)', () => {
  test('[name] и [hash] — хеш меняется вместе с содержимым', () => {
    const a = formatFileName(
      '[name].[hash].css', 'mn', '.p10{padding:10px}',
    );
    const b = formatFileName(
      '[name].[hash].css', 'mn', '.p10{padding:11px}',
    );
    expect(a).toMatch(/^mn\.[0-9a-f]{8}\.css$/);
    expect(a).not.toBe(b);
    expect(formatFileName(
      'mn.css', 'site', 'x',
    )).toBe('mn.css');
  });

  test('манифест: логическое имя → фактическое', () => {
    expect(manifestOf({
      mn: 'mn.3f9a1c2e.css', 
    })).toEqual({
      'mn.css': 'mn.3f9a1c2e.css', 
    });
    expect(manifestFileName(undefined)).toBe('mn-manifest.json');
    expect(manifestFileName(true)).toBe('mn-manifest.json');
    expect(manifestFileName('dist/css.json')).toBe('dist/css.json');
    expect(manifestFileName(false)).toBeUndefined();
  });
});

describe('опции ядра — плоско, без mn (D-034)', () => {
  test('selectorPrefix, altColor — на верхнем уровне', () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      selectorPrefix: '.app ',
    });
    collector.add('/a.html', '<div class="p10">');
    expect(collector.css()).toContain('.app .p10{padding:10px}');
  });

  test('колбэк сканера — onScannerWarning; onWarning сканеру не передаётся', () => {
    const said: string[] = [];
    const scan = createAttrsScanner({
      syntax: false,
      onScannerWarning: (message) => said.push(message),
    });
    expect(scan('<div class="p10">', '/a.html')).toEqual(['class p10']);
    expect(said).toEqual([]);
  });
});

describe('статистика употребления токенов (D-032)', () => {
  test('общий список и по файлам; атрибут не class — в ключе; safelist — в tokensTotal', () => {
    const build = createBuildCollector({
      ...OPTIONS,
      attrs: 'class, m',
      safelist: ['dF'],
    }, '/proj');
    build.add('/proj/src/a.html', '<div class="p10 p10 m20" m="p10"></div>');
    build.add('/proj/src/b.html', '<div class="p10"></div>');
    build.add('/proj/src/empty.html', '<div></div>');

    expect(build.metrics()).toEqual({
      filesScanned: 3,
      tokensTotal: 4,
      occurrences: 5,
      tokens: [
        {
          name: 'p10',
          count: 3, 
        },
        {
          name: 'm20',
          count: 1, 
        },
        {
          name: 'm:p10',
          count: 1, 
        },
      ],
      files: {
        'src/a.html': [
          {
            name: 'p10',
            count: 2, 
          },
          {
            name: 'm20',
            count: 1, 
          },
          {
            name: 'm:p10',
            count: 1, 
          },
        ],
        'src/b.html': [{
          name: 'p10',
          count: 1, 
        }],
      },
    });
  });

  test('снятый с учёта файл и clear — из статистики уходят; set считается тоже', () => {
    const build = createBuildCollector(OPTIONS, '/proj');
    build.add('/proj/a.html', '<div class="p10">');
    build.set('/proj/b.html', ['class m20', 'class m20']);
    expect(build.metrics().tokens).toEqual([{
      name: 'm20',
      count: 2, 
    }, {
      name: 'p10',
      count: 1, 
    }]);
    build.remove('/proj/a.html');
    expect(build.metrics().filesScanned).toBe(1);
    build.clear();
    expect(build.metrics()).toEqual({
      filesScanned: 0,
      tokensTotal: 0,
      occurrences: 0,
      tokens: [],
      files: {},
    });
  });

  test('равная частота — по имени, отчёт не зависит от порядка файлов', () => {
    const build = createBuildCollector(OPTIONS, '/proj');
    build.add('/proj/a.html', '<div class="w10 m20 h30">');
    expect(build.metrics().tokens.map((t) => t.name)).toEqual([
      'h30',
      'm20',
      'w10',
    ]);
  });

  test('путь отчёта: по умолчанию mn-metrics.json, строка — свой, false — нет', () => {
    expect(metricsFileName(undefined)).toBe('mn-metrics.json');
    expect(metricsFileName(true)).toBe('mn-metrics.json');
    expect(metricsFileName('reports/mn.json')).toBe('reports/mn.json');
    expect(metricsFileName(false)).toBeUndefined();
  });
});

describe('warningMode в накопителе (D-035)', () => {
  test("'error' — сборка падает на предупреждении, колбэк вызван", () => {
    const seen: string[] = [];
    const collector = createTokenCollector({
      ...OPTIONS,
      warningMode: 'error',
      onWarning: (warning) => seen.push(warning.token),
    });
    collector.add('/a.html', '<div class="w10zz">');
    expect(() => collector.css()).toThrow("warningMode: 'error'");
    expect(seen).toEqual(['w10zz']);
  });
});
