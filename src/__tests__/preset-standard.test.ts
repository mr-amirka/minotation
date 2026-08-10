// @ts-nocheck
/* eslint-disable */
/**
 * Тесты стандартного пресета Minotation.
 *
 * Проверяет ключевые хендлеры: размеры, отступы, цвета, позиционирование.
 */

const mnProvider = require('../index').default || require('../index').minotationProvider;
const presetStandard = require('../presets/standard').default || require('../presets/standard');

function css(token) {
  const mn = mnProvider({
    presets: [presetStandard],
    onError: (e) => { /* подавляем ошибки парсинга */ },
  });
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue()
    .map((s) => s.content)
    .join('');
}

// ================================================================
// Width / Height
// ================================================================
describe('Standard preset — размеры', () => {
  test('w50 → width:50px', () => {
    expect(css('w50')).toContain('width:50px');
  });

  test('w → width:100%', () => {
    expect(css('w')).toContain('width:100%');
  });

  test('w50% → width:50%', () => {
    expect(css('w50%')).toContain('width:50%');
  });

  test('w100vh → width:100vh', () => {
    expect(css('w100vh')).toContain('width:100vh');
  });

  test('h50 → height:50px', () => {
    expect(css('h50')).toContain('height:50px');
  });

  test('h → height:100%', () => {
    expect(css('h')).toContain('height:100%');
  });

  test('sq50 → width:50px;height:50px', () => {
    const result = css('sq50');
    expect(result).toContain('width:50px');
    expect(result).toContain('height:50px');
  });
});

// ================================================================
// Margin / Padding
// ================================================================
describe('Standard preset — отступы', () => {
  test('p20 → padding:20px', () => {
    expect(css('p20')).toContain('padding:20px');
  });

  test('m10 → margin:10px', () => {
    expect(css('m10')).toContain('margin:10px');
  });

  test('pt5 → padding-top:5px', () => {
    expect(css('pt5')).toContain('padding-top:5px');
  });

  test('mxA → margin-left:auto;margin-right:auto', () => {
    const result = css('mxA');
    expect(result).toContain('margin-left:auto');
    expect(result).toContain('margin-right:auto');
  });

  test('gap10 → gap:10px (регресс: priority не была объявлена в хендлере)', () => {
    expect(css('gap10')).toContain('gap:10px');
  });
});

// ================================================================
// Цвета
// ================================================================
describe('Standard preset — цвета', () => {
  test('cF00 → color:#f00', () => {
    expect(css('cF00')).toContain('color:#f00');
  });

  test('cRed → color:red', () => {
    expect(css('cRed')).toContain('color:red');
  });

  test('bgF00 → background:#f00', () => {
    expect(css('bgF00')).toContain('background:#f00');
  });

  test('bgTransparent → background:transparent (регресс: colorGetBackground падал на именованных синонимах)', () => {
    expect(css('bgTransparent')).toContain('background:transparent');
  });

  test('bgCT → background:currentColor', () => {
    expect(css('bgCT')).toContain('background:currentColor');
  });
});

// ================================================================
// Filter
// ================================================================
describe('Standard preset — filter', () => {
  test('ftBlur5 → filter:blur(5px) (регресс: filter() без 2-го аргумента падал в fundamentool)', () => {
    expect(css('ftBlur5')).toContain('filter:blur(5px)');
  });

  test('ftbBlur5 → backdrop-filter:blur(5px)', () => {
    expect(css('ftbBlur5')).toContain('backdrop-filter:blur(5px)');
  });

  test('ftBlur5_gray50 → комбинация фильтров', () => {
    const result = css('ftBlur5_gray50');
    expect(result).toContain('blur(5px)');
    expect(result).toContain('grayscale(50%)');
  });

  test('ft_blur5 (альтернативный синтаксис с подчёркиванием) → тот же результат', () => {
    expect(css('ft_blur5')).toContain('filter:blur(5px)');
  });
});

// ================================================================
// Позиционирование
// ================================================================
describe('Standard preset — позиционирование', () => {
  test('posA → position:absolute', () => {
    expect(css('posA')).toContain('position:absolute');
  });

  test('posR → position:relative', () => {
    expect(css('posR')).toContain('position:relative');
  });

  test('posF → position:fixed', () => {
    expect(css('posF')).toContain('position:fixed');
  });

  test('static → position:static', () => {
    expect(css('static')).toContain('position:static');
  });

  test('sticky → position:sticky', () => {
    expect(css('sticky')).toContain('position:sticky');
  });

  test('dirRTL → direction:rtl', () => {
    expect(css('dirRTL')).toContain('direction:rtl');
  });
});

// ================================================================
// Display
// ================================================================
describe('Standard preset — display', () => {
  test('dN → display:none', () => {
    expect(css('dN')).toContain('display:none');
  });

  test('dB → display:block', () => {
    expect(css('dB')).toContain('display:block');
  });

  test('dF → display:flex', () => {
    expect(css('dF')).toContain('display:flex');
  });
});

// ================================================================
// Overflow
// ================================================================
describe('Standard preset — overflow', () => {
  test('ovH → overflow:hidden', () => {
    expect(css('ovH')).toContain('overflow:hidden');
  });

  test('ovA → overflow:auto', () => {
    expect(css('ovA')).toContain('overflow:auto');
  });

  test('ovbCT → overscroll-behavior:contain', () => {
    expect(css('ovbCT')).toContain('overscroll-behavior:contain');
  });

  test('ovbxN → overscroll-behavior-x:none', () => {
    expect(css('ovbxN')).toContain('overscroll-behavior-x:none');
  });
});

// ================================================================
// Font
// ================================================================
describe('Standard preset — шрифт', () => {
  test('fwB → font-weight:bold', () => {
    expect(css('fwB')).toContain('font-weight:bold');
  });

  test('taC → text-align:center', () => {
    expect(css('taC')).toContain('text-align:center');
  });

  test('fsaN → font-size-adjust:none', () => {
    expect(css('fsaN')).toContain('font-size-adjust:none');
  });
});

// ================================================================
// Text emphasis
// ================================================================
describe('Standard preset — text-emphasis', () => {
  test('tem_filled_circle → text-emphasis:filled circle', () => {
    expect(css('tem_filled_circle')).toContain('text-emphasis:filled circle');
  });

  test('tempOver → text-emphasis-position:over', () => {
    expect(css('tempOver')).toContain('text-emphasis-position:over');
  });

  test('temsCircle → text-emphasis-style:circle', () => {
    expect(css('temsCircle')).toContain('text-emphasis-style:circle');
  });
});

// ================================================================
// Object / Mask
// ================================================================
describe('Standard preset — object-fit / mask', () => {
  test('ofCV → object-fit:cover', () => {
    expect(css('ofCV')).toContain('object-fit:cover');
  });

  test('maski_a\\.png → mask-image:url("a.png") (точка в значении требует экранирования)', () => {
    expect(css('maski_a\\.png')).toContain('mask-image:url("a.png")');
  });

  test('maskbgF00 → mask-image:#f00', () => {
    expect(css('maskbgF00')).toContain('mask-image:#f00');
  });

  test('masktL → mask-type:luminance', () => {
    expect(css('masktL')).toContain('mask-type:luminance');
  });

  test('maskmMS → mask-mode:match-source', () => {
    expect(css('maskmMS')).toContain('mask-mode:match-source');
  });
});

// ================================================================
// Touch / Outline / Слои
// ================================================================
describe('Standard preset — touch-action, outline, zoom', () => {
  test('tchaN → touch-action:none', () => {
    expect(css('tchaN')).toContain('touch-action:none');
  });

  test('olcI → outline-color:invert', () => {
    expect(css('olcI')).toContain('outline-color:invert');
  });

  test('olwTN/olwM/olwTC → outline-width: thin/medium/thick', () => {
    expect(css('olwTN')).toContain('outline-width:thin');
    expect(css('olwM')).toContain('outline-width:medium');
    expect(css('olwTC')).toContain('outline-width:thick');
  });

  test('zm150% → zoom:150%', () => {
    expect(css('zm150%')).toContain('zoom:150%');
  });
});

// ================================================================
// Aspect ratio / Image rendering
// ================================================================
describe('Standard preset — aspect-ratio, image-rendering', () => {
  test('ar16/9 → aspect-ratio:16/9', () => {
    expect(css('ar16/9')).toContain('aspect-ratio:16/9');
  });

  test('irPixelated → image-rendering:pixelated', () => {
    expect(css('irPixelated')).toContain('image-rendering:pixelated');
  });
});

// ================================================================
// Многоколоночная вёрстка / Counters
// ================================================================
describe('Standard preset — columns, counters', () => {
  test('col3 → columns:3', () => {
    expect(css('col3')).toContain('columns:3');
  });

  test('wid2 → widows:2', () => {
    expect(css('wid2')).toContain('widows:2');
  });

  test('orp2 → orphans:2', () => {
    expect(css('orp2')).toContain('orphans:2');
  });

  test('coi_counter → counter-increment:counter', () => {
    expect(css('coi_counter')).toContain('counter-increment:counter');
  });

  test('cor_counter → counter-reset:counter', () => {
    expect(css('cor_counter')).toContain('counter-reset:counter');
  });
});
