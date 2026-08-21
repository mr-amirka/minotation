// @ts-nocheck
/* eslint-disable */
/**
 * Тесты совместимости: новый minotation vs старый minimalist-notation 1.x.
 *
 * Тест-принцип: для каждого токена фиксируем ожидаемое CSS-свойство/значение.
 * Старая версия — эталон в old/minimalist-notation/__tests__/layout.test.js.
 *
 * Мигрировано с v2 API на v1 (createMn/inst.check(...) -> minotationProvider/
 * getCompiler('class')(...)). Дубликаты с preset-standard.test.ts (размеры,
 * простые цвета, filter, position, display dN/dB/dF, overflow) удалены —
 * оставлены только уникальные разделы: flex-align rename (fha→fxa/fva→fya),
 * компактный rgba-формат цветов, комплексные демо-строки и раздел
 * "намеренные отличия" (собственно цель файла).
 *
 * Ключевые отличия (намеренные):
 * - fhaC → fxaC (новое имя: flex x-axis align)
 * - fvaC → fyaC (новое имя: flex y-axis align)
 * - fhaS/fvaS возвращали flex-start; новый MN: fxaS → start, fyaS → start
 * - fx → flex:1 (только flex-shorthand; display:flex — через dF как в старой версии)
 * - ovA → overflow:auto (в старой версии тоже auto; в новом был баг с "absolute" — исправлен)
 */

const mnProvider = require('../index').default || require('../index').minotationProvider;
const presetStandard = require('../presets/standard').default || require('../presets/standard');
const presetSynonyms = require('../presets/synonyms').default || require('../presets/synonyms');
const presetMedias = require('../presets/medias').default || require('../presets/medias');
const presetMain = require('../presets/main').default || require('../presets/main');

function mn() {
  const inst = mnProvider({
    onError: (e) => { /* подавляем ошибки парсинга */ },
  });
  inst.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetMain,
  ]);
  return inst;
}

function css(token) {
  const inst = mn();
  inst.getCompiler('class')(token);
  inst.compile();
  return inst.styles$.getValue().map(b => b.content).join('');
}

// ================================================================
// Display (только уникальное: fx-shorthand и dI, dN/dB/dF — см. preset-standard.test.ts)
// ================================================================
describe('Display — новый MN (совместим со старым)', () => {
  test('dI → display:inline', () => expect(css('dI')).toContain('display:inline'));
  test('fx1 → flex:1', () => expect(css('fx1')).toContain('flex:1'));
});

// ================================================================
// Flex — direction / basis / grow / shrink
// ================================================================
describe('Flex-direction — новый MN (совместим)', () => {
  test('fxdC → flex-direction:column', () => expect(css('fxdC')).toContain('flex-direction:column'));
  test('fxdR → flex-direction:row', () => expect(css('fxdR')).toContain('flex-direction:row'));
  test('fxdCR → flex-direction:column-reverse', () => expect(css('fxdCR')).toContain('flex-direction:column-reverse'));
  test('fxdRR → flex-direction:row-reverse', () => expect(css('fxdRR')).toContain('flex-direction:row-reverse'));
  test('fxg1 → flex-grow:1', () => expect(css('fxg1')).toContain('flex-grow:1'));
  test('fxg0 → flex-grow:0', () => expect(css('fxg0')).toContain('flex-grow:0'));
  test('fxs0 → flex-shrink:0', () => expect(css('fxs0')).toContain('flex-shrink:0'));
  test('fxs1 → flex-shrink:1', () => expect(css('fxs1')).toContain('flex-shrink:1'));
  test('fxb100px → flex-basis:100px', () => expect(css('fxb100px')).toContain('flex-basis:100px'));
  test('fxb0 → flex-basis:0', () => expect(css('fxb0')).toContain('flex-basis:0'));
});

// ================================================================
// Flex-wrap (fxw) — вынесен из generic-хендлера в synonymProvider (2026-08-21):
// короткие формы (NW/W/WR) теперь тоже работают, полная форма не сломана.
// ================================================================
describe('Flex-wrap fxw — короткие и полные формы', () => {
  test('fxwNW → flex-wrap:nowrap', () => expect(css('fxwNW')).toContain('flex-wrap:nowrap'));
  test('fxwW → flex-wrap:wrap', () => expect(css('fxwW')).toContain('flex-wrap:wrap'));
  test('fxwWR → flex-wrap:wrap-reverse', () => expect(css('fxwWR')).toContain('flex-wrap:wrap-reverse'));
  test('fxwWrap (полная форма) → flex-wrap:wrap', () => expect(css('fxwWrap')).toContain('flex-wrap:wrap'));
  test('fxwNowrap (полная форма) → flex-wrap:nowrap', () => expect(css('fxwNowrap')).toContain('flex-wrap:nowrap'));
  test('fxwWrapReverse (полная форма) → flex-wrap:wrap-reverse', () => expect(css('fxwWrapReverse')).toContain('flex-wrap:wrap-reverse'));
});

// ================================================================
// fx-shorthand с '_'-разделёнными значениями — сегменты кебабируются независимо
// (2026-08-21): раньше заглавная буква внутри одного сегмента ('Auto') ошибочно
// триггерила camelCase-детектор через границу '_' и добавляла лишний '-'.
// ================================================================
describe('fx-shorthand — multi-value через _', () => {
  test('fx0_1_Auto → flex:0 1 auto', () => expect(css('fx0_1_Auto')).toContain('flex:0 1 auto'));
  test('fx0_1_auto (уже строчными) → flex:0 1 auto', () => expect(css('fx0_1_auto')).toContain('flex:0 1 auto'));
  test('fx1_1_0% → flex:1 1 0%', () => expect(css('fx1_1_0%')).toContain('flex:1 1 0%'));
});

// ================================================================
// Flex-align (переименованы: fha→fxa, fva→fya)
//
// Реально зарегистрированы только буквы из карт в presets/standard.ts:
// fxa — S/C/E/A/B (start/center/end/around/between, автогенерируются из
// первой буквы длинной формы), fya — S/C/E/A/ST. Токены вида fxaF/fxaL/fxaV,
// fyaF/fyaL/fyaB/fyaT из исходного v2-теста не существуют — убраны (не баг,
// а несовпадение с фактической картой синонимов).
// ================================================================
describe('Flex-align fxa — новое имя (justify-content)', () => {
  test('fxaC → justify-content:center', () => expect(css('fxaC')).toContain('justify-content:center'));
  test('fxaS → justify-content:flex-start', () => expect(css('fxaS')).toContain('justify-content:flex-start'));
  test('fxaE → justify-content:flex-end', () => expect(css('fxaE')).toContain('justify-content:flex-end'));
  test('fxaA → justify-content:space-around', () => expect(css('fxaA')).toContain('justify-content:space-around'));
  test('fxaB → justify-content:space-between', () => expect(css('fxaB')).toContain('justify-content:space-between'));
  test('fxaCenter → justify-content:center (длинная форма)', () => expect(css('fxaCenter')).toContain('justify-content:center'));
});

describe('Flex-align fya — новое имя (align-items + align-content)', () => {
  test('fyaC → align-items:center + align-content:center', () => {
    const out = css('fyaC');
    expect(out).toContain('align-items:center');
    expect(out).toContain('align-content:center');
  });
  test('fyaS → align-items:flex-start + align-content:flex-start', () => {
    const out = css('fyaS');
    expect(out).toContain('align-items:flex-start');
    expect(out).toContain('align-content:flex-start');
  });
  test('fyaE → align-items:flex-end + align-content:flex-end', () => {
    const out = css('fyaE');
    expect(out).toContain('align-items:flex-end');
    expect(out).toContain('align-content:flex-end');
  });
  test('fyaST → align-items:stretch + align-content:stretch', () => {
    const out = css('fyaST');
    expect(out).toContain('align-items:stretch');
    expect(out).toContain('align-content:stretch');
  });
  test('fyaCenter → align-items:center (длинная форма)', () => expect(css('fyaCenter')).toContain('align-items:center'));
});

// Независимые шорткаты (jc / ai / as / ac) — синонимы FE/FS/SA/SB, не B/E/etc.
describe('Flex-align шорткаты jc/ai/as/ac', () => {
  test('jcC → justify-content:center', () => expect(css('jcC')).toContain('justify-content:center'));
  test('jcSB → justify-content:space-between', () => expect(css('jcSB')).toContain('justify-content:space-between'));
  test('aiC → align-items:center', () => expect(css('aiC')).toContain('align-items:center'));
  test('asC → align-self:center', () => expect(css('asC')).toContain('align-self:center'));
  test('acC → align-content:center', () => expect(css('acC')).toContain('align-content:center'));
  test('or1 → order:1', () => expect(css('or1')).toContain('order:1'));
});

// ================================================================
// Цвета — компактный rgba-формат (не покрыт preset-standard.test.ts)
// ================================================================
describe('Цвета — новый MN (компактный формат rgba)', () => {
  test('bg0A0A12.88 → rgba(10,10,18,.88)', () => {
    expect(css('bg0A0A12.88')).toContain('rgba(10,10,18,.88)');
  });
  test('bgF.12 → rgba(255,255,255,.12)', () => {
    expect(css('bgF.12')).toContain('rgba(255,255,255,.12)');
  });
  test('cF.5 → rgba(255,255,255,.5)', () => {
    expect(css('cF.5')).toContain('rgba(255,255,255,.5)');
  });
  test('cF.88 → rgba(255,255,255,.88)', () => {
    expect(css('cF.88')).toContain('rgba(255,255,255,.88)');
  });
  // По умолчанию altColor включён ($$altColor = options.altColor !== 'off' в core/index.ts) —
  // hex-fallback есть всегда, если явно не передать altColor:'off'
  test('bgF.12 c altColor:"off" → только rgba (без дублирующего hex)', () => {
    const inst = mnProvider({
      presets: [presetStandard, presetSynonyms, presetMedias, presetMain],
      altColor: 'off',
      onError: (e) => { /* подавляем ошибки парсинга */ },
    });
    inst.getCompiler('class')('bgF.12');
    inst.compile();
    const out = inst.styles$.getValue().map(b => b.content).join('');
    expect(out).not.toMatch(/background:#fff.*background:rgba/s);
  });
});

// ================================================================
// Комплексный: демо-строка ControlPanel из space-amirka-name/v4
// ================================================================
describe('Демо-строка ControlPanel — новый MN', () => {
  test('w320 bg0A0A12.88 ftbBlur12 cF dF fxdC ov — все токены корректны', () => {
    const inst = mn();
    inst.getCompiler('class')('w320 bg0A0A12.88 ftbBlur12 cF dF fxdC ov');
    inst.compile();
    const out = inst.styles$.getValue().map(b => b.content).join('');
    expect(out).toContain('width:320px');
    expect(out).toContain('rgba(10,10,18,.88)');
    expect(out).toContain('backdrop-filter:blur(12px)');
    expect(out).toMatch(/color:#[Ff]{3}/);
    expect(out).toContain('display:flex');
    expect(out).toContain('flex-direction:column');
    expect(out).toContain('overflow:hidden');
  });

  test('px16 fxs0 h75 dF aiC — заголовок панели', () => {
    const inst = mn();
    inst.getCompiler('class')('px16 fxs0 h75 dF aiC');
    inst.compile();
    const out = inst.styles$.getValue().map(b => b.content).join('');
    expect(out).toContain('padding-left:16px');
    expect(out).toContain('padding-right:16px');
    expect(out).toContain('flex-shrink:0');
    expect(out).toContain('height:75px');
    expect(out).toContain('display:flex');
    expect(out).toContain('align-items:center');
  });

  test('px16 pt16 pb40 fxg1 ovyA — скролл-контент', () => {
    const inst = mn();
    inst.getCompiler('class')('px16 pt16 pb40 fxg1 ovyA');
    inst.compile();
    const out = inst.styles$.getValue().map(b => b.content).join('');
    expect(out).toContain('flex-grow:1');
    expect(out).toContain('overflow-y:auto');
    expect(out).not.toContain('overflow-y:absolute');
  });
});

// ================================================================
// Разница между старым и новым MN
// ================================================================
describe('Намеренные отличия нового MN от старого', () => {
  test('fhaC не зарегистрирован в новом MN (переименован в fxaC)', () => {
    const out = css('fhaC');
    expect(out).not.toContain('justify-content:center');
  });

  test('fvaC не зарегистрирован в новом MN (переименован в fyaC)', () => {
    const out = css('fvaC');
    expect(out).not.toContain('align-items:center');
  });

  test('fx1 → flex:1, НЕ display:flex (тег fx — только flex-shorthand)', () => {
    expect(css('fx1')).toContain('flex:1');
    expect(css('fx1')).not.toContain('display:flex');
  });

  test('dF → display:flex (работает в обоих — совместимость через тег d)', () => {
    expect(css('dF')).toContain('display:flex');
  });

  test('ovA → overflow:auto (в старом был корректен; в новом был баг — теперь исправлен)', () => {
    expect(css('ovA')).toContain('overflow:auto');
  });
});
