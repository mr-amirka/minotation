/**
 * Опции сканера (D-146, D-147): `attrs`, `varNames`, `fnNames` — списки записей `имя` или `имя:цель`, каждый строкой
 * (`'class, className:class'`), массивом (`['class', 'className:class']`) или объектом (`{ className: 'class' }`).
 *
 * - имя — точное (`mne`) или шаблон `*Окончание` (`*Class` — любое имя, которое кончается на `Class`; D-131);
 * - цель — во что компилируются найденные токены: `class` → `.ws`, любая другая → `[цель~="ws"]` (D-025).
 *
 * Запись читает `pairsProvider` из fundamentool (D-096); домен — пресеты {@link SCAN_PRESETS}. Записи разбираются
 * один раз, при создании сканера, в план: группы по цели, в каждой — имена без целей для трёх механизмов. Горячий
 * путь получает готовые списки и ничего не разбирает.
 *
 * @module scanPlan
 */
import {
  pairsProvider,
} from 'fundamentool';
import type {
  TPair,
  TPairsPreset,
  TPairsValue,
} from 'fundamentool';
import type {
  ScanTokensOptions,
} from './extractTokens';

const COLON = ':';
const ASTERISK = '*';

/** Цель классов: токены компилируются в `.ws`. */
export const CLASS_TARGET = 'class';

/** Умолчания опций сканера (D-146). Вызов результата `mnClass` (`thClass('w150')`) — запись `'*Class:class'`. */
export const SCAN_DEFAULTS = {
  attrs: ['class'],
  varNames: ['*Class:class'],
  fnNames: [
    'mne:class',
    '*Class:class',
  ],
} as const;

/** Опции сканера, которые задаются записями. */
export type ScanListOption = keyof typeof SCAN_DEFAULTS;

/** Между записями строки — пробелы, `,`, `|`, `;`; между именем и целью — `:`. */
const SEPARATOR = /[\s,|;]+/;

/**
 * Пресеты записей (D-096): `attrs` — имя без цели само себе цель (`'m'` = `'m:m'`), у шаблона цели своей нет;
 * `varNames` / `fnNames` — цель пишется всегда: у переменной нет атрибута её имени.
 */
export const SCAN_PRESETS: Record<ScanListOption, TPairsPreset> = {
  attrs: {
    separator: SEPARATOR,
    pair: COLON,
    alone: (name) => (name[0] === ASTERISK ? undefined : name),
  },
  varNames: {
    separator: SEPARATOR,
    pair: COLON,
  },
  fnNames: {
    separator: SEPARATOR,
    pair: COLON,
  },
};

/** Опции сканера, которые задаются записями, — в порядке механизмов. */
const LIST_OPTIONS: ScanListOption[] = [
  'attrs',
  'varNames',
  'fnNames',
];
const LIST_OPTIONS_LENGTH = LIST_OPTIONS.length;

/** Читатели записей — по опции, в порядке механизмов. */
const READERS = LIST_OPTIONS.map((option) => pairsProvider(SCAN_PRESETS[option]));

/** Умолчания, прочитанные один раз: опции без списков (`scanTokens(source, {})`) не читают их на каждый файл. */
const DEFAULT_PAIRS = LIST_OPTIONS.map((option, i) => READERS[i](SCAN_DEFAULTS[option]));

/** Пары опции по её номеру; умолчание — общий массив, его не меняют. */
function entriesAt(i: number, value: TPairsValue | undefined): TPair[] {
  return value === undefined ? DEFAULT_PAIRS[i] : READERS[i](value);
}

/** Примеры механизмов для предупреждения об умолчании: что перестаёт сканироваться. */
const LIST_EXAMPLES: Record<ScanListOption, string> = {
  attrs: 'attributes like class="p10"',
  varNames: 'variables like const rowClass = \'p10\'',
  fnNames: 'calls like mne(\'p10\') and thClass(\'w150\')',
};

/**
 * Группа одной цели: имена без целей для трёх механизмов. Кортеж (§2): группа читается на каждый файл.
 */
export type ScanGroup = [
  target: string,
  attrs: string[],
  varNames: string[],
  fnNames: string[],
];

export const MN_GROUP_TARGET = 0;
export const MN_GROUP_ATTR = 1;
export const MN_GROUP_VARS = 2;
export const MN_GROUP_FNS = 3;

/**
 * План сканирования: группы по цели, цель маркеров `@mn` (D-083) и вырезать ли комментарии.
 *
 * Маркеры объявляют классы, поэтому идут в группу `class`, а если её нет — в первую.
 */
export type ScanPlan = [
  groups: ScanGroup[],
  markerTarget: string,
  comments: boolean,
];

export const MN_PLAN_GROUPS = 0;
export const MN_PLAN_MARKER_TARGET = 1;
export const MN_PLAN_COMMENTS = 2;

/** Токены файла по цели: `{ class: ['p10'], m: ['w1'] }`. Повторы возможны — сборка кладёт их в `Set`. */
export type ScannedTokens = Record<string, string[]>;

/**
 * Читает записи одной опции в пары «имя, цель». Неверная запись (шаблон без цели, пустая цель) пропускается: о ней
 * говорит схема опций, в разработке.
 *
 * @param option — опция
 * @param value — её значение, в любой из трёх форм; `undefined` — умолчание
 * @returns пары `[имя, цель]`
 *
 * @example
 * readScanEntries('attrs', 'class, className:class, m')   // → [['class', 'class'], ['className', 'class'], ['m', 'm']]
 * readScanEntries('varNames', { '*Class': 'class' })       // → [['*Class', 'class']]
 */
export function readScanEntries(option: ScanListOption, value: TPairsValue | undefined): TPair[] {
  return entriesAt(LIST_OPTIONS.indexOf(option), value).slice();
}

/** Записи одной опции в каноничной форме `имя:цель` — для сравнения с умолчанием. */
function canonicalEntries(pairs: TPair[]): string[] {
  return pairs.map((pair) => pair[0] + COLON + pair[1]);
}

/** Планы по объекту опций: `scanTokens` зовётся на каждый файл с одним и тем же объектом. */
const $$plans = new WeakMap<ScanTokensOptions, ScanPlan>();

/**
 * {@link scanPlanOf} с кешем по объекту опций: план строится на первом файле, дальше берётся готовый. Объект опций
 * после первого вызова не меняют — как и любые опции сборки.
 *
 * @param options — опции сканера
 * @returns план {@link ScanPlan}
 */
export function cachedScanPlanOf(options: ScanTokensOptions): ScanPlan {
  let plan = $$plans.get(options);
  plan || $$plans.set(options, plan = scanPlanOf(options));
  return plan;
}

/**
 * Строит план сканирования из опций: умолчания на месте пропущенных опций, группы по цели.
 *
 * @param options — опции сканера
 * @returns план {@link ScanPlan}
 *
 * @example
 * scanPlanOf({ attrs: 'class, m' })
 * // → [[['class', ['class'], ['*Class'], ['mne', '*Class']], ['m', ['m'], [], []]], 'class', true]
 */
export function scanPlanOf(options: ScanTokensOptions): ScanPlan {
  const byTarget: Record<string, ScanGroup> = {};
  const groups: ScanGroup[] = [];
  let i = 0;
  let group: ScanGroup;
  for (; i < LIST_OPTIONS_LENGTH; i++) {
    for (const [
      name,
      target,
    ] of entriesAt(i, options[LIST_OPTIONS[i]])) {
      group = byTarget[target];
      if (!group) {
        group = byTarget[target] = [
          target,
          [],
          [],
          [],
        ];
        groups.push(group);
      }
      (group[i + 1] as string[]).push(name);
    }
  }
  return [
    groups,
    byTarget[CLASS_TARGET] || !groups.length ? CLASS_TARGET : groups[0][MN_GROUP_TARGET],
    options.comments !== false,
  ];
}

/**
 * Предупреждения о заменённых умолчаниях (D-146): опция, заданная явно, теряет записи умолчания.
 *
 * Пустая опция (`''`, `[]`, `{}`) — механизм выключен намеренно, предупреждения нет; `replaceDefaults: true` снимает
 * их все.
 *
 * @param options — опции сканера
 * @returns сообщения, по одному на опцию
 *
 * @example
 * scanDefaultWarnings({ fnNames: 'cx:class' })
 * // → ['[minotation] fnNames replaces its default and no longer scans "mne:class", "*Class:class" (calls like
 * //     mne(\'p10\') and thClass(\'w150\')). Add them to the list, or set replaceDefaults: true']
 */
export function scanDefaultWarnings(options: ScanTokensOptions): string[] {
  const out: string[] = [];
  if (options.replaceDefaults) {
    return out;
  }
  let i = 0;
  let option: ScanListOption;
  let given: TPair[];
  let own: string[];
  let dropped: string[];
  for (; i < LIST_OPTIONS_LENGTH; i++) {
    option = LIST_OPTIONS[i];
    if (options[option] === undefined) {
      continue;
    }
    given = entriesAt(i, options[option]);
    if (!given.length) {
      continue;
    }
    own = canonicalEntries(given);
    dropped = canonicalEntries(DEFAULT_PAIRS[i]).filter((entry) => own.indexOf(entry) < 0);
    dropped.length && out.push('[minotation] ' + option + ' replaces its default and no longer scans '
      + dropped.map((entry) => '"' + entry + '"').join(', ') + ' (' + LIST_EXAMPLES[option]
      + '). Add them to the list, or set replaceDefaults: true');
  }
  return out;
}
