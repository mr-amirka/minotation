/**
 * Разбор аргументов командной строки.
 *
 * Своими руками, а не `commander`: у CLI должно быть как можно меньше
 * зависимостей — его ставят одной командой ради одной задачи (скомпилировать
 * CSS без сборщика), и тянуть за собой дерево пакетов незачем. Набор опций
 * здесь маленький и стабильный, разбор умещается в сотню строк.
 *
 * @module args
 */

/**
 * Разобранные аргументы командной строки.
 *
 * Поля, у которых есть значение по умолчанию (путь, вывод, атрибут),
 * необязательны и остаются `undefined`, если опция не указана: иначе
 * «умолчание» перекрывало бы то же поле из конфига, и конфиг молча не работал
 * бы. Сами умолчания подставляет {@link mergeSettings}.
 */
export interface CliArgs {
  /** Что сканировать: путь к файлу или директории. */
  input?: string;
  /** Куда писать CSS. */
  output?: string;
  /** Следить за изменениями и пересобирать. */
  watch: boolean;
  /** Путь к файлу конфигурации. */
  config?: string;
  /** Какие атрибуты сканировать и во что разворачивать (`class, className:class`). */
  attrs?: string;
  /** Префикс для всех селекторов. */
  prefix?: string;
  /** Запасное непрозрачное объявление рядом с `rgba`. */
  altColor: boolean;
  /** Прерывать работу на первом битом токене. */
  strict: boolean;
  /** Не разбирать JS/TS парсером — только текстовый поиск. */
  noSyntax: boolean;
  /** Пропускать файлы-партиалы `_*` (D-027). */
  skipPartials: boolean;
  /** Не писать `mn-manifest.json` рядом с CSS. */
  noManifest: boolean;
  /** Куда писать статистику употребления токенов. */
  metrics?: string;
  /** Какие файлы сканировать — регулярное выражение по имени. */
  include?: string;
  /** Какие пропускать — регулярное выражение по пути. */
  exclude?: string;
  /** Показать справку и выйти. */
  help: boolean;
  /** Показать версию и выйти. */
  version: boolean;
  /**
   * Опции присваиваются по имени, вычисленному из таблиц {@link FLAGS} и
   * {@link OPTIONS}, — отсюда индексная сигнатура. Без неё каждое присваивание
   * требовало бы приведения к `Record<string, unknown>`, то есть отключало бы
   * проверку заодно и у известных полей.
   */
  [key: string]: string | boolean | undefined;
}

/** Значения по умолчанию. */
const DEFAULTS: CliArgs = {
  watch: false,
  altColor: false,
  strict: false,
  noSyntax: false,
  skipPartials: false,
  noManifest: false,
  help: false,
  version: false,
};

/** Опции без значения. */
const FLAGS: Record<string, keyof CliArgs> = {
  '-w': 'watch',
  '--watch': 'watch',
  '--alt-color': 'altColor',
  '--strict': 'strict',
  '--no-syntax': 'noSyntax',
  '--skip-partials': 'skipPartials',
  '--no-manifest': 'noManifest',
  '-h': 'help',
  '--help': 'help',
  '-v': 'version',
  '--version': 'version',
};

/** Опции со значением следующим аргументом. */
const OPTIONS: Record<string, keyof CliArgs> = {
  '-o': 'output',
  '--output': 'output',
  '-c': 'config',
  '--config': 'config',
  '-a': 'attrs',
  '--attrs': 'attrs',
  '-p': 'prefix',
  '--prefix': 'prefix',
  '-m': 'metrics',
  '--metrics': 'metrics',
  '--include': 'include',
  '--exclude': 'exclude',
};

/**
 * Разбирает `process.argv.slice(2)`.
 *
 * Путь ко входу можно передать и позиционно (`mn ./src`), и опцией
 * (`mn --compile ./src`) — вторая форма перенесена из v1, где она была
 * единственной.
 *
 * @throws {Error} если у опции нет значения или она неизвестна
 */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    ...DEFAULTS,
  };
  const l = argv.length;
  let i = 0;
  let arg: string;
  let flag: keyof CliArgs | undefined;
  let option: keyof CliArgs | undefined;
  let positional = 0;
  for (; i < l; i++) {
    arg = argv[i];
    if ((flag = FLAGS[arg])) {
      args[flag] = true;
      continue;
    }
    // `--compile` из v1 — синоним позиционного пути.
    if (arg === '-C' || arg === '--compile') {
      option = 'input';
    } else {
      option = OPTIONS[arg];
    }
    if (option) {
      i + 1 < l || raise('Option "' + arg + '" requires a value');
      args[option] = argv[++i];
      continue;
    }
    arg[0] === '-' && raise('Unknown option: "' + arg + '"');
    positional++ && raise('Path given twice: "' + args.input + '" and "' + arg + '"');
    args.input = arg;
  }
  return args;
}

function raise(message: string): never {
  throw new Error(message);
}

/** Текст справки — он же документация по опциям. */
export const HELP = `
Usage: mn [path] [options]

  Builds CSS from Minimalist Notation tokens found in files.
  The default path is the current directory.

Options:
  -o, --output <file>    where to write CSS (default ./mn.css);
                         [name] = entry name, [hash] = content hash
  -w, --watch            watch for changes and rebuild
  -c, --config <file>    config file (default ./mn.config.js)
  -a, --attrs <list>     attributes to scan and their target, as in v1:
                         "class, className:class" (default class)
  -p, --prefix <string>  prefix for all selectors
      --alt-color        opaque fallback declaration next to rgba
      --strict           stop at the first broken token
      --no-syntax        do not parse JS/TS, text search only
      --skip-partials    skip partial files whose name starts with _
      --no-manifest      do not write mn-manifest.json next to the CSS
  -m, --metrics <file>   write token usage statistics (JSON)
      --include <regexp> which files to scan
      --exclude <regexp> which files to skip
  -v, --version          version
  -h, --help             this help

Examples:
  mn ./src -o ./dist/app.css
  mn ./src --watch
  mn ./templates --attrs "class, className:class" --prefix .app
`.trim();
