/**
 * CSS value utilities for MN preset authors.
 *
 * All functions are accessible as `mn.utils.*` inside any preset:
 *
 * @example
 * export function presetCustom(mn: MnFn): void {
 *   mn('p', (c) => ({ style: { padding: mn.utils.val(c.arg) } }));
 *   mn('c', (c) => ({ style: { color: mn.utils.colorVal(c.arg) } }));
 * }
 */

// §6.3: pre-compiled — создаются один раз при загрузке модуля
const RE_FRAC  = /^(\d+)\/(\d+)(([+-])(\d*(?:_\d*)?)([a-z%]*))?$/;
const RE_VAL   = /^(-?)(\d*\.?\d*)(_?\d*)?([a-z%]*)$/;
const RE_SHORT_HEX = /^[0-9A-F]{1,2}$/;
const RE_NAMED_COLOR = /^[A-Z][a-z]+$/;

// ---------------------------------------------------------------------------
// Внутренняя утилита

/** Дробь → CSS-процент с двумя знаками, без хвостовых нулей. */
function fracToPercent(num: number, total: number): string {
  const v = Math.floor(num / total * 10000) / 100;
  return v.toFixed(2).replace(/\.?0+$/, '') || '0';
}

// ---------------------------------------------------------------------------
// Публичные утилиты

/**
 * Конвертирует MN-аргумент в CSS-значение с единицами.
 *
 * Поддерживаемые форматы:
 * - `''` → `'0'`
 * - `A` → `'auto'`, `N` → `'none'`
 * - `10` → `'10px'`, `10em` → `'10em'`, `10p` → `'10%'`
 * - `1_5` → `'1.5px'` (подчёркивание как десятичная точка)
 * - `1/2` → `'50%'`, `1/2+10` → `'calc(50% + 10px)'`
 *
 * @param raw - MN-аргумент
 * @param unit - единица по умолчанию (default `'px'`)
 * @returns CSS-значение
 *
 * @example
 * val('10')      // '10px'
 * val('10p')     // '10%'
 * val('A')       // 'auto'
 * val('1_5')     // '1.5px'
 * val('1/2+10')  // 'calc(50% + 10px)'
 * val('0_3s', 's') // '0.3s'
 */
export function val(raw: string, unit = 'px'): string {
  if (!raw) {
    return '0';
  }
  if (raw === 'A') {
    return 'auto';
  }
  if (raw === 'N') {
    return 'none';
  }
  const fracMatch = RE_FRAC.exec(raw);
  if (fracMatch) {
    const pct = fracToPercent(parseInt(fracMatch[1]), parseInt(fracMatch[2])) + '%';
    if (!fracMatch[3]) {
      return pct;
    }
    const sign = fracMatch[4];
    const offsetNum = fracMatch[5].replace(/_/g, '.');
    const offsetUnit = fracMatch[6] || unit;
    return `calc(${pct} ${sign} ${offsetNum || '0'}${offsetUnit})`;
  }
  const match = RE_VAL.exec(raw);
  if (match) {
    const sign = match[1];
    let num = match[2] + (match[3] ? '.' + match[3].slice(1) : '');
    let u = match[4] || unit;
    if (!num || num === '.') {
      num = '0';
    }
    if (u === 'p') {
      u = '%';
    }
    if (parseFloat(num) === 0 && !match[4]) {
      return '0';
    }
    return sign + num + u;
  }
  return raw.toLowerCase();
}

/**
 * Конвертирует MN-числовой аргумент в строку без единиц.
 * Подчёркивания заменяются точкой.
 *
 * @example
 * numVal('1_5') // '1.5'
 * numVal('42')  // '42'
 */
export function numVal(raw: string): string {
  const normalized = raw.replace(/_/g, '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? raw : String(n);
}

/**
 * Конвертирует CamelCase MN-аргумент в CSS-ключевое слово.
 *
 * Однобуквенные сокращения: `B`→`block`, `N`→`none`, `I`→`inline`, `F`→`flex`,
 * `T`→`table`, `G`→`grid`, `R`→`relative`, `A`→`absolute`, `H`→`hidden`,
 * `S`→`solid`, `D`→`dotted`, `U`→`uppercase`, `L`→`lowercase`, `C`→`capitalize`,
 * `W`→`wrap`, `O`→`overline`, `V`→`visible`, `P`→`pointer`, `E`→`end`.
 *
 * Двухбуквенные: `BB`→`border-box`, `CB`→`content-box`, `NW`→`nowrap`,
 * `PW`→`pre-wrap`, `PL`→`pre-line`.
 *
 * @example
 * kwVal('B')         // 'block'
 * kwVal('FlexStart') // 'flex-start'
 * kwVal('BB')        // 'border-box'
 */
export function kwVal(raw: string): string {
  if (!raw) {
    return raw;
  }
  if (raw.length === 1) {
    const m: Record<string, string> = {
      B: 'block',
      N: 'none',
      I: 'inline',
      F: 'flex',
      T: 'table',
      G: 'grid',
      R: 'relative',
      A: 'absolute',
      H: 'hidden',
      S: 'solid',
      D: 'dotted',
      U: 'uppercase',
      L: 'lowercase',
      C: 'capitalize',
      W: 'wrap',
      O: 'overline',
      V: 'visible',
      P: 'pointer',
      E: 'end',
    };
    if (m[raw]) {
      return m[raw];
    }
  }
  if (raw.length === 2) {
    const m2: Record<string, string> = {
      BB: 'border-box',
      CB: 'content-box',
      NW: 'nowrap',
      PW: 'pre-wrap',
      PL: 'pre-line',
    };
    if (m2[raw]) {
      return m2[raw];
    }
  }
  return raw.replace(/[A-Z]/g, (ch, i) => (i === 0 ? '' : '-') + ch.toLowerCase());
}

/**
 * Конвертирует MN-аргумент в CSS-значение выравнивания.
 * Используется для `justify-content`, `align-items`, `align-content`, `align-self`.
 *
 * Сокращения: `C`→`center`, `S`→`start`, `E`→`end`, `F`→`flex-start`,
 * `L`→`flex-end`, `B`→`space-between`, `A`→`space-around`,
 * `V`→`space-evenly`, `T`→`stretch`, `N`→`normal`.
 *
 * @example
 * alignVal('C') // 'center'
 * alignVal('B') // 'space-between'
 */
export function alignVal(raw: string): string {
  if (!raw) {
    return raw;
  }
  const m: Record<string, string> = {
    C: 'center',
    S: 'start',
    E: 'end',
    F: 'flex-start',
    L: 'flex-end',
    B: 'space-between',
    A: 'space-around',
    V: 'space-evenly',
    T: 'stretch',
    N: 'normal',
  };
  return m[raw] || kwVal(raw);
}

/**
 * Конвертирует MN-аргумент в CSS-значение `flex-direction`.
 *
 * Сокращения: `C`→`column`, `CR`→`column-reverse`, `R`→`row`, `RR`→`row-reverse`.
 *
 * @example
 * dirVal('C')  // 'column'
 * dirVal('RR') // 'row-reverse'
 */
export function dirVal(raw: string): string {
  if (!raw) {
    return raw;
  }
  const m: Record<string, string> = {
    C: 'column',
    CR: 'column-reverse',
    R: 'row',
    RR: 'row-reverse',
  };
  return m[raw] || kwVal(raw);
}

/**
 * Конвертирует MN-аргумент с подчёркиваниями в строку CSS-значений через пробел.
 * Ведущие дефисы и подчёркивания удаляются; результат приводится к нижнему регистру.
 *
 * @example
 * spacedVal('1px_solid_red') // '1px solid red'
 * spacedVal('_auto')         // 'auto'
 */
export function spacedVal(raw: string): string {
  return raw.replace(/^[_-]+/, '').replace(/_/g, ' ').toLowerCase();
}

/**
 * Разбивает MN-аргумент по подчёркиваниям и конвертирует каждую часть через `val`.
 * Удобен для многозначных CSS-свойств: `padding`, `margin`, `inset`.
 *
 * @example
 * multiVal('10_20')  // '10px 20px'
 * multiVal('A_10p')  // 'auto 10%'
 */
export function multiVal(raw: string): string {
  return raw.split('_').map(v => val(v)).join(' ');
}

/**
 * Конвертирует MN-аргумент в CSS-значение `text-decoration`.
 *
 * Сокращения: `''`/`N`→`none`, `U`→`underline`, `O`→`overline`,
 * `L`→`line-through`, `I`→`inherit`.
 *
 * @example
 * textDecoVal('U') // 'underline'
 * textDecoVal('')  // 'none'
 * textDecoVal('N') // 'none'
 */
export function textDecoVal(raw: string): string {
  const m: Record<string, string> = {
    '': 'none',
    N: 'none',
    U: 'underline',
    O: 'overline',
    L: 'line-through',
    I: 'inherit',
  };
  return m[raw] !== undefined ? m[raw] : kwVal(raw);
}

/**
 * Конвертирует MN-аргумент в CSS-значение цвета.
 *
 * Форматы:
 * - Hex (заглавные): `F00`→`#F00`, `FF0000`→`#FF0000`
 * - Именованные: `Red`→`red`, `Blue`→`blue`
 * - Сокращения: `T`→`transparent`, `CT`→`currentColor`, `F`→`#FFF`, `D`→`#DDD`, `L`→`#EEE`
 * - Короткий hex: `F`→`#FFF`, `AB`→`#AAB` (расширяется до 3 знаков)
 * - Прозрачность через точку: `F00.5`→`rgba(255,0,0,0.5)`
 *
 * @example
 * colorVal('F00')   // '#F00'
 * colorVal('F00.5') // 'rgba(255,0,0,0.5)'
 * colorVal('T')     // 'transparent'
 * colorVal('Red')   // 'red'
 */
export function colorVal(raw: string): string {
  if (!raw) {
    return '#000';
  }
  const dot = raw.indexOf('.');
  let alphaStr = '';
  if (dot > 0) {
    alphaStr = raw.slice(dot); // '.88' — точка используется непосредственно из токена
    if (parseFloat(alphaStr) >= 1) {
      alphaStr = '';
    } else {
      raw = raw.slice(0, dot);
    }
  }
  const synonyms: Record<string, string> = {
    T: 'transparent',
    CT: 'currentColor',
    D: '#DDD',
    L: '#EEE',
    F: '#FFF',
  };
  let hex = synonyms[raw];
  if (!hex) {
    if (RE_NAMED_COLOR.test(raw)) {
      hex = raw.toLowerCase();
    } else if (RE_SHORT_HEX.test(raw)) {
      hex = '#' + raw.repeat(Math.ceil(3 / raw.length)).slice(0, 3);
    } else {
      hex = '#' + raw;
    }
  }
  if (alphaStr && hex.startsWith('#')) {
    const h = hex.slice(1);
    const hl = h.length;
    const step = hl === 3 ? 1 : 2;
    const ok = hl >= 3;
    const r = parseInt(ok ? h.slice(0, step).padEnd(2, h[0]) : '0', 16);
    const g = parseInt(ok ? h.slice(step, step === 1 ? 2 : 4).padEnd(2, h[step] || '0') : '0', 16);
    const b = parseInt(ok ? h.slice(-step).padEnd(2, h[hl - 1]) : '0', 16);
    return `rgba(${r},${g},${b},${alphaStr})`;
  }
  return hex;
}

/**
 * Конвертирует MN-аргумент в CSS-значение `font-weight`.
 *
 * Сокращения: `N`→`normal`, `B`→`bold`, `BR`→`bolder`, `LR`→`lighter`.
 * Цифры: `4`→`400`, `7`→`700`; числа ≥10 используются как есть.
 *
 * @example
 * weightVal('B')   // 'bold'
 * weightVal('7')   // '700'
 * weightVal('400') // '400'
 */
export function weightVal(raw: string): string {
  const m: Record<string, string> = {
    N: 'normal',
    B: 'bold',
    BR: 'bolder',
    LR: 'lighter', 
  };
  if (m[raw]) {
    return m[raw];
  }
  const n = parseInt(raw, 10);
  if (!isNaN(n)) {
    return String(n < 10 ? n * 100 : n);
  }
  return raw.toLowerCase();
}

/**
 * Конвертирует MN transform DSL-аргумент в CSS-значение `transform`.
 * Вызывается для тега `x`; аргумент — всё после `x` в токене.
 *
 * DSL:
 * - `10` / `-50%` → `translateX(10px)` / `translateX(-50%)`
 * - `Y-50%` → `translateY(-50%)`
 * - `S1.5` → `scale(1.5)`
 * - `Rz70` → `rotateZ(70deg)`, `Rx-60` → `rotateX(-60deg)`
 *
 * @example
 * transformVal('10')    // 'translateX(10px)'
 * transformVal('Y-50%') // 'translateY(-50%)'
 * transformVal('S1.5')  // 'scale(1.5)'
 * transformVal('Rz70')  // 'rotateZ(70deg)'
 */
export function transformVal(arg: string): string {
  if (!arg) {
    return 'none';
  }
  if (arg[0] === 'S') {
    const n = parseFloat(arg.slice(1).replace(/_/g, '.'));
    return `scale(${isNaN(n) ? 1 : n})`;
  }
  if (arg[0] === 'R' && arg.length > 2) {
    const dir = arg[1].toUpperCase();
    const angle = val(arg.slice(2), 'deg');
    return `rotate${dir}(${angle})`;
  }
  if (arg[0] === 'Y') {
    return `translateY(${val(arg.slice(1), 'px')})`;
  }
  return `translateX(${val(arg, 'px')})`;
}

/**
 * Конвертирует MN filter DSL-аргумент в CSS-значение `filter` / `backdrop-filter`.
 * Несколько функций разделяются подчёркиванием.
 *
 * @example
 * filterVal('Blur10')         // 'blur(10px)'
 * filterVal('Grayscale100')   // 'grayscale(100%)'
 * filterVal('Hue95')          // 'hue-rotate(95deg)'
 * filterVal('Blur3_Invert20') // 'blur(3px) invert(20%)'
 */
export function filterVal(arg: string): string {
  if (!arg) {
    return 'none';
  }
  const funcNameMap: Record<string, string> = {
    Hue: 'hue-rotate', 
  };
  const unitMap: Record<string, string> = {
    blur: 'px',
    'hue-rotate': 'deg', 
  };
  return arg.split('_').map(part => {
    const m = /^([A-Z][a-z]*)(-?[\d.]*)([a-z%]*)$/.exec(part);
    if (!m) {
      return part.toLowerCase();
    }
    const [
      , name,
      num,
      unit,
    ] = m;
    const funcName = funcNameMap[name] ?? kwVal(name);
    const defUnit = unit || (num ? (unitMap[funcName] ?? '%') : '');
    return `${funcName}(${num}${defUnit})`;
  }).join(' ');
}

/**
 * Конвертирует MN shadow DSL-аргумент в CSS-значение `box-shadow` / `text-shadow`.
 *
 * Формат: `{offset}[r{blur}][x{x}][y{y}][c{color}][in[set]]`
 *
 * @example
 * shadowVal('0r18cF.25') // '0 0 18px rgba(255,255,255,0.25)'
 * shadowVal('5r7cF00')   // '5px 5px 7px #F00'
 * shadowVal('5in')       // 'inset 5px 5px 0 #000'
 */
export function shadowVal(arg: string): string {
  if (!arg || arg === '0') {
    return '0 0 0 #000';
  }
  const numMatch = /^(-?[\d.]+)(px|rem|em|%|vw|vh)?/.exec(arg);
  let offset = '0';
  let rest = arg;
  if (numMatch) {
    const raw = numMatch[1];
    offset = parseFloat(raw) === 0 ? '0' : raw + (numMatch[2] || 'px');
    rest = arg.slice(numMatch[0].length);
  }
  let x = offset;
  let y = offset;
  let blur = '0';
  let colorStr = '#000';
  let inset = '';
  const rMatch = /r(-?[\d.]+)(px)?/.exec(rest);
  if (rMatch) {
    blur = rMatch[1] + (rMatch[2] || 'px');
  }
  const xMatch = /x(-?[\d.]+)(px|%|vw)?/.exec(rest);
  if (xMatch) {
    x = xMatch[1] + (xMatch[2] || 'px');
  }
  const yMatch = /y(-?[\d.]+)(px|%|vh)?/.exec(rest);
  if (yMatch) {
    y = yMatch[1] + (yMatch[2] || 'px');
  }
  const cIdx = rest.indexOf('c');
  if (cIdx !== -1) {
    const colorPart = rest.slice(cIdx + 1).replace(/in(?:set)?$/, '');
    if (colorPart) {
      colorStr = colorVal(colorPart);
    }
  }
  if (/in(?:set)?$/.test(arg)) {
    inset = 'inset ';
  }
  return `${inset}${x} ${y} ${blur} ${colorStr}`;
}

// ---------------------------------------------------------------------------
// Экспортируемый объект

/**
 * Набор CSS value utilities, доступных через `mn.utils.*` в любом пресете.
 *
 * @see {@link val} - универсальное значение с единицами
 * @see {@link colorVal} - значение цвета
 * @see {@link kwVal} - CSS-ключевое слово из CamelCase
 */
export const mnUtils = {
  /** Универсальное CSS-значение с единицами (`10`→`10px`, `10p`→`10%`, `A`→`auto`) */
  val,
  /** Числовое значение без единиц (`1_5`→`1.5`) */
  numVal,
  /** CSS-ключевое слово из CamelCase (`FlexStart`→`flex-start`, `B`→`block`) */
  kwVal,
  /** Значение выравнивания (`C`→`center`, `B`→`space-between`) */
  alignVal,
  /** Значение `flex-direction` (`C`→`column`, `RR`→`row-reverse`) */
  dirVal,
  /** Пробел-разделённое значение из подчёркиваний (`1px_solid`→`1px solid`) */
  spacedVal,
  /** Несколько `val`-значений через пробел (`10_20`→`10px 20px`) */
  multiVal,
  /** Значение `text-decoration` (`U`→`underline`, `L`→`line-through`) */
  textDecoVal,
  /** Значение цвета (`F00`→`#F00`, `F00.5`→`rgba(255,0,0,0.5)`) */
  colorVal,
  /** Значение `font-weight` (`B`→`bold`, `7`→`700`) */
  weightVal,
  /** Transform DSL (`Rz70`→`rotateZ(70deg)`, `S1.5`→`scale(1.5)`) */
  transformVal,
  /** Filter DSL (`Blur10`→`blur(10px)`, `Grayscale100`→`grayscale(100%)`) */
  filterVal,
  /** Shadow DSL (`5r7cF00`→`5px 5px 7px #F00`) */
  shadowVal,
} as const;

/** Тип объекта `mn.utils` — набор CSS value utilities для авторов пресетов. */
export type MnUtils = typeof mnUtils;
