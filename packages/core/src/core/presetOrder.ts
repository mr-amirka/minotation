/**
 * Пресет-объекты и порядок подключения по зависимостям (D-045, SPEC 14 §1–§2).
 *
 * Холодный путь: вызывается из `mn.setPresets` один раз на список.
 */
import {
  checkOptions, isFunction, isString, isStringArray, oneOf,
} from '../checkOptions';
import type {
  OptionSchema,
} from '../checkOptions';
import type {
  MnPreset, MnPresetObject,
} from './types';

/** Допустимые поля пресет-объекта. */
const PRESET_SCHEMA: OptionSchema = {
  name: isString,
  requires: isStringArray,
  ecosystems: isStringArray,
  notationMode: oneOf(
    'context-qualified', 'tailwind-compatible', 'breakpoint-prefixed', 'property-value',
  ),
  setup: isFunction,
};

/** Проверяет пресет-объект: обязательные `name`, `setup` и схема полей (D-038). */
function checkPreset(preset: MnPresetObject): void {
  const where = 'preset ' + (typeof preset.name === 'string' ? '"' + preset.name + '"' : 'object');
  checkOptions(
    preset, PRESET_SCHEMA, where,
  );
  typeof preset.name === 'string' && preset.name
    || fail(where + ': a preset object needs a "name"');
  typeof preset.setup === 'function' || fail(where + ': a preset object needs a "setup(mn)" function');
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
 * @throws {Error} нет зависимости, взаимная зависимость, два разных пресета с одним именем
 *
 * @example
 * orderPresets([presetMain, presetHints, presetStandard], {});
 * // => [presetHints, presetStandard, presetMain]
 */
export function orderPresets(presets: MnPreset[], connected: Record<string, MnPresetObject>): MnPreset[] {
  const byName: Record<string, MnPresetObject> = {};
  let preset: MnPreset;
  let known: MnPresetObject | undefined;
  for (preset of presets) {
    if (typeof preset !== 'function') {
      checkPreset(preset);
      known = byName[preset.name] || connected[preset.name];
      known && known !== preset && fail('two different presets are named "' + preset.name + '"');
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
