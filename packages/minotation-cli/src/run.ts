/**
 * Сборка настроек, запуск компиляции, режим наблюдения.
 *
 * Отделено от `cli.ts`, чтобы всё это можно было прогнать тестом, не запуская
 * процесс и не перехватывая `process.exit`.
 *
 * @module run
 */
import {
  createTimeout,
} from 'fundamentool';
import {
  copyFileSync,
  mkdirSync,
  realpathSync,
  statSync,
  watch,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import {
  checkOptions,
} from 'minotation';
import {
  BUILD_OPTIONS_SCHEMA,
  CONFIG_FILE_NAMES,
  createMatcher,
  formatFileName,
  globToRegExp,
  loadConfigFile,
  manifestFileName,
  manifestOf,
  metricsFileName,
  walkFiles,
} from 'minotation-build';
import type {
  CliArgs,
} from './args';
import {
  CONFIG_SCHEMA,
  compile,
} from './compile';
import type {
  CompileSettings,
  CompileResult,
} from './compile';

const ENCODING = 'utf8';

/** Куда писать сообщения — подменяется в тестах. */
export interface Reporter {
  log: (message: string) => void;
  error: (message: string) => void;
}

/** Конфиг по умолчанию ищется под этим именем. */
export const DEFAULT_CONFIG = './minotation.config.js';

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
 * Читает файл настроек `minotation.config.*` — общий для всех плагинов и CLI (D-081).
 *
 * Отсутствие файла — не ошибка: CLI полезен и без конфига, все настройки задаются опциями. А вот
 * существующий, но битый файл — ошибка, даже когда его имя взято по умолчанию: молча продолжить с
 * умолчаниями значит собрать не то, что просили. Файл общий: опции других инструментов в нём
 * допустимы (`fileName`, `inject`), CLI берёт только свои.
 */
export function loadConfig(path: string | undefined, report: Reporter): Partial<RunSettings> {
  const loaded = loadConfigFile(
    BUILD_OPTIONS_SCHEMA, process.cwd(), path && resolve(path),
  );
  if (!loaded) {
    return {};
  }
  report.log('Config: ' + loaded.path);
  const config: Record<string, unknown> = {};
  for (const key in loaded.options) { // eslint-disable-line
    CONFIG_SCHEMA[key] && (config[key] = loaded.options[key]);
  }
  // Свои поля CLI в общей схеме не проверяются по значению — проверяем здесь (D-038).
  checkOptions(
    config, CONFIG_SCHEMA, relative(process.cwd(), loaded.path),
  );
  return config as Partial<RunSettings>;
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
    altColor: args.altColor || config.altColor,
    warningMode: args.warningMode || config.warningMode,
    specificityMode: args.specificityMode || config.specificityMode,
    importantMode: args.importantMode || config.importantMode,
    childSelectorMode: args.childSelectorMode || config.childSelectorMode,
    unknownMediaMode: args.unknownMediaMode || config.unknownMediaMode,
    suspectClassMode: args.suspectClassMode || config.suspectClassMode,
    handlerConflictMode: args.handlerConflictMode || config.handlerConflictMode,
    presetConflictMode: args.presetConflictMode || config.presetConflictMode,
    groupSuspectMode: args.groupSuspectMode || config.groupSuspectMode,
    groupMode: args.groupMode || config.groupMode,
    notationMode: args.notationMode || config.notationMode,
    contextWhere: args.contextWhere || config.contextWhere,
    mediaNesting: args.mediaNesting || config.mediaNesting,
    notationConflictMode: args.notationConflictMode || config.notationConflictMode,
    skipPartials: args.skipPartials || config.skipPartials,
    isolateMode: args.isolateMode || config.isolateMode,
    unreachableClassMode: args.unreachableClassMode || config.unreachableClassMode,
    isolateOut: args.isolateOut || config.isolateOut,
    // `--no-isolate-copy` — только изменённые; `--isolate-copy <glob>` — по шаблону; иначе — конфиг.
    isolateCopy: args.noIsolateCopy ? false : args.isolateCopy !== undefined ? args.isolateCopy : config.isolateCopy,
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
    // Файлы настроек — не разметка: и явный `--config`, и любой `minotation.config.*` рабочего каталога.
    ignore: (config.ignore || []).concat(args.config ? [resolve(args.config)] : [], CONFIG_FILE_NAMES.map((name) => resolve(name))),
  };
}

/**
 * Исходники с классом области — в `isolateOut` (D-079): дерево `input` повторяется, оригиналы не
 * трогаются. Изменённые файлы пишутся всегда, неизменённые — по `isolateCopy` (D-081).
 */
function writeIsolated(
  settings: RunSettings, rewritten: Record<string, string>, report: Reporter,
): void {
  const input = resolve(settings.input);
  const root = statSync(input).isDirectory() ? input : dirname(input);
  const out = resolve(settings.isolateOut as string);
  const copy = copyMatcher(settings.isolateCopy, root);
  let written = 0;
  let copied = 0;
  let target: string;
  let code: string | undefined;
  for (const file of walkFiles(root, [''])) {
    code = rewritten[file];
    // Каталог вывода внутри `input` — его не обходим, иначе следующий запуск копировал бы копию.
    if (file.startsWith(out + sep) || code === undefined && !copy(file)) {
      continue;
    }
    target = join(out, relative(root, file));
    mkdirSync(dirname(target), {
      recursive: true,
    });
    code === undefined ? copyFileSync(file, target) : writeFileSync(
      target, code, ENCODING,
    );
    code === undefined ? copied++ : written++;
  }
  report.log('Isolated sources: ' + written + ' rewritten, ' + copied + ' copied → ' + out);
}

/** `isolateCopy` → проверка файла: все, ни одного, по шаблону (glob, путь, RegExp, функция, массив). */
function copyMatcher(value: RunSettings['isolateCopy'], root: string): (path: string) => boolean {
  if (value === undefined || value === true) {
    return () => true;
  }
  if (value === false) {
    return () => false;
  }
  const tests = (Array.isArray(value) ? value : [value]).map((item) => {
    if (typeof item === 'string' && /[*?{]/.test(item)) {
      const pattern = globToRegExp(item);
      return (path: string) => pattern.test(relative(root, path).split(sep).join('/'));
    }
    return createMatcher(item, root) as (path: string) => boolean;
  });
  return (path) => tests.some((test) => test(path));
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
      full, output.css, ENCODING,
    );
    files[output.name] = full;
  }
  const l = result.warnings.length;
  let i = 0;
  for (; i < l; i++) {
    // `message` у предупреждения обязателен — запасного поля здесь не нужно.
    report.error('Warning: ' + result.warnings[i].message);
  }
  settings.isolateOut && writeIsolated(
    settings, result.rewritten, report,
  );
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
      ), ENCODING,
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
      ), ENCODING,
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
  let cancelBuild: (() => void) | undefined;
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
      cancelBuild && cancelBuild();
      cancelBuild = createTimeout(() => {
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
    cancelBuild && cancelBuild();
    watcher.close();
  };
}
