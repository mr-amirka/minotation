/**
 * Опции сканера в одной форме (D-146): `attr`, `classVarName`, `classFnName` — списки записей `имя` или `имя:цель`.
 *
 * - имя — точное (`mne`) или шаблон `*Окончание` (`*Class` — любое имя, которое кончается на `Class`; D-131);
 * - цель — во что компилируются найденные токены: `class` → `.ws`, любая другая → `[цель~="ws"]` (D-025).
 *
 * Здесь записи разбираются один раз, при создании сканера, в план: группы по цели, в каждой — имена без целей для
 * трёх механизмов. Горячий путь получает готовые списки и ничего не разбирает.
 *
 * @module scanPlan
 */

const COLON = ':';
const ASTERISK = '*';

/** Цель классов: токены компилируются в `.ws`. */
export const CLASS_TARGET = 'class';

/** Умолчания опций сканера (D-146). Вызов результата `mnClass` (`thClass('w150')`) — запись `'*Class:class'`. */
export const SCAN_DEFAULTS = {
  attr: ['class'],
  classVarName: ['*Class:class'],
  classFnName: [
    'mne:class',
    '*Class:class',
  ],
} as const;

/** Опции сканера, которые задаются записями. */
export type ScanListOption = keyof typeof SCAN_DEFAULTS;

/** Опции сканера, которые задаются записями, — в порядке механизмов. */
const LIST_OPTIONS: ScanListOption[] = [
  'attr',
  'classVarName',
  'classFnName',
];
const LIST_OPTIONS_LENGTH = LIST_OPTIONS.length;

/** Примеры механизмов для предупреждения об умолчании: что перестаёт сканироваться. */
const LIST_EXAMPLES: Record<ScanListOption, string> = {
  attr: 'attributes like class="p10"',
  classVarName: 'variables like const rowClass = \'p10\'',
  classFnName: 'calls like mne(\'p10\') and thClass(\'w150\')',
};

/** Записи сканера, заданные списками. */
export interface ScanLists {
  attr?: string[];
  classVarName?: string[];
  classFnName?: string[];
  /** `true` — замена умолчания намеренная, предупреждения нет. */
  replaceDefaults?: boolean;
  comments?: boolean;
}

/**
 * Группа одной цели: имена без целей для трёх механизмов. Кортеж (§2): группа читается на каждый файл.
 */
export type ScanGroup = [
  target: string,
  attr: string[],
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
 * Разбирает записи одной опции в пары «имя, цель».
 *
 * В `attr` имя без цели — само себе цель (`'m'` = `'m:m'`); у шаблона и у записей `classVarName` / `classFnName`
 * цель пишется явно, это проверяет схема опций. Здесь, без проверки (в production), пропущенная цель — `class`.
 *
 * @param entries — записи опции
 * @param isAttr — `true` для `attr`
 * @returns пары `[имя, цель]`
 *
 * @example
 * parseScanEntries(['class', 'className:class', 'm'], true)   // → [['class', 'class'], ['className', 'class'], ['m', 'm']]
 * parseScanEntries(['*Class:class'], false)                    // → [['*Class', 'class']]
 */
export function parseScanEntries(entries: readonly string[], isAttr: boolean): [name: string, target: string][] {
  const out: [string, string][] = [];
  let at: number;
  for (const entry of entries) {
    at = entry.indexOf(COLON);
    if (at > -1) {
      out.push([
        entry.slice(0, at),
        entry.slice(at + 1),
      ]);
    } else {
      out.push([
        entry,
        isAttr && entry[0] !== ASTERISK ? entry : CLASS_TARGET,
      ]);
    }
  }
  return out;
}

/**
 * Записи одной опции в каноничной форме `имя:цель` — для сравнения с умолчанием.
 */
function canonicalEntries(entries: readonly string[], isAttr: boolean): string[] {
  return parseScanEntries(entries, isAttr).map((pair) => pair[0] + COLON + pair[1]);
}

/** Планы по объекту опций: `scanTokens` зовётся на каждый файл с одним и тем же объектом. */
const $$plans = new WeakMap<ScanLists, ScanPlan>();

/**
 * {@link scanPlanOf} с кешем по объекту опций: план строится на первом файле, дальше берётся готовый. Объект опций
 * после первого вызова не меняют — как и любые опции сборки.
 *
 * @param options — опции сканера
 * @returns план {@link ScanPlan}
 */
export function cachedScanPlanOf(options: ScanLists): ScanPlan {
  let plan = $$plans.get(options);
  plan || $$plans.set(options, plan = scanPlanOf(options));
  return plan;
}

/**
 * Строит план сканирования из опций: умолчания на месте пропущенных списков, группы по цели.
 *
 * @param options — опции сканера
 * @returns план {@link ScanPlan}
 *
 * @example
 * scanPlanOf({ attr: ['class', 'm'] })
 * // → [[['class', ['class'], ['*Class'], ['mne', '*Class']], ['m', ['m'], [], []]], 'class', true]
 */
export function scanPlanOf(options: ScanLists): ScanPlan {
  const byTarget: Record<string, ScanGroup> = {};
  const groups: ScanGroup[] = [];
  let i = 0;
  let option: ScanListOption;
  let group: ScanGroup;
  for (; i < LIST_OPTIONS_LENGTH; i++) {
    option = LIST_OPTIONS[i];
    for (const [
      name,
      target,
    ] of parseScanEntries(options[option] || SCAN_DEFAULTS[option], !i)) {
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
 * Предупреждения о заменённых умолчаниях (D-146): список, заданный явно, теряет записи умолчания.
 *
 * Пустой список — механизм выключен намеренно, предупреждения нет; `replaceDefaults: true` снимает их все.
 *
 * @param options — опции сканера
 * @returns сообщения, по одному на опцию
 *
 * @example
 * scanDefaultWarnings({ classFnName: ['cx:class'] })
 * // → ['[minotation] classFnName replaces its default and no longer scans "mne:class", "*Class:class" (calls like
 * //     mne(\'p10\') and thClass(\'w150\')). Add them to the list, or set replaceDefaults: true']
 */
export function scanDefaultWarnings(options: ScanLists): string[] {
  const out: string[] = [];
  if (options.replaceDefaults) {
    return out;
  }
  let i = 0;
  let option: ScanListOption;
  let given: readonly string[] | undefined;
  let own: string[];
  let dropped: string[];
  for (; i < LIST_OPTIONS_LENGTH; i++) {
    option = LIST_OPTIONS[i];
    given = options[option];
    if (!given || !given.length) {
      continue;
    }
    own = canonicalEntries(given, !i);
    dropped = canonicalEntries(SCAN_DEFAULTS[option], !i).filter((entry) => own.indexOf(entry) < 0);
    dropped.length && out.push('[minotation] ' + option + ' replaces its default and no longer scans '
      + dropped.map((entry) => '"' + entry + '"').join(', ') + ' (' + LIST_EXAMPLES[option]
      + '). Add them to the list, or set replaceDefaults: true');
  }
  return out;
}
