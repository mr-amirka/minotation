/**
 * Работа команды `mn`: аргументы → настройки → сборка → код возврата.
 *
 * Отделено от `cli.ts` ровно настолько, чтобы прогоняться тестом: здесь нет ни
 * `process.argv`, ни `process.exit`, ни `console` — всё приходит параметрами.
 *
 * @module main
 */
import {
  readFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  HELP,
  parseArgs,
} from './args';
import {
  build,
  DEFAULT_CONFIG,
  loadConfig,
  mergeSettings,
  startWatch,
} from './run';
import type {
  Reporter,
} from './run';

/**
 * Выполняет команду и возвращает код возврата.
 *
 * Исключения не ловятся, кроме разбора аргументов: на битом аргументе уместно
 * показать справку, а на всём остальном — просто сообщение, и это одинаково для
 * нечитаемого конфига, недоступного файла вывода и `--warning-mode error`. Печатает их
 * вызывающий.
 *
 * @param argv — аргументы без `node` и пути к скрипту
 * @param report — куда писать сообщения
 * @throws {Error} если конфиг не читается, в нём нет `presets` (D-110), вывод не пишется или
 *   `--warning-mode error` встретил битый токен (ядро бросает `MnStrictError`)
 */
export function main(argv: string[], report: Reporter): number {
  let args;
  try {
    args = parseArgs(argv);
  } catch (ex) {
    report.error((ex as Error).message);
    report.error('');
    report.error(HELP);
    return 1;
  }
  if (args.help) {
    report.log(HELP);
    return 0;
  }
  if (args.version) {
    report.log(version());
    return 0;
  }
  const settings = mergeSettings(args, loadConfig(args.config, report));
  // Пресеты — только из конфига (D-110): набора по умолчанию нет, флага у команды тоже.
  if (!settings.presets) {
    throw new Error(presetsRequired(args.config || DEFAULT_CONFIG));
  }
  build(settings, report);
  args.watch && startWatch(settings, report);
  // Наблюдение держит процесс само; до сюда доходит только успешная сборка —
  // с `--warning-mode error` битый токен прилетает исключением из ядра.
  return 0;
}

/**
 * Сообщение о забытом наборе пресетов: что не так и что написать в конфиге (D-110).
 *
 * @param config — файл конфига: заданный `--config` или имя по умолчанию
 */
function presetsRequired(config: string): string {
  return '"presets" is required — no preset is connected by default. List them in ' + config + ':\n'
    + '  const { presetStandard, presetSynonyms, presetMedias } = require(\'minotation\');\n'
    + '  module.exports = { presets: [presetStandard, presetSynonyms, presetMedias] };';
}

/**
 * Версия читается из `package.json`, а не хардкодится: две записи одного и того
 * же разъезжаются при первом же выпуске. Путь одинаков и в исходниках
 * (`src/main.ts`), и в сборке (`dist/main.js`).
 */
function version(): string {
  return JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')).version;
}
