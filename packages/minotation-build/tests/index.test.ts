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
  createAttrsScanner, createTokenCollector, parseAttrs, walkFiles,
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

  test("`onWarning: 'silent'` гасит предупреждения", () => {
    const collector = createTokenCollector({
      ...OPTIONS,
      mn: {
        onWarning: 'silent',
      },
    });
    collector.add('/a.html', '<div class="w10zz">');
    collector.css();

    expect(collector.takeWarnings()).toEqual([]);
  });

  test('своя функция вызывается и накопление не отменяет', () => {
    const seen: string[] = [];
    const collector = createTokenCollector({
      ...OPTIONS,
      mn: {
        onWarning: (warning) => {
          seen.push(warning.token);
        },
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

  test('устаревший attr — ошибка с подсказкой, а не молчаливая потеря токенов', () => {
    expect(() => createTokenCollector({
      attr: ['class', 'className'],
    } as never)).toThrow("use attrs: 'class, className:class'");
    expect(() => createAttrsScanner({
      attr: 'class',
    } as never)).toThrow("use attrs: 'class'");
  });
});
