/**
 * Пресет-объекты и порядок подключения по зависимостям (D-045, SPEC 14 §1–§2).
 *
 * Холодный путь: вызывается из `mn.setPresets` один раз на список.
 */
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
  orderPresets as orderPresetsByRequires,
} from 'fundamentool/hooks';
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
  if (process.env.NODE_ENV !== 'production') {
    const named = Boolean(preset) && typeof preset.name === 'string' && preset.name !== '';
    PRESET_OBJECT().parse(preset, MN_WHERE + 'preset ' + (named ? DOUBLE_QUOTE + preset.name + DOUBLE_QUOTE : 'object'));
  }
}

/**
 * Упорядочивает пресеты так, чтобы каждая зависимость подключалась раньше зависящего — порядком
 * `fundamentool/hooks` (fundamentool D-087). Порядок устойчивый: при прочих равных — как в списке (пресет
 * ниже перекрывает хендлеры пресета выше); зависимость поднимается ровно настолько, насколько нужно.
 * Свои поля пресет-объекта (`notationMode`, `ecosystems`, опечатки в ключах) ядро проверяет схемой
 * до упорядочивания — в разработке; имя, `setup` и `requires` проверяет порядок, всегда.
 *
 * @param presets — список, как его передали в `setPresets`
 * @param connected — пресеты, подключённые прошлыми вызовами `setPresets`, по имени
 * @returns пресеты в порядке подключения; уже подключённые объекты пропущены
 * @throws {TypeError} не массив, не пресет, нет зависимости, взаимная зависимость, два разных пресета с одним именем
 *
 * @example
 * orderPresets([presetMain, presetHints, presetStandard], {});
 * // => [presetHints, presetStandard, presetMain]
 */
export function orderPresets(presets: MnPreset[], connected: Record<string, MnPresetObject>): MnPreset[] {
  if (Array.isArray(presets)) {
    let preset: MnPreset;
    for (preset of presets) {
      typeof preset === 'function' || checkPreset(preset);
    }
  }
  return orderPresetsByRequires(presets, {
    connected,
    where: MN_WHERE + 'mn.setPresets',
  });
}
