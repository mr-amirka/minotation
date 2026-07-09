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
});
