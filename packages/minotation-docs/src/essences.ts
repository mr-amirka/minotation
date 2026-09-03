/**
 * Справочник хендлеров minotation для сайта документации.
 *
 * Источник — HANDLERS.md (`packages/minotation/packages/core/HANDLERS.md`),
 * уже сверенный прямыми вызовами `minotationProvider`+`presetStandard` против
 * собранного dist/. Каждый `examples`-токен здесь — литерал из HANDLERS.md
 * (не переизобретён и не скопирован из старого 1.x essences.js) — реальный
 * CSS для него компилируется здесь же, в браузере, на старте приложения
 * (см. `data.ts`), а не хранится как текст.
 *
 * Не является 1:1 построчным портом старого `old/mn-docs/src/essences/index.js`
 * (1012 строк на ~150 хендлеров 1.x с ручными regex-описаниями `params`) —
 * тот источник частично устарел (изменившиеся хендлеры вроде `fx`/`fxw`,
 * упразднённые вроде `contrast`→`image-rendering`-only). Здесь — то, что
 * реально задокументировано и проверено для текущего v1-порта.
 */

export interface MnDocEntry {
  /** Тег хендлера, например `'p'`. */
  name: string;
  /** CSS-свойства, которые задаёт хендлер. */
  props: string;
  /** Краткое описание — если тег не самоочевиден. */
  description?: string;
  /** Ключевые слова для поиска (помимо имени/props). */
  keywords?: string[];
  /** Человекочитаемое описание формата аргумента. */
  params?: string;
  /** Полные токены-примеры (уже готовые к компиляции, не шаблоны с `&`). */
  examples: string[];
}

export const ESSENCES: MnDocEntry[] = [
  // --- Отступы ---
  {
    name: 'p', props: 'padding', params: '{число}[px|%|em|...] | A(auto) | N(none)',
    keywords: ['padding', 'отступ'],
    examples: ['p10', 'p0'],
  },
  { name: 'px', props: 'padding-left, padding-right', description: 'horizontal padding', keywords: ['padding', 'horizontal'], examples: ['px8', 'px1.5'] },
  { name: 'py', props: 'padding-top, padding-bottom', description: 'vertical padding', keywords: ['padding', 'vertical'], examples: ['py4'] },
  { name: 'pt', props: 'padding-top', examples: ['pt4'] },
  { name: 'pb', props: 'padding-bottom', examples: ['pb4'] },
  { name: 'pl', props: 'padding-left', examples: ['pl4'] },
  { name: 'pr', props: 'padding-right', examples: ['pr4'] },
  { name: 'm', props: 'margin', params: '{число}[px|%|em|...] | A(auto) | N(none)', keywords: ['margin', 'отступ'], examples: ['m0'] },
  { name: 'mx', props: 'margin-left, margin-right', description: 'horizontal margin', keywords: ['margin', 'horizontal', 'auto'], examples: ['mx4', 'mxA'] },
  { name: 'my', props: 'margin-top, margin-bottom', description: 'vertical margin', keywords: ['margin', 'vertical'], examples: ['my12'] },
  { name: 'mt', props: 'margin-top', examples: ['mt8'] },
  { name: 'mb', props: 'margin-bottom', examples: ['mb8'] },

  // --- Размеры ---
  { name: 'w', props: 'width', params: '{число}[px|%] | пусто → 100%', keywords: ['width', 'ширина'], examples: ['w', 'w320', 'w50%'] },
  { name: 'wmin', props: 'min-width', examples: ['wmin60'] },
  { name: 'wmax', props: 'max-width', examples: ['wmax60'] },
  { name: 'h', props: 'height', keywords: ['height', 'высота'], examples: ['h75'] },
  { name: 'sq', props: 'width, height', description: 'square — квадрат', keywords: ['square', 'квадрат'], examples: ['sq32', 'sq44'] },

  // --- Позиционирование ---
  { name: 'fixed', props: 'position', examples: ['fixed'] },
  { name: 'abs', props: 'position', examples: ['abs'] },
  { name: 'rlv', props: 'position', examples: ['rlv'] },
  { name: 'sticky', props: 'position', examples: ['sticky'] },
  { name: 'st', props: 'top', keywords: ['side', 'top'], examples: ['st16'] },
  { name: 'sr', props: 'right', keywords: ['side', 'right'], examples: ['sr16'] },
  { name: 'sb', props: 'bottom', keywords: ['side', 'bottom'], examples: ['sb24'] },
  { name: 'sl', props: 'left', keywords: ['side', 'left'], examples: ['sl50%'] },
  { name: 's', props: 'top, right, bottom, left', description: 'все стороны сразу', keywords: ['side', 'inset'], examples: ['s0'] },
  { name: 'z', props: 'z-index', examples: ['z1200'] },

  // --- Flex ---
  {
    name: 'fx', props: 'flex', description: 'только flex-shorthand, не display:flex (см. dF)',
    params: 'обязателен аргумент, напр. flex-grow[_flex-shrink_flex-basis]',
    keywords: ['flex', 'grow', 'shrink', 'basis'],
    examples: ['fx1'],
  },
  { name: 'fxd', props: 'flex-direction', keywords: ['flex', 'direction'], params: 'C(column) R(row) CR RR', examples: ['fxdC'] },
  { name: 'ai', props: 'align-items', keywords: ['flex', 'align', 'items'], params: 'C(center) FS(flex-start) FE(flex-end) B(baseline) S(stretch)', examples: ['aiC', 'aiS'] },
  { name: 'jc', props: 'justify-content', keywords: ['flex', 'justify', 'content'], params: 'C(center) FS FE SA(space-around) SB(space-between)', examples: ['jcC', 'jcSB'] },
  { name: 'as', props: 'align-self', keywords: ['flex', 'align', 'self'], params: 'C FE FS S(start) ST(stretch) E(end)', examples: ['asST'] },
  { name: 'ac', props: 'align-content', keywords: ['flex', 'align', 'content'], examples: ['acC'] },
  { name: 'fxg', props: 'flex-grow', keywords: ['flex', 'grow'], examples: ['fxg1'] },
  { name: 'fxs', props: 'flex-shrink', keywords: ['flex', 'shrink'], examples: ['fxs0'] },
  { name: 'fxw', props: 'flex-wrap', keywords: ['flex', 'wrap'], params: 'Wrap Nowrap WrapReverse', examples: ['fxwWrap'] },
  { name: 'gap', props: 'gap', examples: ['gap2'] },

  // --- Типографика ---
  { name: 'f', props: 'font-size', keywords: ['font', 'size', 'шрифт'], examples: ['f12', 'f14', 'f22'] },
  { name: 'fw', props: 'font-weight', keywords: ['font', 'weight'], examples: ['fw5', 'fwBold'] },
  {
    name: 'lh', props: 'line-height', keywords: ['line', 'height'],
    description: 'всегда получает px, даже без явной единицы',
    examples: ['lh1', 'lh1.4', 'lh20px'],
  },
  {
    name: 'lts', props: 'letter-spacing', keywords: ['letter', 'spacing'],
    description: 'НЕ получает px автоматически, в отличие от lh',
    examples: ['lts1.5'],
  },
  { name: 'tt', props: 'text-transform', keywords: ['text', 'transform', 'uppercase'], examples: ['ttU'] },
  {
    name: 'ta', props: 'text-align', keywords: ['text', 'align'],
    description: 'НЕ tc/tr/tl — таких тегов не существует',
    params: 'C(center) R(right) L(left) J(justify) E S',
    examples: ['taC', 'taR', 'taL'],
  },
  { name: 'd', props: 'display', keywords: ['display'], params: 'B(block) N(none) F(flex) I(inline) IB(inline-block)', examples: ['dB', 'dN', 'dF'] },
  { name: 'cr', props: 'cursor', keywords: ['cursor', 'pointer'], examples: ['crP'] },
  { name: 'us', props: 'user-select', keywords: ['user', 'select'], examples: ['usN'] },

  // --- Цвет ---
  {
    name: 'c', props: 'color', keywords: ['color', 'цвет'],
    params: '{hex}[.alpha] | синонимы F(#fff) D(#ddd) T(transparent) CT(currentColor)',
    description: 'ищет последнюю точку в аргументе → всё после неё = alpha (0-1)',
    examples: ['cF', 'cF.38', 'c0', 'c0.5', 'cF00', 'c0A0A12'],
  },
  {
    name: 'bg', props: 'background', keywords: ['background', 'фон', 'color'],
    params: 'как у color(); при altColor (умолчание) даёт и hex, и rgba() параллельно',
    examples: ['bg0', 'bgF', 'bgF.1', 'bg0A0A12.88'],
  },
  { name: 'bgc', props: 'background-color', keywords: ['background', 'color'], examples: ['bgcF.12', 'bgcF.28'] },

  // --- Граница ---
  { name: 'b', props: 'border-width', keywords: ['border', 'width'], examples: ['b1'] },
  { name: 'bs', props: 'border-style', keywords: ['border', 'style'], params: 'S(solid) DT(dotted) DS(dashed) N(none)', examples: ['bsS'] },
  { name: 'bc', props: 'border-color', keywords: ['border', 'color'], examples: ['bcF.1'] },
  { name: 'bl', props: 'border-left-width', keywords: ['border', 'left'], examples: ['bl1'] },
  { name: 'bsl', props: 'border-left-style', keywords: ['border', 'left', 'style'], examples: ['bslS'] },
  { name: 'bcl', props: 'border-left-color', keywords: ['border', 'left', 'color'], examples: ['bclF.12'] },
  { name: 'br', props: 'border-right-width', keywords: ['border', 'right'], examples: ['br1'] },
  { name: 'bsr', props: 'border-right-style', keywords: ['border', 'right', 'style'], examples: ['bsrS'] },
  { name: 'bcr', props: 'border-right-color', keywords: ['border', 'right', 'color'], examples: ['bcrF.1'] },
  { name: 'bt', props: 'border-top-width', keywords: ['border', 'top'], examples: ['bt1'] },
  { name: 'bst', props: 'border-top-style', keywords: ['border', 'top', 'style'], examples: ['bstS'] },
  { name: 'bct', props: 'border-top-color', keywords: ['border', 'top', 'color'], examples: ['bctF.1'] },
  { name: 'bb', props: 'border-bottom-width', keywords: ['border', 'bottom'], examples: ['bb1'] },
  { name: 'bsb', props: 'border-bottom-style', keywords: ['border', 'bottom', 'style'], examples: ['bsbS'] },
  { name: 'bcb', props: 'border-bottom-color', keywords: ['border', 'bottom', 'color'], examples: ['bcbF.08'] },
  {
    name: 'r', props: 'border-radius', keywords: ['border', 'radius', 'circle'],
    description: 'без аргумента — полный круг (10000px)',
    examples: ['r', 'r1', 'r4', 'r8'],
  },
  { name: 'bxz', props: 'box-sizing', keywords: ['box', 'sizing'], params: 'BB(border-box) CB(content-box)', examples: ['bxzBB', 'bxzCB'] },

  // --- Box-shadow / text-shadow ---
  {
    name: 'bxsh', props: 'box-shadow', keywords: ['box', 'shadow', 'тень'],
    params: '{blur}[X{offsetX}][Y{offsetY}][R{spread}][c{hex}] — модификаторы в любом порядке',
    description: 'inset (In) задокументирован, но не применяется ни в каком сочетании',
    examples: ['bxsh18', 'bxsh19r3', 'bxsh19c43F', 'bxsh19r3c43F', 'bxsh19x5y5r3c43F'],
  },
  {
    name: 'tsh', props: 'text-shadow', keywords: ['text', 'shadow', 'тень'],
    description: 'как bxsh, но без spread (r молча отбрасывается)',
    examples: ['tsh10r2c00F'],
  },

  // --- Переходы ---
  { name: 'dn', props: 'transition-duration', keywords: ['transition', 'duration', 'анимация'], examples: ['dn', 'dn150', 'dn200', 'dn300'] },

  // --- Фильтры ---
  {
    name: 'ft', props: 'filter', keywords: ['filter', 'blur', 'grayscale', 'brightness'],
    params: '{CamelCase имя функции}{число}[единица], несколько через _',
    examples: ['ftBlur10', 'ftBlur4', 'ftGrayscale100', 'ftBrightness150'],
  },
  { name: 'ftb', props: 'backdrop-filter', keywords: ['filter', 'backdrop', 'blur'], examples: ['ftbBlur8', 'ftbBlur10', 'ftbBlur12'] },

  // --- Transform ---
  {
    name: 'x', props: 'transform', keywords: ['transform', 'translate', 'rotate', 'scale'],
    params: 'x{n}[%][Y{n}[%]][Z{n}[%]][S{n}][R{x|y|z}{n}{unit}] — translate всегда база',
    description: 'S{n} = n/100, не буквальный scale()',
    examples: ['x-50%', 'xY-50%', 'xS150', 'xRz70', 'xRx-60', 'x50Y30S150Rz45'],
  },

  // --- Misc ---
  { name: 'ov', props: 'overflow', examples: ['ov'] },
  { name: 'ovy', props: 'overflow-y, -webkit-overflow-scrolling', keywords: ['overflow', 'scroll'], examples: ['ovyAuto'] },
  { name: 'contrast', props: 'image-rendering', description: 'фиксированный алиас, без аргумента', examples: ['contrast'] },
  {
    name: 'ratio', props: 'padding-top (+ дочерний position:absolute)', keywords: ['aspect', 'ratio', 'соотношение сторон'],
    examples: ['ratio3x2'],
  },
];
