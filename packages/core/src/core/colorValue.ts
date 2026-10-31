/**
 * Цвет и фон в записи нотации: код (`F00`, `F00.5`), переменная (`$ink`, `$ink{F00}`), градиент из них
 * (`F00-00F`, `$a$b`, `$a;-F00p50`), его угол (`_g90`), радиальная форма (`_r`, `_rEllipse`), повтор (`_rpt`).
 *
 * Запись переменной — нотации, а не библиотеки цвета: fundamentool переводит только код в `#rgb` / `rgba()`
 * ({@link color}), переменную читает ядро ({@link cssVarValue}) — так, как в любом другом значении.
 *
 * @module colorValue
 */
import {
  camelToKebabCase,
  color,
} from 'fundamentool';
import {
  cssVarValue,
  throwOldVariable,
} from './mathValue';

const DASH = '-';
const DOLLAR = '$';
const SEMICOLON = ';';
const OPEN_BRACE = '{';
const CLOSE_BRACE = '}';
const CLOSE_PAREN = ')';
const PERCENT = '%';
const COMMA = ',';
const SPACE = ' ';
const UNDERSCORE = '_';
const CIRCLE = 'circle';

/** Повторяющийся градиент: `F00-00F_rpt`. */
const REGEXP_REPEAT = /^(.*)_rpt$/i;
/** Радиальный (`_r`, `_rEllipse_at_top`) или угол (`_g90`, `_g-45`) в конце. */
const REGEXP_ANGLE = /^(.*)((_r)_?([A-Za-z_]*)|_g(-?[0-9]+))$/i;
/** Код со стопом: `F00`, `F00.5p40%`. */
const REGEXP_CODE_STOP = /^([A-Fa-f0-9]+(\.[0-9]+)?)(p([0-9]+)([a-z%]*))?$/i;
/** Стоп после переменной: `$a;p40%`. */
const REGEXP_STOP = /^p([0-9]+)([a-z%]*)/i;
/** Разделитель слов радиальной формы: `Ellipse_at_top` → `ellipse at top`. */
const REGEXP_UNDERSCORES = /_+/;

/**
 * Цвет: переменная целиком (`$ink` → `var(--ink)`, `$ink{F00}` → `var(--ink, F00)`) или код
 * (`F00` → `#f00`; с альфой и `alt` — запасной `#rgb` и `rgba()`).
 *
 * @param v — цвет, как записан в токене
 * @param alt — вернуть запасной цвет без альфы перед `rgba()`
 * @returns варианты значения: один, или запасной и основной
 * @throws {MnParseError} прежняя запись переменной (`--ink`)
 * @example colorValue('$ink') // ['var(--ink)']
 */
export function colorValue(v: string, alt?: boolean): string[] {
  const css = cssVarValue(v);
  return css ? [css] : color(v, alt);
}

/**
 * Фон: цвет или градиент из цветов через `-`. Переменная кончается там, где кончается имя CSS; `;` — где имя
 * могло бы продолжиться: `$a$b` и `$a;-F00` — по два цвета. Стоп — `p` и позиция после цвета: `F00p40`,
 * `$a;p40%`; без стопа цвета расходятся равномерно.
 *
 * @param input — суффикс фона: `F00-00F_g90`, `$a$b_r`
 * @param alt — у кода с альфой: сначала градиент без альфы
 * @returns варианты значения: один цвет — его варианты; градиент — один, или без альфы и с альфой
 * @throws {MnParseError} прежняя запись переменной (`--a;--b`)
 * @example gradientValue('F00-00F') // ['linear-gradient(180deg,#f00 0%,#00f 100%)']
 */
export function gradientValue(input: string, alt?: boolean): string[] {
  let v = input;
  let matches: RegExpExecArray | null;
  let repeating = 0;
  let radial = '';
  let angle = 180;
  matches = REGEXP_REPEAT.exec(v);
  if (matches) {
    repeating = 1;
    v = matches[1];
  }
  matches = REGEXP_ANGLE.exec(v);
  if (matches) {
    v = matches[1];
    if (matches[3]) {
      radial = camelToKebabCase(matches[4] || CIRCLE).split(REGEXP_UNDERSCORES).join(SPACE);
    } else {
      angle = (angle + parseInt(matches[5], 10)) % 360;
      angle < 0 && (angle += 360);
    }
  }
  const colors: string[][] = [];
  const stops: string[] = [];
  readStops(
    v, colors, stops, input, alt,
  );
  const l = colors.length;
  if (l < 2) {
    return l ? colors[0] : [];
  }
  const last = l - 1;
  const prefix = (repeating ? 'repeating-' : '') + (radial ? 'radial' : 'linear') + '-gradient('
    + (radial || angle + 'deg');
  const plain: string[] = [prefix];
  const withAlpha: string[] = [prefix];
  let hasAlpha = 0;
  let i = 0;
  let stop: string;
  let alts: string[];
  for (; i < l; i++) {
    stop = SPACE + (stops[i] || Math.round(i * 100 / last) + PERCENT);
    alts = colors[i];
    plain.push(alts[0] + stop);
    withAlpha.push((alts[1] ? (hasAlpha = 1, alts[1]) : alts[0]) + stop);
  }
  const gradient = plain.join(COMMA) + CLOSE_PAREN;
  if (!alt) {
    return [gradient];
  }
  const result = colors[0].concat(gradient);
  hasAlpha && result.push(withAlpha.join(COMMA) + CLOSE_PAREN);
  return result;
}

/**
 * Цвета градиента и их стопы. Переменная — до конца имени, `{…}` запасного варианта и `;`; код — до `-` или `$`.
 * Цвет, который не прочитался, уходит как написан — его бракует проверка стопов хендлера. `--` — прежняя запись
 * переменной.
 */
function readStops(
  v: string, colors: string[][], stops: string[], input: string, alt?: boolean,
): void {
  const end = v.length;
  let pos = 0;
  let start: number;
  let item: string;
  let depth: number;
  let m: RegExpExecArray | null;
  let ch: string;
  while (pos < end) {
    if (v[pos] === DASH) {
      v[pos + 1] === DASH && throwOldVariable(input);
      pos++;
      continue;
    }
    start = pos;
    if (v[pos] === DOLLAR) {
      pos++;
      v[pos] === DOLLAR && pos++;
      for (; pos < end; pos++) {
        ch = v[pos];
        if (!(ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' || ch === DASH
          || ch === UNDERSCORE || ch >= '\u0080')) {
          break;
        }
      }
      if (v[pos] === OPEN_BRACE) {
        for (depth = 0; pos < end; pos++) {
          ch = v[pos];
          ch === OPEN_BRACE ? depth++ : ch === CLOSE_BRACE && depth--;
          if (!depth) {
            pos++;
            break;
          }
        }
      }
      item = v.slice(start, pos);
      v[pos] === SEMICOLON && pos++;
      colors.push(colorValue(item));
      m = REGEXP_STOP.exec(v.slice(pos));
      m && (pos += m[0].length);
      stops.push(m ? m[1] + (m[2] || PERCENT) : '');
    } else {
      while (pos < end && v[pos] !== DASH && v[pos] !== DOLLAR) {
        pos++;
      }
      item = v.slice(start, pos);
      m = REGEXP_CODE_STOP.exec(item);
      colors.push(color(m ? m[1] : item, alt));
      stops.push(m && m[4] ? m[4] + (m[5] || PERCENT) : '');
    }
  }
}
