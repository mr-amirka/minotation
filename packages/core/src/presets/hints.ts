/**
 * @overview Пресет подсказок о классах, которые minotation не понимает (D-024, D-042)
 *
 * Имя без хендлера ядро считает чужим классом и молча пропускает: `t0` вместо
 * `st0` не даёт CSS, и опечатку замечают только в браузере. Пресет регистрирует
 * хендлеры-ловушки под свободными именами — частые опечатки и классы
 * Tailwind/Bootstrap — и вместо CSS даёт предупреждение (`'hint'`) с эквивалентом
 * в нотации.
 *
 * Пресет, подключённый ниже и зарегистрировавший хендлер с тем же именем, просто
 * перезаписывает ловушку — подсказка замолкает. Точечно подсказки отключаются
 * фабрикой: `presetHints({ excludeGroups: ['bootstrap'], excludeHandlers: ['flex'] })`.
 */
import type {
  MnInstance,
} from '../types';
import {
  MnParseError,
} from '../core/types';
import type {
  MnEssenceParams,
} from '../core/types';
import {
  checkKnownValues, checkOptions, isStringArray,
} from '../checkOptions';

/** Имя пресета — в начале каждой подсказки: по нему видно, что отключать. */
const PRESET_NAME = 'presetHints';

/** Группа подсказок: откуда класс. */
type HintGroup = 'typos' | 'tailwind' | 'bootstrap';

/** Все группы — для проверки `excludeGroups`. */
const GROUPS: HintGroup[] = [
  'typos',
  'tailwind',
  'bootstrap',
];

const TW: HintGroup[] = ['tailwind'];
const BS: HintGroup[] = ['bootstrap'];
const TW_BS: HintGroup[] = ['bootstrap', 'tailwind'];

/**
 * Эквиваленты: имя → (суффикс токена → [токен minotation, группы]). Пустой суффикс —
 * класс целиком (`flex`), `-…` — kebab-класс (`text-center`). Каждый эквивалент
 * проверяется тестом: он обязан компилироваться в CSS. `fixed` и `sticky` — уже токены
 * minotation (статика), их здесь нет.
 */
const EQUIVALENTS: Record<string, Record<string, [string, HintGroup[]]>> = {
  // Display.
  flex: {
    '': ['dF', TW],
    '-col': ['fxdC', TW],
    '-column': ['fxdC', BS],
    '-row': ['fxdR', TW_BS],
    '-wrap': ['fxwW', TW_BS],
  },
  inline: {
    '': ['dI', TW],
    '-block': ['dIB', TW],
    '-flex': ['dIF', TW],
  },
  hidden: {
    '': ['dN', TW],
  },
  block: {
    '': ['dB', TW],
  },
  grid: {
    '': ['dG', TW],
  },
  // Позиционирование: Tailwind — словом, Bootstrap — `position-*`.
  relative: {
    '': ['posR', TW],
  },
  absolute: {
    '': ['posA', TW],
  },
  position: {
    '-relative': ['posR', BS],
    '-absolute': ['posA', BS],
    '-fixed': ['posF', BS],
    '-static': ['posS', BS],
  },
  top: {
    '-0': ['st0', TW_BS],
  },
  left: {
    '-0': ['sl0', TW],
  },
  // Текст.
  italic: {
    '': ['fsI', TW],
  },
  underline: {
    '': ['tdU', TW],
  },
  uppercase: {
    '': ['ttU', TW],
  },
  lowercase: {
    '': ['ttL', TW],
  },
  capitalize: {
    '': ['ttC', TW],
  },
  truncate: {
    '': ['ovH tovE wsNW', TW],
  },
  text: {
    '-center': ['taC', TW_BS],
    '-left': ['taL', TW],
    '-right': ['taR', TW],
    '-justify': ['taJ', TW],
    '-uppercase': ['ttU', BS],
    '-lowercase': ['ttL', BS],
    '-capitalize': ['ttC', BS],
  },
  // Flex-выравнивание: Tailwind — `items-*`/`justify-*`, Bootstrap — `align-items-*`/`justify-content-*`.
  items: {
    '-center': ['aiC', TW],
    '-start': ['aiS', TW],
    '-end': ['aiE', TW],
    '-baseline': ['aiB', TW],
  },
  align: {
    '-items-center': ['aiC', BS],
    '-items-start': ['aiS', BS],
    '-items-end': ['aiE', BS],
    '-items-baseline': ['aiB', BS],
  },
  justify: {
    '-center': ['jcC', TW],
    '-between': ['jcSB', TW],
    '-around': ['jcSA', TW],
    '-start': ['jcS', TW],
    '-end': ['jcE', TW],
    '-content-center': ['jcC', BS],
    '-content-between': ['jcSB', BS],
    '-content-around': ['jcSA', BS],
    '-content-start': ['jcS', BS],
    '-content-end': ['jcE', BS],
  },
  grow: {
    '': ['fxg1', TW],
  },
  shrink: {
    '-0': ['fxs0', TW],
  },
  invisible: {
    '': ['vH', TW_BS],
  },
  visible: {
    '': ['vV', TW_BS],
  },
  rounded: {
    '': ['r4', TW_BS],
  },
};

/**
 * Опечатки: свободная буква вместо занятого тега. `t`/`l` — `top`/`left`
 * пишутся `st`/`sl` (`r`, `b` заняты радиусом и рамкой — там опечатка даёт CSS).
 */
const TYPOS: Record<string, string> = {
  t: 'st',
  l: 'sl',
};

/** Все обработчики — для проверки `excludeHandlers`. */
const HANDLERS = Object.keys(EQUIVALENTS).concat(Object.keys(TYPOS));

/** Опции фабрики {@link presetHints} (D-042). */
export interface PresetHintsOptions {
  /** Группы, о которых не подсказывать: `typos`, `tailwind`, `bootstrap`. */
  excludeGroups?: HintGroup[];
  /** Обработчики, которые не регистрировать: `flex`, `text`, `t`, … */
  excludeHandlers?: string[];
}

/** Предупреждение вместо CSS: токен не даёт правила, остальная компиляция идёт дальше. */
function hint(groups: HintGroup[], message: string): never {
  throw new MnParseError(PRESET_NAME + '[' + groups.join(', ') + ']: ' + message, {
    token: '',
    handler: '',
    arg: '',
    warningType: 'hint',
  });
}

/** Подсказка из исключённой группы: токен не даёт CSS, предупреждения нет. */
function quiet(): never {
  throw new MnParseError('', {
    token: '',
    handler: '',
    arg: '',
    silent: true,
  });
}

/** Исключена ли хоть одна группа подсказки — значит, эта система в проекте подключена. */
function isExcluded(groups: HintGroup[], excluded: Record<string, 1>): boolean {
  for (const group of groups) {
    if (excluded[group]) {
      return true;
    }
  }
  return false;
}

/** Хендлер-ловушка для класса другой системы. */
function equivalentHandler(name: string, excluded: Record<string, 1>): (p: MnEssenceParams) => void {
  const map = EQUIVALENTS[name];
  // Класс без известного эквивалента (`text-muted`) — группы всего обработчика.
  const all: HintGroup[] = [];
  let suffix: string;
  for (suffix in map) { // eslint-disable-line
    for (const group of map[suffix][1]) {
      all.indexOf(group) < 0 && all.push(group);
    }
  }
  all.sort();
  return (p) => {
    const token = name + p.suffix;
    const entry = map[p.suffix];
    const groups = entry ? entry[1] : all;
    isExcluded(groups, excluded) && quiet();
    entry
      ? hint(groups, '"' + token + '" gives no CSS — in minotation it is "' + entry[0] + '"')
      : hint(groups, '"' + token + '" gives no CSS — it looks like a class of another CSS framework,'
        + ' and minotation has no such token');
  };
}

/** Хендлер-ловушка для опечатки в теге. */
function typoHandler(name: string): (p: MnEssenceParams) => void {
  const tag = TYPOS[name];
  return (p) => hint(['typos'], '"' + name + p.suffix + '" gives no CSS — did you mean "' + tag + p.suffix + '"?');
}

/** Регистрирует ловушку: `skip` — без разбора значения, `hint` — получает и kebab-суффикс. */
function register(
  mn: MnInstance, name: string, handler: (p: MnEssenceParams) => void,
): void {
  (handler as { hint?: number }).hint = 1;
  // Пустой паттерн — хендлер регистрируется как есть, без обёртки: флаг `hint` сохраняется.
  mn(
    name, handler as never, '', 1,
  );
}

/** Регистрирует ловушки с учётом исключений. */
function apply(mn: MnInstance, options: PresetHintsOptions): void {
  const excluded: Record<string, 1> = {};
  const skip: Record<string, 1> = {};
  let name: string;
  for (name of options.excludeGroups || []) {
    excluded[name] = 1;
  }
  for (name of options.excludeHandlers || []) {
    skip[name] = 1;
  }
  for (name in EQUIVALENTS) { // eslint-disable-line
    skip[name] || register(
      mn, name, equivalentHandler(name, excluded),
    );
  }
  if (excluded.typos) {
    return;
  }
  for (name in TYPOS) { // eslint-disable-line
    skip[name] || register(
      mn, name, typoHandler(name),
    );
  }
}

/**
 * Пресет подсказок — и пресет, и фабрика (D-042). Подключать ПЕРВЫМ: любой пресет ниже,
 * зарегистрировавший хендлер с тем же именем, перекрывает ловушку.
 *
 * @example
 * mn.setPresets([presetHints, presetStandard]);
 * // class="t0 flex" →
 * //   presetHints[typos]: "t0" gives no CSS — did you mean "st0"?
 * //   presetHints[tailwind]: "flex" gives no CSS — in minotation it is "dF"
 *
 * mn.setPresets([presetHints({ excludeGroups: ['bootstrap'], excludeHandlers: ['flex'] }), presetStandard]);
 */
function presetHints(mn: MnInstance): void;
function presetHints(options: PresetHintsOptions): (mn: MnInstance) => void;
function presetHints(arg: MnInstance | PresetHintsOptions): void | ((mn: MnInstance) => void) {
  // Инстанс `mn` — функция, опции — объект: так пресет различает два способа вызова.
  if (typeof arg === 'function') {
    apply(arg, {});
    return;
  }
  checkOptions(
    arg, {
      excludeGroups: isStringArray,
      excludeHandlers: isStringArray,
    }, PRESET_NAME,
  );
  checkKnownValues(
    arg.excludeGroups || [], GROUPS, PRESET_NAME, 'excludeGroups', 'groups',
  );
  checkKnownValues(
    arg.excludeHandlers || [], HANDLERS, PRESET_NAME, 'excludeHandlers', 'handlers',
  );
  return (mn: MnInstance) => apply(mn, arg);
}

export default presetHints;

/** Для тестов: таблицы подсказок. */
export const HINTS = {
  equivalents: EQUIVALENTS,
  typos: TYPOS,
  groups: GROUPS,
  handlers: HANDLERS,
};
