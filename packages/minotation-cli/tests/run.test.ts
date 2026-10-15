/**
 * Сборка настроек, запись результата, наблюдение.
 *
 * Вынесено из `cli.ts` именно ради этих тестов: иначе проверять пришлось бы
 * запуском процесса и перехватом `process.exit`.
 */
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync,
} from 'node:fs';
import {
  join, resolve,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  parseArgs,
} from '../src/args';
import {
  CONFIG_FILE_NAMES, scopeClassName,
} from 'minotation-build';
import {
  presetTw4,
} from 'minotation';
import type {
  MnPreset,
} from 'minotation';
import type {
  CompileResult,
} from '../src/compile';
import {
  build, loadConfig, mergeSettings, startWatch, DEFAULT_CONFIG,
} from '../src/run';
import type {
  Reporter, RunSettings,
} from '../src/run';

let dir: string;
let logs: string[];
let errors: string[];
let report: Reporter;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-cli-run-'));
  logs = [];
  errors = [];
  report = {
    log: (m: string) => logs.push(m),
    error: (m: string) => errors.push(m),
  };
});

afterEach(() => {
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

function write(name: string, text: string): string {
  const full = join(dir, name);
  mkdirSync(join(full, '..'), {
    recursive: true,
  });
  writeFileSync(
    full, text, 'utf8',
  );
  return full;
}

describe('loadConfig', () => {
  test('отсутствие конфига по умолчанию — не ошибка', () => {
    // CLI полезен и без конфига: все настройки задаются опциями.
    expect(loadConfig(undefined, report)).toEqual({});
  });

  test('явно указанный конфиг обязан существовать', () => {
    expect(() => loadConfig(join(dir, 'нет.js'), report))
      .toThrow('Config not found');
  });

  test('битый конфиг — ошибка даже с именем по умолчанию', () => {
    // Молча продолжить с умолчаниями значит собрать не то, что просили.
    const path = write('mn.config.cjs', 'module.exports = { : };');
    expect(() => loadConfig(path, report))
      .toThrow('Failed to read config');
  });

  test('опечатка и неверное значение в конфиге — ошибка с подсказкой (D-038)', () => {
    const typo = write('mn.typo.cjs', 'module.exports = { altColour: true };');
    expect(() => loadConfig(typo, report))
      .toThrow('unknown option "altColour". Did you mean "altColor"?');
    const bad = write('mn.bad.cjs', 'module.exports = { metrics: 1 };');
    expect(() => loadConfig(bad, report))
      .toThrow('option "metrics" expects a boolean or a string, got number 1');
  });

  test('файл общий для всех инструментов: опции плагинов допустимы, CLI берёт только свои (D-081)', () => {
    const path = write('shared.config.cjs', 'module.exports = { fileName: "a.css", inject: "link", altColor: true };');
    expect(loadConfig(path, report)).toEqual({
      altColor: true,
    });
    const bad = write('cli-bad.config.cjs', 'module.exports = { input: 1 };');
    expect(() => loadConfig(bad, report)).toThrow('option "input" expects a string, got number 1');
  });

  test('читает настройки из файла', () => {
    const path = write('mn.config.cjs', 'module.exports = { altColor: true };');
    const config = loadConfig(path, report);
    expect(config.altColor).toBe(true);
    expect(logs.some((m) => m.includes('Config'))).toBe(true);
  });

  test('понимает `export default`', () => {
    const path = write('esm.config.cjs', 'exports.default = { warningMode: "silent" };');
    expect(loadConfig(path, report).warningMode).toBe('silent');
  });
});

describe('mergeSettings', () => {
  test('аргументы важнее конфига', () => {
    const settings = mergeSettings(parseArgs([
      './src',
      '--warning-mode',
      'error',
    ]), {
      warningMode: 'silent',
    });
    expect(settings.warningMode).toBe('error');
  });

  test('без аргумента берётся значение из конфига', () => {
    expect(mergeSettings(parseArgs(['./src']), {
      warningMode: 'silent',
    }).warningMode).toBe('silent');
  });

  test('путь, вывод и атрибут тоже берутся из конфига', () => {
    // У них есть умолчания, и раньше эти умолчания молча перекрывали конфиг.
    const settings = mergeSettings(parseArgs([]), {
      input: './шаблоны',
      output: './dist/app.css',
      attrs: 'className:class',
    });
    expect(settings.input).toBe('./шаблоны');
    expect(settings.output).toBe('./dist/app.css');
    expect(settings.attrs).toBe('className:class');
  });

  test('умолчания применяются, когда нет ни аргумента, ни конфига', () => {
    const settings = mergeSettings(parseArgs([]), {});
    expect(settings.input).toBe('./');
    expect(settings.output).toBe('./mn.css');
    expect(settings.attrs).toBe('class');
  });

  test('аргумент важнее конфига и у этих трёх', () => {
    const settings = mergeSettings(parseArgs([
      './src',
      '-o',
      './a.css',
      '-a',
      'class',
    ]), {
      input: './шаблоны',
      output: './dist/app.css',
      attrs: 'className:class',
    });
    expect(settings.input).toBe('./src');
    expect(settings.output).toBe('./a.css');
    expect(settings.attrs).toBe('class');
  });

  test('флаги складываются: включён хоть где-то — включён', () => {
    expect(mergeSettings(parseArgs(['--skip-partials']), {}).skipPartials).toBe(true);
    expect(mergeSettings(parseArgs([]), {
      skipPartials: true, 
    }).skipPartials).toBe(true);
    // Флаг важнее конфига.
    expect(mergeSettings(parseArgs(['--warning-mode', 'error']), {
      warningMode: 'silent',
    }).warningMode).toBe('error');
    expect(mergeSettings(parseArgs([]), {
      warningMode: 'error',
    }).warningMode).toBe('error');
    // Режимы *N и -i (D-039): флаг важнее конфига.
    const merged = mergeSettings(parseArgs(['--specificity-mode', 'strict']), {
      specificityMode: 'silent',
      importantMode: 'silent',
    });
    expect(merged.specificityMode).toBe('strict');
    expect(merged.importantMode).toBe('silent');
    expect(mergeSettings(parseArgs(['--child-selector-mode', 'silent']), {}).childSelectorMode).toBe('silent');
    expect(mergeSettings(parseArgs([]), {
      unknownMediaMode: 'strict',
    }).unknownMediaMode).toBe('strict');
    expect(mergeSettings(parseArgs([]), {
      suspectClassMode: 'silent',
    }).suspectClassMode).toBe('silent');
    expect(mergeSettings(parseArgs([
      '--handler-conflict-mode',
      'silent',
      '--preset-conflict-mode',
      'strict',
    ]), {}))
      .toMatchObject({
        handlerConflictMode: 'silent',
        presetConflictMode: 'strict',
      });
    expect(mergeSettings(parseArgs(['--group-mode', 'css']), {
      groupSuspectMode: 'silent',
    })).toMatchObject({
      groupMode: 'css',
      groupSuspectMode: 'silent',
    });
    expect(mergeSettings(parseArgs([]), {
      notationMode: 'tw4-compatible',
    }).notationMode).toBe('tw4-compatible');
    expect(mergeSettings(parseArgs(['--context-where']), {}).contextWhere).toBe(true);
    expect(mergeSettings(parseArgs(['--media-nesting']), {}).mediaNesting).toBe(true);
    expect(mergeSettings(parseArgs([]), {
      mediaNesting: true,
    }).mediaNesting).toBe(true);
    expect(mergeSettings(parseArgs(['--notation-conflict-mode', 'strict']), {}).notationConflictMode).toBe('strict');
    expect(mergeSettings(parseArgs([]), {
      contextWhere: true,
    }).contextWhere).toBe(true);
  });

  test('синтаксический разбор: по умолчанию авто, `--no-syntax` выключает', () => {
    // `undefined` означает «решай сам»: есть парсер — разбором, нет — текстом.
    expect(mergeSettings(parseArgs([]), {}).syntax).toBeUndefined();
    expect(mergeSettings(parseArgs(['--no-syntax']), {}).syntax).toBe(false);
    // Конфиг тоже может выключить или потребовать явно.
    expect(mergeSettings(parseArgs([]), {
      syntax: false,
    }).syntax).toBe(false);
    expect(mergeSettings(parseArgs([]), {
      syntax: true,
    }).syntax).toBe(true);
    // Аргумент важнее конфига.
    expect(mergeSettings(parseArgs(['--no-syntax']), {
      syntax: true,
    }).syntax).toBe(false);
  });

  test('файл конфигурации не сканируется как исходник', () => {
    const settings = mergeSettings(parseArgs(['-c', './my.config.js']), {});
    expect(settings.ignore).toContain(resolve('./my.config.js'));
    // Без опции исключается конфиг по умолчанию.
    expect(mergeSettings(parseArgs([]), {}).ignore)
      .toContain(resolve(DEFAULT_CONFIG));
  });

  test('`ignore` из конфига сохраняется', () => {
    const settings = mergeSettings(parseArgs([]), {
      ignore: ['./legacy.js'],
    });
    expect(settings.ignore).toEqual(['./legacy.js'].concat(CONFIG_FILE_NAMES.map((name) => resolve(name))));
  });

  test('`include` и `exclude` из строк превращаются в регулярки', () => {
    const settings = mergeSettings(parseArgs([
      '--include',
      '\\.html$',
      '--exclude',
      'vendor',
    ]), {});
    expect(settings.include).toBeInstanceOf(RegExp);
    expect((settings.include as RegExp).test('a.html')).toBe(true);
    expect((settings.exclude as RegExp).test('/vendor/a.html')).toBe(true);
  });
});

describe('build', () => {
  test('пишет CSS и отчитывается', () => {
    write('a.html', '<div class="p10">');
    const out = join(
      dir, 'out', 'app.css',
    );
    const result = build({
      input: dir,
      output: out,
    }, report);
    expect(readFileSync(out, 'utf8')).toContain('padding:10px');
    expect(result.files).toBe(1);
    expect(logs.some((m) => m.includes('1 files'))).toBe(true);
  });

  test('создаёт директорию вывода, если её нет', () => {
    write('a.html', '<div class="p10">');
    const out = join(
      dir, 'глубоко', 'внутри', 'app.css',
    );
    build({
      input: dir,
      output: out,
    }, report);
    expect(existsSync(out)).toBe(true);
  });

  test('предупреждения печатаются, но сборку не останавливают', () => {
    write('a.html', '<div class="w10zz p10">');
    build({
      input: dir,
      output: join(dir, 'out.css'),
    }, report);
    expect(errors.some((m) => m.includes('Warning'))).toBe(true);
    expect(readFileSync(join(dir, 'out.css'), 'utf8')).toContain('padding:10px');
  });
});

/**
 * Запас времени watch-тестам.
 *
 * Сама пересборка занимает 5–14 мс (замерено), ждём мы не её: `fs.watch` с
 * `recursive` на macOS уведомляет об изменении во временной директории с
 * задержкой, которая на загруженной машине доходит до секунд. Умолчания jest
 * в 5 с не хватало — тест падал по таймауту, хотя всё работало.
 */
const WATCH_TIMEOUT = 20000;

/**
 * Ждёт условия, повторяя действие на каждой попытке.
 *
 * Повтор нужен не для надёжности «на всякий случай», а из-за устройства
 * `fs.watch` на macOS: вызов возвращает объект сразу, но подписка FSEvents
 * устанавливается асинхронно, и запись, случившаяся в этот зазор, событием не
 * становится — наблюдение работает, а уведомления нет. Одна запись в начале
 * теста давала падение примерно раз в три прогона.
 */
async function untilRetrying(
  act: () => void, check: () => boolean, what: string,
): Promise<void> {
  const deadline = Date.now() + WATCH_TIMEOUT - 2000;
  while (Date.now() < deadline) {
    act();
    if (check()) {
      return;
    }
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error('не дождались: ' + what);
}

describe('build — имя файла, entry и манифест (D-030, D-031)', () => {
  test('по умолчанию — манифест рядом с CSS', () => {
    write('src/a.html', '<div class="p10">');
    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', 'mn.css',
      ),
    }, report);
    expect(JSON.parse(readFileSync(join(
      dir, 'out', 'mn-manifest.json',
    ), 'utf8')))
      .toEqual({
        'mn.css': 'mn.css', 
      });
  });

  test('[name] и [hash] в --output; манифест знает фактическое имя', () => {
    write('src/a.html', '<div class="p10">');
    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', '[name].[hash].css',
      ),
    }, report);
    const manifest = JSON.parse(readFileSync(join(
      dir, 'out', 'mn-manifest.json',
    ), 'utf8'));
    expect(manifest['mn.css']).toMatch(/^mn\.[0-9a-f]{8}\.css$/);
    expect(readFileSync(join(
      dir, 'out', manifest['mn.css'],
    ), 'utf8')).toContain('padding:10px');
  });

  test('entry — файл на запись; свой fileName; манифест по указанному пути', () => {
    write('src/site/a.html', '<div class="p10">');
    write('src/admin/b.html', '<div class="m20">');
    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', '[name].css',
      ),
      manifest: join(
        dir, 'meta', 'css.json',
      ),
      entry: {
        site: {
          include: /site/, 
        },
        admin: {
          include: /admin/,
          fileName: join(
            dir, 'out', 'adm.css',
          ), 
        },
      },
    }, report);
    expect(readFileSync(join(
      dir, 'out', 'site.css',
    ), 'utf8')).toContain('padding:10px');
    expect(readFileSync(join(
      dir, 'out', 'adm.css',
    ), 'utf8')).toContain('margin:20px');
    expect(readFileSync(join(
      dir, 'out', 'adm.css',
    ), 'utf8')).not.toContain('padding:10px');
    expect(JSON.parse(readFileSync(join(
      dir, 'meta', 'css.json',
    ), 'utf8'))).toEqual({
      'site.css': join(
        '..', 'out', 'site.css',
      ),
      'admin.css': join(
        '..', 'out', 'adm.css',
      ),
    });
  });

  test('несколько записей без [name] — ошибка, а не перезапись одного файла', () => {
    write('src/site/a.html', '<div class="p10">');
    write('src/admin/b.html', '<div class="m20">');
    expect(() => build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', 'mn.css',
      ),
      entry: {
        site: {
          include: /site/, 
        },
        admin: {
          include: /admin/, 
        }, 
      },
    }, report)).toThrow('add [name] to --output');
  });

  test('manifest: false и --no-manifest — без манифеста; нет токенов — нет файлов', () => {
    write('src/a.html', '<div class="p10">');
    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', 'mn.css',
      ),
      manifest: false,
    }, report);
    expect(existsSync(join(
      dir, 'out', 'mn-manifest.json',
    ))).toBe(false);
    expect(mergeSettings(parseArgs(['--no-manifest']), {}).manifest).toBe(false);
    expect(mergeSettings(parseArgs([]), {
      manifest: 'x.json', 
    }).manifest).toBe('x.json');

    write('empty/b.html', '<div>');
    build({
      input: join(dir, 'empty'),
      output: join(
        dir, 'none', 'mn.css',
      ),
      presets: [],
    }, report);
    // CSS нет, а отчёт статистики есть — «токенов ноль» тоже результат.
    expect(existsSync(join(
      dir, 'none', 'mn.css',
    ))).toBe(false);
    expect(existsSync(join(
      dir, 'none', 'mn-manifest.json',
    ))).toBe(false);
    expect(logs.some((m) => m.includes('no CSS'))).toBe(true);
  });
});

describe('метрики (D-032)', () => {
  test('по умолчанию — mn-metrics.json рядом с CSS', () => {
    write('src/a.html', '<div class="p10 p10 m20">');
    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', 'app.css',
      ),
    }, report);

    const metrics = JSON.parse(readFileSync(join(
      dir, 'out', 'mn-metrics.json',
    ), 'utf8'));
    expect(metrics.tokens).toEqual([{
      name: 'p10',
      count: 2,
    }, {
      name: 'm20',
      count: 1,
    }]);
    expect(metrics.files).toEqual({
      'a.html': metrics.tokens, 
    });
    expect(logs.some((m) => m.includes('Metrics'))).toBe(true);
  });

  test('свой путь — от рабочей директории; false — не писать', () => {
    write('src/a.html', '<div class="p10">');
    const custom = join(
      dir, 'отчёт', 'metrics.json',
    );
    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'out', 'app.css',
      ),
      metrics: custom,
    }, report);
    expect(JSON.parse(readFileSync(custom, 'utf8')).occurrences).toBe(1);

    build({
      input: join(dir, 'src'),
      output: join(
        dir, 'none', 'app.css',
      ),
      metrics: false,
    }, report);
    expect(existsSync(join(
      dir, 'none', 'mn-metrics.json',
    ))).toBe(false);
  });

  test('-m задаёт путь, --no-metrics выключает, иначе решает конфиг', () => {
    expect(mergeSettings(parseArgs(['-m', './m.json']), {}).metrics).toBe('./m.json');
    expect(mergeSettings(parseArgs(['--metrics', './m.json']), {}).metrics).toBe('./m.json');
    expect(mergeSettings(parseArgs(['--no-metrics']), {
      metrics: './c.json', 
    }).metrics).toBe(false);
    expect(mergeSettings(parseArgs([]), {
      metrics: './c.json', 
    }).metrics).toBe('./c.json');
    expect(mergeSettings(parseArgs([]), {}).metrics).toBeUndefined();
  });
});

describe('startWatch', () => {
  test(
    'пересобирает при изменении файла', async () => {
      write('a.html', '<div class="p10">');
      const out = join(dir, 'out.css');
      const stop = startWatch({
        input: dir,
        output: out,
      }, report);
      try {
        // Пересборка отложена на 50 мс, чтобы одно сохранение не запускало её
        // трижды.
        await untilRetrying(
          () => write('b.html', '<div class="m20">'),
          () => existsSync(out) && readFileSync(out, 'utf8').includes('margin:20px'),
          'пересборка после изменения файла',
        );
        expect(readFileSync(out, 'utf8')).toContain('margin:20px');
      } finally {
        stop();
      }
    }, WATCH_TIMEOUT,
  );

  test(
    'ошибка пересборки не роняет наблюдение', async () => {
      const file = write('a.html', '<div class="p10">');
      // Запись внутрь файла — гарантированная ошибка (ENOTDIR): наблюдение
      // должно её напечатать и продолжить, а не оборвать процесс.
      const stop = startWatch({
        input: dir,
        output: join(file, 'out.css'),
      }, report);
      try {
        await untilRetrying(
          () => write('b.html', '<div class="m20">'),
          () => errors.length > 0,
          'сообщение об ошибке пересборки',
        );
        expect(errors.length).toBeGreaterThan(0);
      } finally {
        stop();
      }
    }, WATCH_TIMEOUT,
  );
});

describe('изоляция: --isolate-out, --isolate-copy (D-079, D-081)', () => {
  function project(): string {
    write('app/App.html', '<div class="p10"></div>');
    write('ui/package.json', JSON.stringify({
      name: '@acme/ui',
      minotation: {
        requires: ['presetTw4'],
        notationMode: 'tw4-compatible',
      },
    }));
    write('ui/Button.tsx', 'export const B = () => <b className="p-4" />;\n');
    write('ui/readme.md', '# ui');
    return join(dir, 'isolated');
  }

  function isolate(extra: Partial<RunSettings>): CompileResult {
    return build({
      input: dir,
      output: join(
        dir, 'dist', 'app.css',
      ),
      attrs: 'class, className:class',
      scopePresets: [presetTw4 as MnPreset],
      isolateMode: 'class',
      isolateOut: join(dir, 'isolated'),
      ...extra,
    }, report);
  }

  test('файлы пакета — с классом области, остальное копируется, оригиналы не тронуты', () => {
    const out = project();
    const cls = scopeClassName('presetTw4');
    isolate({});
    expect(readFileSync(join(
      out, 'ui', 'Button.tsx',
    ), 'utf8')).toContain('className="' + cls + ' p-4"');
    expect(readFileSync(join(
      out, 'app', 'App.html',
    ), 'utf8')).toBe('<div class="p10"></div>');
    expect(readFileSync(join(
      out, 'ui', 'readme.md',
    ), 'utf8')).toBe('# ui');
    expect(readFileSync(join(
      dir, 'ui', 'Button.tsx',
    ), 'utf8')).toContain('className="p-4"');
    expect(readFileSync(join(
      dir, 'dist', 'app.css',
    ), 'utf8')).toContain('.p-4.' + cls + '{');
    expect(logs.some((m) => m.includes('Isolated sources: 1 rewritten'))).toBe(true);
  });

  test('--no-isolate-copy — только изменённые; шаблон — по шаблону', () => {
    const out = project();
    isolate({
      isolateCopy: false,
    });
    expect(existsSync(join(
      out, 'ui', 'Button.tsx',
    ))).toBe(true);
    expect(existsSync(join(
      out, 'app', 'App.html',
    ))).toBe(false);
    rmSync(out, {
      recursive: true,
    });
    isolate({
      isolateCopy: ['**/*.html', /readme/],
    });
    expect(existsSync(join(
      out, 'app', 'App.html',
    ))).toBe(true);
    expect(existsSync(join(
      out, 'ui', 'readme.md',
    ))).toBe(true);
    expect(existsSync(join(
      out, 'ui', 'package.json',
    ))).toBe(false);
  });

  test('isolateCopy — путь; вход — один файл; неверное значение и isolateOut без isolateMode — ошибки', () => {
    const out = project();
    isolate({
      isolateCopy: 'ui/readme.md',
    });
    expect(existsSync(join(
      out, 'ui', 'readme.md',
    ))).toBe(true);
    expect(existsSync(join(
      out, 'app', 'App.html',
    ))).toBe(false);
    const single = join(dir, 'single');
    build({
      input: join(
        dir, 'ui', 'Button.tsx',
      ),
      output: join(
        dir, 'dist', 's.css',
      ),
      attrs: 'class, className:class',
      scopePresets: [presetTw4 as MnPreset],
      isolateMode: 'class',
      isolateOut: single,
      isolateCopy: false,
    }, report);
    expect(readFileSync(join(single, 'Button.tsx'), 'utf8')).toContain(scopeClassName('presetTw4') + ' p-4');
    expect(() => isolate({
      isolateCopy: 5 as never,
    })).toThrow('option "isolateCopy" expects true, false, a path or glob, a RegExp, a function or an array of them');
    expect(() => build({
      input: dir,
      output: join(
        dir, 'dist', 'x.css',
      ),
      isolateOut: single,
    }, report)).toThrow('"isolateOut" needs "isolateMode"');
  });

  test('повторный запуск не копирует каталог вывода внутрь себя', () => {
    const out = project();
    isolate({});
    isolate({});
    expect(existsSync(join(out, 'isolated'))).toBe(false);
  });

  test('класс из JS — предупреждение; isolateOut без isolateMode — ошибка', () => {
    project();
    write('ui/Toggle.ts', 'el.classList.add(\'p-4\');\nexport const t = <b className="p-4" />;\n');
    isolate({});
    expect(errors.some((m) => m.includes('ui/Toggle.ts:1: class set from JS'))).toBe(true);
    expect(() => isolate({
      isolateMode: 'none',
    })).toThrow('"isolateOut" needs "isolateMode"');
  });

  test('флаги CLI', () => {
    const settings = mergeSettings(parseArgs([
      '--isolate-mode',
      'where',
      '--isolate-out',
      './x',
      '--isolate-copy',
      '**/*.html',
      '--unreachable-class-mode',
      'strict',
    ]), {});
    expect(settings).toMatchObject({
      isolateMode: 'where',
      isolateOut: './x',
      isolateCopy: '**/*.html',
      unreachableClassMode: 'strict',
    });
    expect(mergeSettings(parseArgs(['--no-isolate-copy']), {
      isolateCopy: true,
    }).isolateCopy).toBe(false);
    expect(() => parseArgs(['--isolate-mode', 'x'])).toThrow('Option "--isolate-mode" expects none, class or where, got "x"');
    expect(() => parseArgs(['--unreachable-class-mode', 'x'])).toThrow('Option "--unreachable-class-mode" expects warn, silent or strict');
  });
});
