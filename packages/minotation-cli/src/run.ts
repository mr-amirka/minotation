/**
 * Сборка настроек, запуск компиляции, режим наблюдения.
 *
 * Отделено от `cli.ts`, чтобы всё это можно было прогнать тестом, не запуская
 * процесс и не перехватывая `process.exit`.
 *
 * @module run
 */
import {
  existsSync, mkdirSync, realpathSync, watch, writeFileSync,
} from 'node:fs';
import {
  createRequire,
} from 'node:module';
import {
  dirname, join, relative, resolve,
} from 'node:path';
import {
  checkOptions,
} from 'minotation';
import {
  formatFileName, manifestFileName, manifestOf, metricsFileName,
} from 'minotation-build';
import type {
  CliArgs,
} from './args';
import {
  CONFIG_SCHEMA, compile,
} from './compile';
import type {
  CompileSettings, CompileResult,
} from './compile';

/** Куда писать сообщения — подменяется в тестах. */
export interface Reporter {
  log: (message: string) => void;
  error: (message: string) => void;
}

/** Конфиг по умолчанию ищется под этим именем. */
export const DEFAULT_CONFIG = './mn.config.js';

/** Что сканировать и куда писать — всё, что нужно {@link build}. */
export interface RunSettings extends CompileSettings {
  /**
   * Файл, в который пишется CSS; шаблон с `[name]` (имя записи `entry`) и
   * `[hash]` (хеш содержимого) — `./dist/[name].[hash].css` (D-031).
   */
  output: string;
  /**
   * Манифест «логическое имя → фактическое» рядом с CSS (`mn-manifest.json`);
   * строка — свой путь, `false` — не писать. @default true
   */
  manifest?: boolean | string;
  /**
   * Статистика употребления токенов (D-032): `true` — `mn-metrics.json` рядом с
   * CSS, строка — свой путь, `false` — не писать. @default true
   */
  metrics?: boolean | string;
}

/**
 * Загрузка конфига — обычный `require`, а не динамический `import`.
 *
 * `mn` собирается в CommonJS, и `import()` в таком выводе всё равно
 * превращается компилятором в `require`: две формы записи с одним поведением.
 * `require` при этом читает и `.json`, и — начиная с Node 22.12 — модули ESM.
 * На более старых Node конфиг в проекте с `"type": "module"` нужно назвать
 * `mn.config.cjs`; сообщение об ошибке это и скажет.
 */
const requireConfig = createRequire(__filename);

/**
 * Читает файл конфигурации, если он есть.
 *
 * Отсутствие файла — не ошибка: CLI полезен и без конфига, все настройки
 * задаются опциями. А вот существующий, но битый конфиг — ошибка, даже когда
 * его имя взято по умолчанию: молча продолжить с умолчаниями значит собрать не
 * то, что просили.
 */
export function loadConfig(path: string | undefined, report: Reporter): Partial<RunSettings> {
  const full = resolve(path || DEFAULT_CONFIG);
  if (!existsSync(full)) {
    if (path) {
      throw new Error('Config not found: "' + full + '"');
    }
    return {};
  }
  let loaded: { default?: Partial<RunSettings> } & Partial<RunSettings>;
  try {
    loaded = requireConfig(full);
  } catch (ex) {
    throw new Error('Failed to read config "' + full + '": '
      + (ex as Error).message, {
      cause: ex,
    });
  }
  report.log('Config: ' + full);
  const config = loaded.default || loaded;
  // Опечатка в конфиге — ошибка с подсказкой, а не молча пропущенная настройка (D-038).
  checkOptions(
    config, CONFIG_SCHEMA, relative(process.cwd(), full),
  );
  return config;
}

/** Путь сканирования по умолчанию. */
const DEFAULT_INPUT = './';

/** Файл вывода по умолчанию. */
const DEFAULT_OUTPUT = './mn.css';

/** Атрибут с токенами по умолчанию. */
const DEFAULT_ATTRS = 'class';

/**
 * Складывает настройки из конфига и аргументов; аргументы важнее.
 *
 * Умолчания подставляются здесь, а не при разборе аргументов: иначе они
 * приходили бы как обычные значения и перекрывали конфиг.
 */
export function mergeSettings(args: CliArgs, config: Partial<RunSettings>): RunSettings {
  return {
    ...config,
    input: args.input || config.input || DEFAULT_INPUT,
    output: args.output || config.output || DEFAULT_OUTPUT,
    attrs: args.attrs || config.attrs || DEFAULT_ATTRS,
    // `--prefix` — короткая запись `selectorPrefix`; флаг важнее конфига.
    selectorPrefix: args.prefix === undefined ? config.selectorPrefix : args.prefix,
    altColor: args.altColor || config.altColor,
    warningMode: args.warningMode || config.warningMode,
    skipPartials: args.skipPartials || config.skipPartials,
    // `--no-manifest` выключает; без него решает конфиг (по умолчанию — писать).
    manifest: args.noManifest ? false : config.manifest,
    // `--no-syntax` выключает разбор; без него решает конфиг, а его умолчание
    // (`undefined`) означает «автоматически».
    syntax: args.noSyntax ? false : config.syntax,
    // `--no-metrics` выключает, `-m <файл>` задаёт путь; иначе решает конфиг
    // (по умолчанию — писать рядом с CSS).
    metrics: args.noMetrics ? false : (args.metrics || config.metrics),
    include: args.include ? new RegExp(args.include) : config.include,
    exclude: args.exclude ? new RegExp(args.exclude) : config.exclude,
    // Конфиг лежит в корне проекта и подходит под расширение `.js` — без этого
    // он сканировался бы наравне с исходниками.
    ignore: (config.ignore || []).concat(resolve(args.config || DEFAULT_CONFIG)),
  };
}

/** Компилирует и пишет результат; возвращает итог для отчёта. */
export function build(settings: RunSettings, report: Reporter): CompileResult {
  const result = compile(settings);
  const written = result.outputs.filter((output) => output.css);
  // Без `[name]` в шаблоне записи писали бы в один и тот же файл.
  written.length > 1 && settings.output.indexOf('[name]') < 0
    && written.some((output) => !(settings.entry && settings.entry[output.name].fileName))
    && failOutput(settings.output);
  const files: Record<string, string> = {};
  let own: string | undefined;
  let full: string;
  for (const output of written) {
    own = settings.entry && settings.entry[output.name].fileName;
    full = resolve(formatFileName(
      own || settings.output, output.name, output.css,
    ));
    mkdirSync(dirname(full), {
      recursive: true,
    });
    writeFileSync(
      full, output.css, 'utf8',
    );
    files[output.name] = full;
  }
  const l = result.warnings.length;
  let i = 0;
  for (; i < l; i++) {
    // `message` у предупреждения обязателен — запасного поля здесь не нужно.
    report.error('Warning: ' + result.warnings[i].message);
  }
  report.log(result.files + ' files, ' + result.tokens + ' tokens → '
    + (Object.values(files).join(', ') || 'no CSS'));
  const manifest = manifestFileName(settings.manifest);
  const names = Object.keys(files);
  if (manifest && names.length) {
    // По умолчанию — рядом с CSS первой записи; пути в манифесте — от него.
    const manifestFull = typeof settings.manifest === 'string'
      ? resolve(manifest)
      : join(dirname(files[names[0]]), manifest);
    const relativeFiles: Record<string, string> = {};
    for (const name of names) {
      relativeFiles[name] = relative(dirname(manifestFull), files[name]);
    }
    mkdirSync(dirname(manifestFull), {
      recursive: true,
    });
    writeFileSync(
      manifestFull, JSON.stringify(
        manifestOf(relativeFiles), null, '  ',
      ), 'utf8',
    );
  }
  const metrics = metricsFileName(settings.metrics);
  if (metrics) {
    // Путь задан явно — от рабочей директории; иначе — рядом с CSS.
    const metricsFull = typeof settings.metrics === 'string'
      ? resolve(metrics)
      : join(dirname(resolve(formatFileName(
        settings.output, 'mn', '',
      ))), metrics);
    mkdirSync(dirname(metricsFull), {
      recursive: true,
    });
    writeFileSync(
      metricsFull, JSON.stringify(
        result.metrics, null, '  ',
      ), 'utf8',
    );
    report.log('Metrics → ' + metricsFull);
  }
  return result;
}

/** Несколько записей пишут в один файл — шаблону нужен `[name]`. */
function failOutput(output: string): never {
  throw new Error('Several entries would be written to "' + output
    + '": add [name] to --output, e.g. ./dist/[name].css');
}

/**
 * Следит за входным путём и пересобирает при изменениях.
 *
 * Пересборка полная, а не инкрементальная: CSS собирается из ОБЪЕДИНЕНИЯ
 * токенов всех файлов, поэтому удаление токена из одного файла всё равно
 * потребовало бы пересчёта целиком. На типичном проекте полный проход занимает
 * единицы миллисекунд — усложнять нечем.
 *
 * @returns функция остановки наблюдения
 */
export function startWatch(settings: RunSettings, report: Reporter): () => void {
  let timer: NodeJS.Timeout | undefined;
  // Наблюдаем за РЕАЛЬНЫМ путём: на macOS `/var` — симлинк на `/private/var`,
  // и `fs.watch` с `recursive` по неразрешённому пути о новых файлах не
  // сообщает вовсе. Молча: watch работает, событий просто нет.
  const target = realpathSync(resolve(settings.input));
  const watcher = watch(
    target, {
      recursive: true,
    }, () => {
    // Сборщики пишут файл несколькими событиями подряд; ждём паузу, иначе
    // пересборка запускается по три раза на одно сохранение.
      timer && clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          build(settings, report);
        } catch (ex) {
          report.error((ex as Error).message);
        }
      }, 50);
    },
  );
  report.log('Watching ' + target);
  return () => {
    timer && clearTimeout(timer);
    watcher.close();
  };
}
