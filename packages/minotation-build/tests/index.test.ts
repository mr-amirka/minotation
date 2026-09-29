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
  createTokenCollector, walkFiles,
} from '../src/index';
import {
  presetStandard,
} from 'minotation';

const OPTIONS = {
  attr: 'class',
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
      attr: 'class',
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
