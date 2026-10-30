/**
 * Справочник хендлеров minotation для сайта документации.
 *
 * Первый блок записей (до "Границы (доп.)") — источник `HANDLERS.md`
 * (`packages/minotation/packages/core/HANDLERS.md`), уже сверенный прямыми
 * вызовами `minotationProvider`+`presetStandard` против собранного dist/.
 *
 * Остальные записи (с 2026-09-04) — полный порт `old/mn-docs/src/essences/index.js`
 * (1.x, 158 хендлеров): каждый пример НЕ скопирован из старого файла буквально —
 * сверен заново прямой live-компиляцией против собранного dist/ (см. методологию
 * MEMORY `feedback_bundler_plugins_need_real_builds.md` — старые описания могли
 * устареть, часть уже была изменена в v1-порту, напр. `fx`/`fxw`). Из 158 старых
 * тегов 7 подтверждённо более не существуют (не дают CSS в реальной компиляции) —
 * сознательно не портированы: `layout`, `fha`, `fva`, `tl`, `tr`, `tc` (устарели —
 * `ta`+буква заменил `tl`/`tr`/`tc`), `break`. Каждый `examples`-токен здесь
 * компилируется здесь же, в браузере, на старте приложения (см. `data.ts`),
 * а не хранится как статичный текст.
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
  { name: 'px', props: 'padding-inline (axisMode physical: padding-left, padding-right)', description: 'inline-axis padding — left + right in horizontal text', keywords: ['padding', 'horizontal', 'inline', 'logical'], examples: ['px8', 'px1.5'] },
  { name: 'py', props: 'padding-block (axisMode physical: padding-top, padding-bottom)', description: 'block-axis padding — top + bottom in horizontal text', keywords: ['padding', 'vertical', 'block', 'logical'], examples: ['py4'] },
  { name: 'pt', props: 'padding-top', examples: ['pt4'] },
  { name: 'pb', props: 'padding-bottom', examples: ['pb4'] },
  { name: 'pl', props: 'padding-left', examples: ['pl4'] },
  { name: 'pr', props: 'padding-right', examples: ['pr4'] },
  { name: 'ps', props: 'padding-inline-start', description: 'inline start — left in LTR, right in RTL', keywords: ['padding', 'inline', 'start', 'logical'], examples: ['ps10'] },
  { name: 'pie', props: 'padding-inline-end', description: 'inline end; not pe — pe is pointer-events (D-103)', keywords: ['padding', 'inline', 'end', 'logical'], examples: ['pie10'] },
  { name: 'pbs', props: 'padding-block-start', keywords: ['padding', 'block', 'start', 'logical'], examples: ['pbs10'] },
  { name: 'pbe', props: 'padding-block-end', keywords: ['padding', 'block', 'end', 'logical'], examples: ['pbe10'] },
  { name: 'm', props: 'margin', params: '{число}[px|%|em|...] | A(auto) | N(none)', keywords: ['margin', 'отступ'], examples: ['m0'] },
  { name: 'mx', props: 'margin-inline (axisMode physical: margin-left, margin-right)', description: 'inline-axis margin — left + right in horizontal text', keywords: ['margin', 'horizontal', 'inline', 'logical', 'auto'], examples: ['mx4', 'mxA'] },
  { name: 'my', props: 'margin-block (axisMode physical: margin-top, margin-bottom)', description: 'block-axis margin — top + bottom in horizontal text', keywords: ['margin', 'vertical', 'block', 'logical'], examples: ['my12'] },
  { name: 'mt', props: 'margin-top', examples: ['mt8'] },
  { name: 'mb', props: 'margin-bottom', examples: ['mb8'] },
  { name: 'ms', props: 'margin-inline-start', keywords: ['margin', 'inline', 'start', 'logical'], examples: ['ms8'] },
  { name: 'me', props: 'margin-inline-end', keywords: ['margin', 'inline', 'end', 'logical'], examples: ['meA'] },
  { name: 'mbs', props: 'margin-block-start', keywords: ['margin', 'block', 'start', 'logical'], examples: ['mbs8'] },
  { name: 'mbe', props: 'margin-block-end', keywords: ['margin', 'block', 'end', 'logical'], examples: ['mbe8'] },

  // --- Размеры ---
  { name: 'w', props: 'width', params: '{число}[px|%] | пусто → 100%', keywords: ['width', 'ширина'], examples: ['w', 'w320', 'w50%'] },
  { name: 'wmin', props: 'min-width', examples: ['wmin60'] },
  { name: 'wmax', props: 'max-width', examples: ['wmax60'] },
  { name: 'h', props: 'height', keywords: ['height', 'высота'], examples: ['h75'] },
  { name: 'iz', props: 'inline-size', description: 'logical width', keywords: ['inline', 'size', 'width', 'logical'], examples: ['iz100'] },
  { name: 'izmin', props: 'min-inline-size', keywords: ['inline', 'size', 'min', 'logical'], examples: ['izmin60'] },
  { name: 'izmax', props: 'max-inline-size', keywords: ['inline', 'size', 'max', 'logical'], examples: ['izmax100%'] },
  { name: 'bz', props: 'block-size', description: 'logical height', keywords: ['block', 'size', 'height', 'logical'], examples: ['bz50%'] },
  { name: 'bzmin', props: 'min-block-size', keywords: ['block', 'size', 'min', 'logical'], examples: ['bzmin60'] },
  { name: 'bzmax', props: 'max-block-size', keywords: ['block', 'size', 'max', 'logical'], examples: ['bzmaxN'] },
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
  { name: 'ss', props: 'inset-inline-start', description: 'inset + start', keywords: ['side', 'inset', 'inline', 'start', 'logical'], examples: ['ss0'] },
  { name: 'se', props: 'inset-inline-end', keywords: ['side', 'inset', 'inline', 'end', 'logical'], examples: ['se0'] },
  { name: 'sbs', props: 'inset-block-start', keywords: ['side', 'inset', 'block', 'start', 'logical'], examples: ['sbs0'] },
  { name: 'sbe', props: 'inset-block-end', keywords: ['side', 'inset', 'block', 'end', 'logical'], examples: ['sbe0'] },
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
  { name: 'bisw', props: 'border-inline-start-width', description: 'not bs — bs is border-style (D-103, D-117)', keywords: ['border', 'inline', 'start', 'logical'], examples: ['bisw1'] },
  { name: 'biew', props: 'border-inline-end-width', keywords: ['border', 'inline', 'end', 'logical'], examples: ['biew1'] },
  { name: 'bbs', props: 'border-block-start-width', keywords: ['border', 'block', 'start', 'logical'], examples: ['bbs1'] },
  { name: 'bbe', props: 'border-block-end-width', keywords: ['border', 'block', 'end', 'logical'], examples: ['bbe1'] },
  { name: 'bss', props: 'border-inline-start-style', keywords: ['border', 'inline', 'start', 'style', 'logical'], examples: ['bssS'] },
  { name: 'bse', props: 'border-inline-end-style', keywords: ['border', 'inline', 'end', 'style', 'logical'], examples: ['bseS'] },
  { name: 'bsbs', props: 'border-block-start-style', keywords: ['border', 'block', 'start', 'style', 'logical'], examples: ['bsbsS'] },
  { name: 'bsbe', props: 'border-block-end-style', keywords: ['border', 'block', 'end', 'style', 'logical'], examples: ['bsbeS'] },
  { name: 'bcs', props: 'border-inline-start-color', keywords: ['border', 'inline', 'start', 'color', 'logical'], examples: ['bcsF.1'] },
  { name: 'bce', props: 'border-inline-end-color', keywords: ['border', 'inline', 'end', 'color', 'logical'], examples: ['bceF.1'] },
  { name: 'bcbs', props: 'border-block-start-color', keywords: ['border', 'block', 'start', 'color', 'logical'], examples: ['bcbsF.1'] },
  { name: 'bcbe', props: 'border-block-end-color', keywords: ['border', 'block', 'end', 'color', 'logical'], examples: ['bcbeF.1'] },
  {
    name: 'r', props: 'border-radius', keywords: ['border', 'radius', 'circle'],
    description: 'без аргумента — полный круг (10000px)',
    examples: ['r', 'r1', 'r4', 'r8'],
  },
  { name: 'rss', props: 'border-start-start-radius', description: 'corner: block start, inline start', keywords: ['border', 'radius', 'corner', 'logical'], examples: ['rss4'] },
  { name: 'rse', props: 'border-start-end-radius', keywords: ['border', 'radius', 'corner', 'logical'], examples: ['rse4'] },
  { name: 'res', props: 'border-end-start-radius', keywords: ['border', 'radius', 'corner', 'logical'], examples: ['res4'] },
  { name: 'ree', props: 'border-end-end-radius', keywords: ['border', 'radius', 'corner', 'logical'], examples: ['ree4'] },
  { name: 'rs', props: 'border-start-start-radius, border-end-start-radius', description: 'both inline-start corners', keywords: ['border', 'radius', 'start', 'logical'], examples: ['rs8'] },
  { name: 're', props: 'border-start-end-radius, border-end-end-radius', description: 'both inline-end corners', keywords: ['border', 'radius', 'end', 'logical'], examples: ['re8'] },
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
  {
    name: 'ratio', props: 'padding-top (+ дочерний position:absolute)', keywords: ['aspect', 'ratio', 'соотношение сторон'],
    examples: ['ratio3x2'],
  },

  // --- Прокрутка (группа B, D-097) ---
  { name: 'sm', props: 'scroll-margin', keywords: ['scroll', 'margin', 'anchor'], examples: ['sm10', 'sm-8'] },
  { name: 'smt', props: 'scroll-margin-top', keywords: ['scroll', 'margin', 'top', 'anchor'], examples: ['smt80'] },
  { name: 'smb', props: 'scroll-margin-bottom', keywords: ['scroll', 'margin', 'bottom'], examples: ['smb8'] },
  { name: 'sml', props: 'scroll-margin-left', keywords: ['scroll', 'margin', 'left'], examples: ['sml8'] },
  { name: 'smr', props: 'scroll-margin-right', keywords: ['scroll', 'margin', 'right'], examples: ['smr8'] },
  { name: 'smx', props: 'scroll-margin-inline', keywords: ['scroll', 'margin', 'inline', 'axis'], examples: ['smx8'] },
  { name: 'smy', props: 'scroll-margin-block', keywords: ['scroll', 'margin', 'block', 'axis'], examples: ['smy8'] },
  { name: 'sms', props: 'scroll-margin-inline-start', keywords: ['scroll', 'margin', 'inline', 'start', 'logical'], examples: ['sms8'] },
  { name: 'sme', props: 'scroll-margin-inline-end', keywords: ['scroll', 'margin', 'inline', 'end', 'logical'], examples: ['sme8'] },
  { name: 'smbs', props: 'scroll-margin-block-start', keywords: ['scroll', 'margin', 'block', 'start', 'logical'], examples: ['smbs8'] },
  { name: 'smbe', props: 'scroll-margin-block-end', keywords: ['scroll', 'margin', 'block', 'end', 'logical'], examples: ['smbe8'] },
  { name: 'sp', props: 'scroll-padding', keywords: ['scroll', 'padding'], examples: ['sp16', 'spA', 'sp10%'] },
  { name: 'spt', props: 'scroll-padding-top', keywords: ['scroll', 'padding', 'top'], examples: ['spt64'] },
  { name: 'spb', props: 'scroll-padding-bottom', keywords: ['scroll', 'padding', 'bottom'], examples: ['spb8'] },
  { name: 'spl', props: 'scroll-padding-left', keywords: ['scroll', 'padding', 'left'], examples: ['spl8'] },
  { name: 'spr', props: 'scroll-padding-right', keywords: ['scroll', 'padding', 'right'], examples: ['spr8'] },
  { name: 'spx', props: 'scroll-padding-inline', keywords: ['scroll', 'padding', 'inline', 'axis'], examples: ['spx16'] },
  { name: 'spy', props: 'scroll-padding-block', keywords: ['scroll', 'padding', 'block', 'axis'], examples: ['spy16'] },
  { name: 'sps', props: 'scroll-padding-inline-start', keywords: ['scroll', 'padding', 'inline', 'start', 'logical'], examples: ['sps4'] },
  { name: 'spe', props: 'scroll-padding-inline-end', keywords: ['scroll', 'padding', 'inline', 'end', 'logical'], examples: ['spe4'] },
  { name: 'spbs', props: 'scroll-padding-block-start', keywords: ['scroll', 'padding', 'block', 'start', 'logical'], examples: ['spbs4'] },
  { name: 'spbe', props: 'scroll-padding-block-end', keywords: ['scroll', 'padding', 'block', 'end', 'logical'], examples: ['spbe4'] },
  { name: 'sst', props: 'scroll-snap-type', keywords: ['scroll', 'snap', 'carousel'], examples: ['sstX_M', 'sstY_P', 'sstN'] },
  { name: 'ssa', props: 'scroll-snap-align', keywords: ['scroll', 'snap', 'align'], examples: ['ssaS', 'ssaC', 'ssaC_S'] },
  { name: 'sss', props: 'scroll-snap-stop', keywords: ['scroll', 'snap', 'stop'], examples: ['sssA'] },
  { name: 'sbw', props: 'scrollbar-width', keywords: ['scrollbar', 'width', 'thin'], examples: ['sbwT', 'sbwN'] },
  { name: 'sbg', props: 'scrollbar-gutter', keywords: ['scrollbar', 'gutter', 'stable'], examples: ['sbgS', 'sbgSB'] },
  { name: 'sbc', props: 'scrollbar-color', keywords: ['scrollbar', 'color', 'thumb', 'track'], examples: ['sbcF00_0', 'sbcCT_T', 'sbcA'] },

  // --- Сетка и выравнивание (группа C, D-097) ---
  { name: 'grs', props: 'grid-row-start', keywords: ['grid', 'row', 'start', 'line'], examples: ['grs2', 'grsSpan_2'] },
  { name: 'gre', props: 'grid-row-end', keywords: ['grid', 'row', 'end', 'line'], examples: ['gre-1', 'greA'] },
  { name: 'gcs', props: 'grid-column-start', keywords: ['grid', 'column', 'start', 'line'], examples: ['gcs2', 'gcs2_Header'] },
  { name: 'gce', props: 'grid-column-end', keywords: ['grid', 'column', 'end', 'line'], examples: ['gce-1', 'gceSpan_2'] },
  { name: 'plc', props: 'place-content', keywords: ['place', 'content', 'align', 'justify', 'grid'], description: 'align-content_justify-content, буквы ac + jc', examples: ['plcC', 'plcSB_C'] },
  { name: 'pli', props: 'place-items', keywords: ['place', 'items', 'align', 'justify', 'grid', 'center'], description: 'align-items_justify-items, буквы ai + ji', examples: ['pliC', 'pliC_S'] },
  { name: 'pls', props: 'place-self', keywords: ['place', 'self', 'align', 'justify', 'grid'], description: 'align-self_justify-self, буквы as + js', examples: ['plsC', 'plsA_E'] },

  // --- Позиция и трансформация (группа D, D-097) ---
  { name: 'op', props: 'object-position', keywords: ['object', 'position', 'image'], description: 'буквы L/C/R/T/B, углы TL/TR/BL/BR, длины; x, затем y', examples: ['opL_T', 'opTL', 'op50%_0', 'opR_10_B_20'] },
  { name: 'tfo', props: 'transform-origin', keywords: ['transform', 'origin', 'rotate', 'scale'], description: 'как op, третья часть — z (длина)', examples: ['tfoTL', 'tfo50%_0', 'tfoC_C_10'] },
  { name: 'pspo', props: 'perspective-origin', keywords: ['perspective', 'origin', '3d'], description: 'как op', examples: ['pspoC', 'pspoL_B'] },
  { name: 'psp', props: 'perspective', keywords: ['perspective', '3d', 'transform'], examples: ['psp500', 'pspN'] },
  { name: 'tfb', props: 'transform-box', keywords: ['transform', 'box', 'svg'], examples: ['tfbFB', 'tfbBB'] },
  { name: 'bfv', props: 'backface-visibility', keywords: ['backface', 'visibility', '3d', 'flip'], examples: ['bfvH', 'bfvV'] },

  // --- Одиночные свойства (группа F, D-097) ---
  { name: 'acc', props: 'accent-color', keywords: ['accent', 'color', 'checkbox', 'form'], examples: ['accF00', 'accAuto'] },
  { name: 'cc', props: 'caret-color', keywords: ['caret', 'color', 'cursor', 'input'], examples: ['ccF00', 'ccAuto'] },
  { name: 'csch', props: 'color-scheme', keywords: ['color', 'scheme', 'dark', 'light', 'theme'], examples: ['cschL_D', 'cschD'] },
  { name: 'wc', props: 'will-change', keywords: ['will', 'change', 'performance'], examples: ['wcT', 'wcSP'] },
  { name: 'cpth', props: 'clip-path', keywords: ['clip', 'path', 'shape'], examples: ['cpthN', 'cpthBB', 'cpthCircle\\(50%\\)'] },
  { name: 'fca', props: 'forced-color-adjust', keywords: ['forced', 'color', 'contrast', 'a11y'], examples: ['fcaN', 'fcaA'] },
  { name: 'hy', props: 'hyphens', keywords: ['hyphens', 'text', 'wrap'], examples: ['hyA', 'hyM'] },
  { name: 'owr', props: 'overflow-wrap', keywords: ['overflow', 'wrap', 'break', 'text'], examples: ['owrA', 'owrBW'] },
  { name: 'tbs', props: 'tab-size', keywords: ['tab', 'size', 'code'], description: 'целое число пробелов без px или длина', examples: ['tbs4', 'tbs2em'] },
  { name: 'fvn', props: 'font-variant-numeric', keywords: ['font', 'numeric', 'tabular', 'nums'], description: 'пара — из разных групп', examples: ['fvnTN', 'fvnTN_SZ'] },
  { name: 'bdb', props: 'box-decoration-break', keywords: ['box', 'decoration', 'break', 'inline'], description: 'с -webkit- для Safari', examples: ['bdbC', 'bdbS'] },
  { name: 'lcl', props: 'display, -webkit-line-clamp', keywords: ['line', 'clamp', 'truncate', 'ellipsis'], description: 'обрезка по числу строк; N снимает', examples: ['lcl3', 'lclN'] },
  { name: 'fsz', props: 'field-sizing', keywords: ['field', 'sizing', 'input', 'textarea'], examples: ['fszC', 'fszF'] },
  { name: 'tnb', props: 'transition-behavior', keywords: ['transition', 'discrete'], examples: ['tnbAD', 'tnbN'] },
  { name: 'atf', props: 'animation-timing-function', keywords: ['animation', 'timing', 'easing'], examples: ['atfL', 'atfEIO'] },
  { name: 'bgbm', props: 'background-blend-mode', keywords: ['background', 'blend', 'mode'], examples: ['bgbmM', 'bgbmS'] },

  // --- Маски, семейство mk… (E2, D-097) ---
  { name: 'mk', props: 'mask-image', keywords: ['mask', 'gradient', 'fade'], description: 'градиент, как у bg', examples: ['mkF00-00F'] },
  { name: 'mki', props: 'mask-image', keywords: ['mask', 'image', 'url'], examples: ['mki--v', 'mkiN'] },
  { name: 'mks', props: 'mask-size', keywords: ['mask', 'size', 'cover', 'contain'], examples: ['mksCV', 'mks50%_auto', 'mks10'] },
  { name: 'mkp', props: 'mask-position', keywords: ['mask', 'position'], examples: ['mkpC', 'mkpR_10_B_20'] },
  { name: 'mkr', props: 'mask-repeat', keywords: ['mask', 'repeat'], examples: ['mkrN', 'mkrX'] },
  { name: 'mko', props: 'mask-origin', keywords: ['mask', 'origin', 'box'], examples: ['mkoCB', 'mkoBB'] },
  { name: 'mkcp', props: 'mask-clip', keywords: ['mask', 'clip', 'box'], examples: ['mkcpPB', 'mkcpNC'] },
  { name: 'mkc', props: 'mask-composite', keywords: ['mask', 'composite'], examples: ['mkcI', 'mkcS'] },
  { name: 'mkt', props: 'mask-type', keywords: ['mask', 'type', 'svg'], examples: ['mktA', 'mktL'] },
  { name: 'mkm', props: 'mask-mode', keywords: ['mask', 'mode'], examples: ['mkmMS', 'mkmA'] },

  // --- Границы (доп.) — портировано из старого 1.x essences.js, проверено live-компиляцией ---
  { name: 'bi', props: 'border-image-source', keywords: ['border', 'image', 'gradient'], description: 'картинка рамки, как у bg: градиент, Url\\(…\\), переменная, N; рамке градиентом нужен bis1 (D-119)', examples: ['bi8D5524-6D3504 bis1 b6 bsS', 'biUrl\\(a\\.png\\)', 'biN'] },
  { name: 'bis', props: 'border-image-slice', keywords: ['border', 'image', 'slice', 'fill'], description: 'числа без единицы или %, до четырёх; F — fill', examples: ['bis1', 'bis30_F', 'bis10_20'] },
  { name: 'biw', props: 'border-image-width', keywords: ['border', 'image', 'width'], description: 'толщина кольца картинки; A — auto', examples: ['biw10', 'biwA'] },
  { name: 'bio', props: 'border-image-outset', keywords: ['border', 'image', 'outset'], examples: ['bio5', 'bio1_2'] },
  { name: 'bir', props: 'border-image-repeat', keywords: ['border', 'image', 'repeat', 'round'], description: 'ST stretch, R repeat, RD round, SP space', examples: ['birRD', 'birR_ST'] },
  { name: 'bdcl', props: 'border-collapse', keywords: ['border', 'collapse', 'table'], examples: ['bdclC', 'bdclS'] },
  { name: 'bsp', props: 'border-spacing', keywords: ['border', 'spacing', 'table'], description: '_ = пробел между двумя значениями', examples: ['bsp0', 'bsp5px_1rem'] },

  // --- Размеры (доп.) ---
  { name: 'sqmin', props: 'min-width, min-height', description: 'min-square', keywords: ['square', 'min'], examples: ['sqmin10'] },
  { name: 'sqmax', props: 'max-width, max-height', description: 'max-square', keywords: ['square', 'max'], examples: ['sqmax10'] },
  { name: 'hmin', props: 'min-height', examples: ['hmin10'] },
  { name: 'hmax', props: 'max-height', examples: ['hmax10'] },

  // --- Таблицы ---
  { name: 'tbl', props: 'display', description: 'display:table — центрирование дочернего элемента до появления flex', keywords: ['table', 'display'], examples: ['tbl'] },
  { name: 'cps', props: 'caption-side', keywords: ['caption', 'table'], examples: ['cpsTop', 'cpsB'] },
  { name: 'ec', props: 'empty-cells', keywords: ['table'], examples: ['ecShow', 'ecH'] },

  // --- Float / clear ---
  { name: 'cl', props: 'clear', examples: ['cl', 'clLeft'] },
  { name: 'cfx', props: 'clear', description: 'clearfix: :before/:after{content, clear:both, display:table}', keywords: ['clearfix'], examples: ['cfx'] },
  { name: 'fl', props: 'float', examples: ['flL', 'flR', 'flN'] },

  // --- Переходы (доп.) ---
  { name: 'delay', props: 'transition-delay', keywords: ['transition', 'delay'], examples: ['delay150'] },
  { name: 'tn', props: 'transition', keywords: ['transition'], description: '_ = пробел между значениями', examples: ['tnA_1s_E_0s', 'tnN'] },
  { name: 'an', props: 'animation, @keyframes', keywords: ['animation', 'keyframes', 'spin', 'ping', 'pulse', 'bounce'], description: 'Spin/Ping/Pulse/Bounce — с кадрами при использовании; _ = пробел между значениями', examples: ['anSpin', 'anPulse', 'an_spin_2s', 'an_fade_1s_EO', 'anN'] },
  { name: 'tp', props: 'transition-property', keywords: ['transition'], examples: ['tpA', 'tp_color,opacity'] },
  { name: 'ttf', props: 'transition-timing-function', keywords: ['transition'], examples: ['ttfEI'] },

  // --- SVG / outline / доп. цвет ---
  { name: 'stroke', props: 'stroke', keywords: ['svg', 'color'], examples: ['strokeF', 'stroke0'] },
  { name: 'fill', props: 'fill', keywords: ['svg', 'color'], examples: ['fillF'] },
  { name: 'sw', props: 'stroke-width', keywords: ['svg'], examples: ['sw2'] },
  { name: 'olc', props: 'outline-color', keywords: ['outline', 'color'], examples: ['olcF'] },
  { name: 'olw', props: 'outline-width', keywords: ['outline'], examples: ['olw2'] },
  { name: 'ol', props: 'outline', keywords: ['outline'], description: 'shorthand', examples: ['olSolid', 'olDashed_red'] },
  { name: 'ols', props: 'outline-style', keywords: ['outline', 'style'], examples: ['olsSolid'] },
  { name: 'olo', props: 'outline-offset', keywords: ['outline', 'offset'], examples: ['olo10'] },
  { name: 'temc', props: 'text-emphasis-color', keywords: ['text', 'emphasis', 'color'], examples: ['temcF'] },
  { name: 'tdc', props: 'text-decoration-color', keywords: ['text', 'decoration', 'color'], examples: ['tdcF'] },

  // --- Фон (доп.) ---
  { name: 'bgi', props: 'background-image', keywords: ['background', 'image'], description: 'без аргумента — none; url — camelCase/snakeCase путь', examples: ['bgi'] },
  { name: 'bgp', props: 'background-position', keywords: ['background', 'position'], examples: ['bgpTop'] },
  { name: 'bgpx', props: 'background-position-x', keywords: ['background', 'position'], examples: ['bgpxRight_32px'] },
  { name: 'bgpy', props: 'background-position-y', keywords: ['background', 'position'], examples: ['bgpyBottom_32px'] },
  { name: 'bgs', props: 'background-size', keywords: ['background', 'size'], examples: ['bgsCV', 'bgs10_20'] },
  { name: 'bga', props: 'background-attachment', keywords: ['background'], examples: ['bgaFixed'] },
  { name: 'bgbk', props: 'background-break', keywords: ['background'], examples: ['bgbkBB'] },
  { name: 'bgcp', props: 'background-clip', keywords: ['background', 'clip'], examples: ['bgcpBorderBox'] },
  { name: 'bgr', props: 'background-repeat', keywords: ['background', 'repeat'], examples: ['bgrNoRepeat'] },
  { name: 'bgo', props: 'background-origin', keywords: ['background', 'origin'], examples: ['bgoBorderBox'] },

  // --- text-align (доп.) ---
  { name: 'tj', props: 'text-align', description: 'text-justify', examples: ['tj'] },

  // --- Позиционирование (доп.) ---
  { name: 'pos', props: 'position', description: 'без аргумента — relative; A/R/F/S — синонимы значений', examples: ['pos', 'posA'] },
  { name: 'static', props: 'position', examples: ['static'] },

  // --- Transform (доп.) ---
  { name: 'spnr', props: 'transform, animation', description: 'бесконечный спиннер (rotate keyframes)', keywords: ['spinner', 'rotate', 'animation'], examples: ['spnr1000'] },
  { name: 'rx', props: 'transform', description: 'rotateX', examples: ['rx90'] },
  { name: 'ry', props: 'transform', description: 'rotateY', examples: ['ry90'] },
  { name: 'rz', props: 'transform', description: 'rotateZ', examples: ['rz90'] },

  // --- Прочее ---
  { name: 'o', props: 'opacity', description: 'значение 0-100 → 0-1', examples: ['o100'] },
  { name: 'tsa', props: 'text-size-adjust', examples: ['tsa0'] },
  { name: 'ap', props: 'appearance', examples: ['apN'] },
  { name: 'ovx', props: 'overflow-x', examples: ['ovxHidden'] },
  { name: 'ovs', props: 'overflow-style', examples: ['ovsAuto'] },
  { name: 'ovsc', props: '-webkit-overflow-scrolling', examples: ['ovscTouch'] },
  { name: 'cp', props: 'clip', examples: ['cpAuto'] },
  { name: 'rsz', props: 'resize', examples: ['rszBoth'] },

  // --- Grid ---
  { name: 'g', props: 'grid', examples: ['gN'] },
  { name: 'gt', props: 'grid-template', examples: ['gt100px_1fr'] },
  { name: 'gtc', props: 'grid-template-columns', examples: ['gtc100px_1fr'] },
  { name: 'gtr', props: 'grid-template-rows', examples: ['gtr100px_1fr'] },
  { name: 'gac', props: 'grid-auto-columns', examples: ['gacAuto'] },
  { name: 'gar', props: 'grid-auto-rows', examples: ['garAuto'] },
  { name: 'gaf', props: 'grid-auto-flow', examples: ['gafRow_dense'] },
  { name: 'gg', props: 'grid-gap', examples: ['gg10px_20px'] },
  { name: 'ggc', props: 'grid-column-gap', examples: ['ggc1em'] },
  { name: 'ggr', props: 'grid-row-gap', examples: ['ggr1em'] },
  { name: 'gc', props: 'grid-column', description: 'простое значение; диапазоны с "/" не поддержаны сканером-эскейпингом', examples: ['gc1'] },
  { name: 'gr', props: 'grid-row', description: 'простое значение; диапазоны с "/" не поддержаны сканером-эскейпингом', examples: ['gr1'] },

  // --- Flex (доп.) ---
  { name: 'fxb', props: 'flex-basis', examples: ['fxb100px'] },
  { name: 'fxf', props: 'flex-flow', examples: ['fxfRow_wrap'] },
  { name: 'or', props: 'order', keywords: ['flex', 'order'], examples: ['or1'] },

  // --- Текст (доп.) ---
  { name: 'tw', props: 'text-wrap', examples: ['twNormal'] },
  { name: 'td', props: 'text-decoration', examples: ['tdUnderline'] },
  { name: 'tdl', props: 'text-decoration-line', examples: ['tdlUnderline'] },
  { name: 'tds', props: 'text-decoration-skip', examples: ['tdsInk'] },
  { name: 'tdsi', props: 'text-decoration-skip-ink', examples: ['tdsiA'] },
  { name: 'tdt', props: 'text-decoration-thickness', examples: ['tdt3px'] },
  { name: 'ti', props: 'text-indent', examples: ['ti40px'] },
  { name: 'tov', props: 'text-overflow', examples: ['tovEllipsis'] },
  { name: 'ws', props: 'white-space', examples: ['wsNowrap'] },
  { name: 'wsc', props: 'white-space-collapse', examples: ['wscNormal'] },
  { name: 'wb', props: 'word-break', examples: ['wbBreakAll'] },
  { name: 'wos', props: 'word-spacing', examples: ['wos1rem'] },
  { name: 'q', props: 'quotes', examples: ['qNone'] },
  { name: 'va', props: 'vertical-align', keywords: ['vertical', 'align'], examples: ['vaBaseline'] },
  { name: 'pe', props: 'pointer-events', examples: ['peN'] },
  { name: 'wm', props: 'writing-mode', keywords: ['writing', 'mode'], examples: ['wm'] },
  { name: 'v', props: 'visibility', examples: ['vHidden'] },
  { name: 'ts', props: 'transform-style', keywords: ['transform', 'style'], examples: ['tsFlat'] },
  { name: 'mbm', props: 'mix-blend-mode', keywords: ['mix', 'blend', 'mode'], examples: ['mbmM'] },

  // --- Шрифт ---
  { name: 'font', props: 'font', description: 'shorthand', examples: ['fontCaption'] },
  { name: 'ff', props: 'font-family', keywords: ['font', 'family'], examples: ['ffSerif'] },
  { name: 'fs', props: 'font-style', keywords: ['font', 'style'], examples: ['fsItalic'] },
  { name: 'fv', props: 'font-variant', keywords: ['font', 'variant'], examples: ['fvSmallCaps'] },
  { name: 'fef', props: 'font-effect', description: 'нестандартное CSS-свойство (старый vendor draft)', keywords: ['font', 'effect'], examples: ['fefEngrave'] },
  { name: 'fsm', props: 'font-smooth', keywords: ['font', 'smooth'], examples: ['fsmAuto'] },
  { name: 'fst', props: 'font-stretch', keywords: ['font', 'stretch'], examples: ['fstCondensed'] },
  { name: 'tal', props: 'text-align-last', keywords: ['text', 'align'], examples: ['talCenter'] },

  // --- Контент / списки ---
  { name: 'cnt', props: 'content', examples: ['cntNormal'] },
  { name: 'lis', props: 'list-style', keywords: ['list', 'style'], examples: ['lisSquare'] },
  { name: 'lisp', props: 'list-style-position', keywords: ['list', 'style', 'position'], examples: ['lispInside'] },
  { name: 'list', props: 'list-style-type', keywords: ['list', 'style', 'type'], examples: ['listCircle'] },
  { name: 'lisi', props: 'list-style-image', description: 'без аргумента — none', keywords: ['list', 'style', 'image'], examples: ['lisi'] },

  // --- Page-break ---
  { name: 'pgbb', props: 'page-break-before, break-before', keywords: ['page', 'break'], examples: ['pgbbAlways'] },
  { name: 'pgba', props: 'page-break-after, break-after', keywords: ['page', 'break'], examples: ['pgbaAlways'] },
  { name: 'pgbi', props: 'page-break-inside, break-inside', keywords: ['page', 'break'], examples: ['pgbiAvoid'] },
];
