/**
 * @overview Пресет подсказок о классах, которые minotation не понимает (D-024)
 *
 * Имя без хендлера ядро считает чужим классом и молча пропускает: `t0` вместо
 * `st0` не даёт CSS, и опечатку замечают только в браузере. Пресет регистрирует
 * хендлеры-ловушки под свободными именами — частые опечатки и классы
 * Tailwind/Bootstrap — и вместо CSS даёт предупреждение (`'hint'`) с эквивалентом
 * в нотации.
 *
 * Отключение — не подключать пресет: флага нет, а текст каждой подсказки
 * начинается с имени пресета. Пресет, подключённый ниже и зарегистрировавший
 * хендлер с тем же именем, просто перезаписывает ловушку — подсказка замолкает.
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

/** Имя пресета — в начале каждой подсказки: по нему видно, что отключать. */
const PRESET_NAME = 'presetHints';

/**
 * Эквиваленты: имя → (суффикс токена → токен minotation). Пустой суффикс — класс
 * целиком (`flex`), `-…` — kebab-класс (`text-center`). Каждый эквивалент
 * проверяется тестом: он обязан компилироваться в CSS.
 */
const EQUIVALENTS: Record<string, Record<string, string>> = {
  // Tailwind / Bootstrap: display.
  flex: {
    '': 'dF',
    '-col': 'fxdC',
    '-row': 'fxdR',
    '-wrap': 'fxwW',
  },
  inline: {
    '': 'dI',
    '-block': 'dIB',
    '-flex': 'dIF',
  },
  hidden: {
    '': 'dN',
  },
  block: {
    '': 'dB',
  },
  grid: {
    '': 'dG',
  },
  // Позиционирование: Tailwind — словом, Bootstrap — `position-*`. `fixed` и `sticky` —
  // уже токены minotation (статика), подсказывать нечего.
  relative: {
    '': 'posR',
  },
  absolute: {
    '': 'posA',
  },
  position: {
    '-relative': 'posR',
    '-absolute': 'posA',
    '-fixed': 'posF',
    '-static': 'posS',
  },
  top: {
    '-0': 'st0',
  },
  left: {
    '-0': 'sl0',
  },
  // Текст.
  italic: {
    '': 'fsI',
  },
  underline: {
    '': 'tdU',
  },
  uppercase: {
    '': 'ttU',
  },
  lowercase: {
    '': 'ttL',
  },
  capitalize: {
    '': 'ttC',
  },
  truncate: {
    '': 'ovH tovE wsNW',
  },
  text: {
    '-center': 'taC',
    '-left': 'taL',
    '-right': 'taR',
    '-justify': 'taJ',
    '-uppercase': 'ttU',
    '-lowercase': 'ttL',
    '-capitalize': 'ttC',
  },
  // Flex-выравнивание: Tailwind — `items-*`/`justify-*`, Bootstrap — `align-items-*`/`justify-content-*`.
  items: {
    '-center': 'aiC',
    '-start': 'aiS',
    '-end': 'aiE',
    '-baseline': 'aiB',
  },
  align: {
    '-items-center': 'aiC',
    '-items-start': 'aiS',
    '-items-end': 'aiE',
    '-items-baseline': 'aiB',
  },
  justify: {
    '-center': 'jcC',
    '-between': 'jcSB',
    '-around': 'jcSA',
    '-start': 'jcS',
    '-end': 'jcE',
    '-content-center': 'jcC',
    '-content-between': 'jcSB',
    '-content-around': 'jcSA',
    '-content-start': 'jcS',
    '-content-end': 'jcE',
  },
  grow: {
    '': 'fxg1',
  },
  shrink: {
    '-0': 'fxs0',
  },
  invisible: {
    '': 'vH',
  },
  visible: {
    '': 'vV',
  },
  rounded: {
    '': 'r4',
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

/** Предупреждение вместо CSS: токен не даёт правила, остальная компиляция идёт дальше. */
function hint(message: string): never {
  throw new MnParseError(PRESET_NAME + ': ' + message, {
    token: '',
    handler: '',
    arg: '',
    warningType: 'hint',
  });
}

/** Хендлер-ловушка для класса другой системы. */
function equivalentHandler(name: string): (p: MnEssenceParams) => void {
  const map = EQUIVALENTS[name];
  return (p) => {
    const token = name + p.suffix;
    const equivalent = map[p.suffix];
    equivalent
      ? hint('"' + token + '" gives no CSS — in minotation it is "' + equivalent + '"')
      : hint('"' + token + '" gives no CSS — it looks like a class of another CSS framework,'
        + ' and minotation has no such token');
  };
}

/** Хендлер-ловушка для опечатки в теге. */
function typoHandler(name: string): (p: MnEssenceParams) => void {
  const tag = TYPOS[name];
  return (p) => hint('"' + name + p.suffix + '" gives no CSS — did you mean "' + tag + p.suffix + '"?');
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

/**
 * Пресет подсказок. Подключать ПЕРВЫМ: любой пресет ниже, зарегистрировавший
 * хендлер с тем же именем, перекрывает ловушку.
 *
 * @example
 * mn.setPresets([presetHints, presetStandard, presetSynonyms]);
 * // class="t0 flex" → предупреждения:
 * //   presetHints: "t0" gives no CSS — did you mean "st0"?
 * //   presetHints: "flex" gives no CSS — in minotation it is "dF"
 */
export default (mn: MnInstance): void => {
  let name: string;
  for (name in EQUIVALENTS) { // eslint-disable-line
    register(
      mn, name, equivalentHandler(name),
    );
  }
  for (name in TYPOS) { // eslint-disable-line
    register(
      mn, name, typoHandler(name),
    );
  }
};

/** Для тестов: таблицы подсказок. */
export const HINTS = {
  equivalents: EQUIVALENTS,
  typos: TYPOS,
};
