/**
 * Пресет-объекты и порядок подключения по зависимостям (D-045, SPEC 14 §1–§2).
 *
 * Холодный путь: вызывается из `mn.setPresets` один раз на список.
 */
import {
  describeValue,
} from 'fundamentool';
import {
  array,
  custom,
  func,
  lazy,
  object,
  oneOf,
  string,
} from 'fundamentool/schema';
import {
  MN_WHERE,
  NOTATION_MODES,
} from '../options';
import type {
  MnPreset,
  MnPresetObject,
} from './types';

const DOUBLE_QUOTE = '"';

/** Поля пресет-объекта ({@link MnPresetObject}): обязательны `name` и `setup`. */
const PRESET_OBJECT = /*#__PURE__*/ lazy(() => object({
  name: custom<string>((value) => typeof value === 'string' && value !== '', 'a name (a non-empty string)'),
  requires: array(string()).optional(),
  ecosystems: array(string()).optional(),
  notationMode: oneOf(NOTATION_MODES).optional(),
  setup: func().describe('a function setup(mn)'),
}));

/** Проверяет пресет-объект в разработке (D-141): сообщение называет пресет по имени, если оно есть. */
function checkPreset(preset: MnPresetObject): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const named = Boolean(preset) && typeof preset.name === 'string' && preset.name !== '';
    PRESET_OBJECT().parse(preset, MN_WHERE + 'preset ' + (named ? DOUBLE_QUOTE + preset.name + DOUBLE_QUOTE : 'object'));
  }
}

function fail(message: string): never {
  throw new Error('[minotation] ' + message);
}

/**
 * Упорядочивает пресеты так, чтобы каждая зависимость подключалась раньше зависящего.
 * Порядок устойчивый: при прочих равных — как в списке (пресет ниже перекрывает
 * хендлеры пресета выше); зависимость поднимается ровно настолько, насколько нужно.
 *
 * @param presets — список, как его передали в `setPresets`
 * @param connected — пресеты, подключённые прошлыми вызовами `setPresets`, по имени
 * @returns пресеты в порядке подключения; уже подключённые объекты пропущены
 * @throws {Error} не массив, не пресет, нет зависимости, взаимная зависимость, два разных пресета с одним именем
 *
 * @example
 * orderPresets([presetMain, presetHints, presetStandard], {});
 * // => [presetHints, presetStandard, presetMain]
 */
export function orderPresets(presets: MnPreset[], connected: Record<string, MnPresetObject>): MnPreset[] {
  // Набор пресетов передаётся явно (D-110): забытый набор — ошибка с ответом, а не «presets is not iterable».
  Array.isArray(presets) || fail('setPresets expects an array of presets, got ' + describeValue(presets));
  const byName: Record<string, MnPresetObject> = {};
  let preset: MnPreset;
  let known: MnPresetObject | undefined;
  for (preset of presets) {
    if (typeof preset !== 'function') {
      checkPreset(preset);
      known = byName[preset.name] || connected[preset.name];
      known && known !== preset && fail('two different presets are named "' + preset.name + DOUBLE_QUOTE);
      byName[preset.name] = preset;
    }
  }
  const out: MnPreset[] = [];
  // 0 — обходится сейчас (для поиска цикла), 1 — уже в `out`.
  const state = new Map<MnPreset, number>();
  const visit = (item: MnPreset, path: string[]): void => {
    const mark = state.get(item);
    if (mark === 1) {
      return;
    }
    if (typeof item === 'function') {
      state.set(item, 1);
      out.push(item);
      return;
    }
    if (mark === 0) {
      fail('presets require each other: '
        + path.slice(path.indexOf(item.name)).concat(item.name).join(' → '));
    }
    state.set(item, 0);
    for (const name of item.requires || []) {
      byName[name]
        ? visit(byName[name], path.concat(item.name))
        : connected[name] || fail(item.name + ' requires "' + name + '", which is not connected.'
          + ' Connected presets: ' + Object.keys(connected).concat(Object.keys(byName)).join(', '));
    }
    state.set(item, 1);
    // Уже подключённый прошлым вызовом объект второй раз не выполняется.
    connected[item.name] === item || out.push(item);
  };
  for (preset of presets) {
    visit(preset, []);
  }
  return out;
}
