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
  /** Атрибут с токенами (`class`, `className`). */
  attr?: string;
  /** Префикс для всех селекторов. */
  prefix?: string;
  /** Запасное непрозрачное объявление рядом с `rgba`. */
  altColor: boolean;
  /** Прерывать работу на первом битом токене. */
  strict: boolean;
  /** Не разбирать JS/TS парсером — только текстовый поиск. */
  noSyntax: boolean;
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
  '-a': 'attr',
  '--attr': 'attr',
  '-p': 'prefix',
  '--prefix': 'prefix',
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
      i + 1 < l || raise('У опции "' + arg + '" не указано значение');
      args[option] = argv[++i];
      continue;
    }
    arg[0] === '-' && raise('Неизвестная опция: "' + arg + '"');
    positional++ && raise('Путь указан дважды: "' + args.input + '" и "' + arg + '"');
    args.input = arg;
  }
  return args;
}

function raise(message: string): never {
  throw new Error(message);
}

/** Текст справки — он же документация по опциям. */
export const HELP = `
Использование: mn [путь] [опции]

  Собирает CSS из токенов Minimalist Notation, найденных в файлах.
  Путь по умолчанию — текущая директория.

Опции:
  -o, --output <файл>    куда писать CSS (по умолчанию ./mn.css)
  -w, --watch            следить за изменениями и пересобирать
  -c, --config <файл>    файл конфигурации (по умолчанию ./mn.config.js)
  -a, --attr <имя>       атрибут с токенами (по умолчанию class)
  -p, --prefix <строка>  префикс для всех селекторов
      --alt-color        запасное непрозрачное объявление рядом с rgba
      --strict           прервать работу на первом битом токене
      --no-syntax        не разбирать JS/TS парсером, только текстовый поиск
      --include <regexp> какие файлы сканировать
      --exclude <regexp> какие пропускать
  -v, --version          версия
  -h, --help             эта справка

Примеры:
  mn ./src -o ./dist/app.css
  mn ./src --watch
  mn ./templates --attr className --prefix .app
`.trim();
