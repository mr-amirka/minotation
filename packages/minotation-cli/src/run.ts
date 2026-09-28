/**
 * Сборка настроек, запуск компиляции, режим наблюдения.
 *
 * Отделено от `cli.ts`, чтобы всё это можно было прогнать тестом, не запуская
 * процесс и не перехватывая `process.exit`.
 *
 * @module run
 */
import {
  existsSync, mkdirSync, watch, writeFileSync,
} from 'node:fs';
import {
  createRequire,
} from 'node:module';
import {
  dirname, resolve,
} from 'node:path';
import type {
  CliArgs,
} from './args';
import {
  compile,
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
  /** Файл, в который пишется CSS. */
  output: string;
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
      throw new Error('Конфиг не найден: "' + full + '"');
    }
    return {};
  }
  let loaded: { default?: Partial<RunSettings> } & Partial<RunSettings>;
  try {
    loaded = requireConfig(full);
  } catch (ex) {
    throw new Error('Не удалось прочитать конфиг "' + full + '": '
      + (ex as Error).message, {
      cause: ex,
    });
  }
  report.log('Конфиг: ' + full);
  return loaded.default || loaded;
}

/** Путь сканирования по умолчанию. */
const DEFAULT_INPUT = './';

/** Файл вывода по умолчанию. */
const DEFAULT_OUTPUT = './mn.css';

/** Атрибут с токенами по умолчанию. */
const DEFAULT_ATTR = 'class';

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
    attr: args.attr || config.attr || DEFAULT_ATTR,
    prefix: args.prefix === undefined ? config.prefix : args.prefix,
    altColor: args.altColor || config.altColor,
    strict: args.strict || config.strict,
    syntax: args.syntax || config.syntax,
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
  const full = resolve(settings.output);
  mkdirSync(dirname(full), {
    recursive: true,
  });
  writeFileSync(
    full, result.css, 'utf8',
  );
  const l = result.warnings.length;
  let i = 0;
  for (; i < l; i++) {
    // `message` у предупреждения обязателен — запасного поля здесь не нужно.
    report.error('Предупреждение: ' + result.warnings[i].message);
  }
  report.log(result.files + ' файлов, ' + result.tokens + ' токенов → ' + full);
  return result;
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
  const watcher = watch(
    settings.input, {
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
  report.log('Наблюдение за ' + resolve(settings.input));
  return () => {
    timer && clearTimeout(timer);
    watcher.close();
  };
}
