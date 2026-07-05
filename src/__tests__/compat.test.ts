/**
 * Тесты совместимости: новый minotation vs старый minimalist-notation 1.x.
 *
 * Тест-принцип: для каждого токена фиксируем ожидаемое CSS-свойство/значение.
 * Старая версия — эталон в old/minimalist-notation/__tests__/layout.test.js.
 * Здесь проверяем, что новый MN выдаёт то же (или лучше для переименованных токенов).
 *
 * Ключевые отличия (намеренные):
 * - fhaC → fxaC (новое имя: flex x-axis align)
 * - fvaC → fyaC (новое имя: flex y-axis align)
 * - fhaS/fvaS возвращали flex-start; новый MN: fxaS → start, fyaS → start
 * - fx → flex:1 (только flex-shorthand; display:flex — через dF как в старой версии)
 * - ovA → overflow:auto (в старой версии тоже auto; в новом был баг с "absolute" — исправлен)
 */

import {
  createMn, presetStandard, presetSynonyms, presetMedias, presetMain, 
} from '../index';

function mn() {
  const inst = createMn();
  inst.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
    presetMain,
  ]);
  return inst;
}

function css(token: string): string {
  const inst = mn();
  inst.check(token).compile();
  return inst.styles$.getValue().map((b: { content: string }) => b.content).join('');
}

// ================================================================
// Width / Height
// ================================================================
describe('Width / Height — новый MN (совместим со старым)', () => {
  test('w320 → width:320px', () => expect(css('w320')).toContain('width:320px'));
  test('w → width:100%', () => expect(css('w')).toContain('width:100%'));
  test('wmin0 → min-width:0', () => expect(css('wmin0')).toContain('min-width:0'));
  test('wmax300 → max-width:300px', () => expect(css('wmax300')).toContain('max-width:300px'));
  test('h50 → height:50px', () => expect(css('h50')).toContain('height:50px'));
  test('h → height:100%', () => expect(css('h')).toContain('height:100%'));
  test('h100vh → height:100vh', () => expect(css('h100vh')).toContain('height:100vh'));
  test('hmin0 → min-height:0', () => expect(css('hmin0')).toContain('min-height:0'));
  test('hmax200 → max-height:200px', () => expect(css('hmax200')).toContain('max-height:200px'));
  // Дроби (расширение нового MN)
  test('w1/2 → width:50%', () => expect(css('w1/2')).toContain('width:50%'));
  test('w1/3 → width:33.33%', () => expect(css('w1/3')).toMatch(/width:33\.3/));
});

// ================================================================
// Display
// ================================================================
describe('Display — новый MN (совместим со старым)', () => {
  test('dF → display:flex (совместимость со старой версией)', () => {
    expect(css('dF')).toContain('display:flex');
  });
  test('dB → display:block', () => expect(css('dB')).toContain('display:block'));
  test('dN → display:none', () => expect(css('dN')).toContain('display:none'));
  test('dI → display:inline', () => expect(css('dI')).toContain('display:inline'));
  // fx — только flex-shorthand, display:flex теперь через dF
  test('fx (без аргумента) → flex:1 (умолчание shorthand, НЕ display:flex)', () => {
    expect(css('fx')).toContain('flex:1');
    expect(css('fx')).not.toContain('display:flex');
  });
  test('fx1 → flex:1', () => expect(css('fx1')).toContain('flex:1'));
  test('fx0_1_Auto → flex:0 1 auto', () => expect(css('fx0_1_Auto')).toContain('flex:0 1 auto'));
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
  test('fxw (без аргумента) → flex-wrap:wrap', () => expect(css('fxw')).toContain('flex-wrap:wrap'));
  test('fxwNW → flex-wrap:nowrap', () => expect(css('fxwNW')).toContain('flex-wrap:nowrap'));
});

// ================================================================
// Flex-align (переименованы: fha→fxa, fva→fya)
// ================================================================
describe('Flex-align fxa — новое имя (justify-content)', () => {
  test('fxaC → justify-content:center', () => expect(css('fxaC')).toContain('justify-content:center'));
  test('fxaS → justify-content:start', () => expect(css('fxaS')).toContain('justify-content:start'));
  test('fxaE → justify-content:end', () => expect(css('fxaE')).toContain('justify-content:end'));
  test('fxaF → justify-content:flex-start', () => expect(css('fxaF')).toContain('justify-content:flex-start'));
  test('fxaL → justify-content:flex-end', () => expect(css('fxaL')).toContain('justify-content:flex-end'));
  test('fxaB → justify-content:space-between', () => expect(css('fxaB')).toContain('justify-content:space-between'));
  test('fxaA → justify-content:space-around', () => expect(css('fxaA')).toContain('justify-content:space-around'));
  test('fxaV → justify-content:space-evenly', () => expect(css('fxaV')).toContain('justify-content:space-evenly'));
  test('fxaCenter → justify-content:center (длинная форма)', () => expect(css('fxaCenter')).toContain('justify-content:center'));
  test('fxaSpaceBetween → justify-content:space-between (длинная форма)', () => {
    expect(css('fxaSpaceBetween')).toContain('justify-content:space-between');
  });
});

describe('Flex-align fya — новое имя (align-items + align-content)', () => {
  test('fyaC → align-items:center + align-content:center', () => {
    const out = css('fyaC');
    expect(out).toContain('align-items:center');
    expect(out).toContain('align-content:center');
  });
  test('fyaS → align-items:start + align-content:start', () => {
    const out = css('fyaS');
    expect(out).toContain('align-items:start');
    expect(out).toContain('align-content:start');
  });
  test('fyaE → align-items:end + align-content:end', () => {
    const out = css('fyaE');
    expect(out).toContain('align-items:end');
    expect(out).toContain('align-content:end');
  });
  test('fyaF → align-items:flex-start + align-content:flex-start', () => {
    const out = css('fyaF');
    expect(out).toContain('align-items:flex-start');
    expect(out).toContain('align-content:flex-start');
  });
  test('fyaL → align-items:flex-end + align-content:flex-end', () => {
    const out = css('fyaL');
    expect(out).toContain('align-items:flex-end');
    expect(out).toContain('align-content:flex-end');
  });
  test('fyaB → align-items:space-between + align-content:space-between', () => {
    const out = css('fyaB');
    expect(out).toContain('align-items:space-between');
    expect(out).toContain('align-content:space-between');
  });
  test('fyaT → align-items:stretch + align-content:stretch', () => {
    const out = css('fyaT');
    expect(out).toContain('align-items:stretch');
    expect(out).toContain('align-content:stretch');
  });
  test('fyaCenter → align-items:center (длинная форма)', () => expect(css('fyaCenter')).toContain('align-items:center'));
});

// Независимые шорткаты (jc / ai / as / ac) — без изменений
describe('Flex-align шорткаты jc/ai/as/ac', () => {
  test('jcC → justify-content:center', () => expect(css('jcC')).toContain('justify-content:center'));
  test('jcB → justify-content:space-between', () => expect(css('jcB')).toContain('justify-content:space-between'));
  test('aiC → align-items:center', () => expect(css('aiC')).toContain('align-items:center'));
  test('asC → align-self:center', () => expect(css('asC')).toContain('align-self:center'));
  test('acC → align-content:center', () => expect(css('acC')).toContain('align-content:center'));
  test('or1 → order:1', () => expect(css('or1')).toContain('order:1'));
});

// ================================================================
// Overflow
// ================================================================
describe('Overflow — новый MN (исправленный ovVal)', () => {
  test('ov → overflow:hidden', () => expect(css('ov')).toContain('overflow:hidden'));
  test('ovH → overflow:hidden', () => expect(css('ovH')).toContain('overflow:hidden'));
  test('ovA → overflow:auto (A=auto, не absolute)', () => expect(css('ovA')).toContain('overflow:auto'));
  test('ovV → overflow:visible', () => expect(css('ovV')).toContain('overflow:visible'));
  test('ovS → overflow:scroll', () => expect(css('ovS')).toContain('overflow:scroll'));
  test('ovC → overflow:clip', () => expect(css('ovC')).toContain('overflow:clip'));
  test('ovAuto → overflow:auto (длинная форма)', () => expect(css('ovAuto')).toContain('overflow:auto'));
  test('ovHidden → overflow:hidden (длинная форма)', () => expect(css('ovHidden')).toContain('overflow:hidden'));
  test('ovx → overflow-x:hidden', () => expect(css('ovx')).toContain('overflow-x:hidden'));
  test('ovxA → overflow-x:auto', () => expect(css('ovxA')).toContain('overflow-x:auto'));
  test('ovxS → overflow-x:scroll', () => expect(css('ovxS')).toContain('overflow-x:scroll'));
  test('ovy → overflow-y:hidden', () => expect(css('ovy')).toContain('overflow-y:hidden'));
  test('ovyA → overflow-y:auto (был баг с "absolute" — исправлен)', () => {
    expect(css('ovyA')).toContain('overflow-y:auto');
    expect(css('ovyA')).not.toContain('overflow-y:absolute');
  });
  test('ovyS → overflow-y:scroll', () => expect(css('ovyS')).toContain('overflow-y:scroll'));
});

// ================================================================
// Filter / Backdrop-filter
// ================================================================
describe('Filter — новый MN (совместим)', () => {
  test('ftbBlur12 → backdrop-filter:blur(12px)', () => {
    expect(css('ftbBlur12')).toContain('backdrop-filter:blur(12px)');
  });
  test('ftbBlur8 → backdrop-filter:blur(8px)', () => {
    expect(css('ftbBlur8')).toContain('backdrop-filter:blur(8px)');
  });
  test('ftBlur5 → filter:blur(5px)', () => {
    expect(css('ftBlur5')).toContain('filter:blur(5px)');
  });
  test('ftBrightness130 → filter:brightness(130%)', () => {
    expect(css('ftBrightness130')).toContain('filter:brightness(130%)');
  });
});

// ================================================================
// Цвета
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
  // В новом MN нет hex-fallback по умолчанию (без altColor)
  test('bgF.12 → только rgba (без дублирующего hex)', () => {
    const out = css('bgF.12');
    expect(out).not.toMatch(/background:#fff.*background:rgba/s);
  });
});

// ================================================================
// Position
// ================================================================
describe('Position — новый MN (совместим)', () => {
  test('rlv → position:relative', () => expect(css('rlv')).toContain('position:relative'));
  test('abs → position:absolute', () => expect(css('abs')).toContain('position:absolute'));
  test('fixed → position:fixed', () => expect(css('fixed')).toContain('position:fixed'));
  test('sticky → position:sticky', () => expect(css('sticky')).toContain('position:sticky'));
});

// ================================================================
// Комплексный: демо-строка ControlPanel из space-amirka-name/v4
// ================================================================
describe('Демо-строка ControlPanel — новый MN', () => {
  test('w320 bg0A0A12.88 ftbBlur12 cF dF fxdC ov — все токены корректны', () => {
    const inst = mn();
    inst.check('w320 bg0A0A12.88 ftbBlur12 cF dF fxdC ov').compile();
    const out = inst.styles$.getValue().map((b: { content: string }) => b.content).join('');
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
    inst.check('px16 fxs0 h75 dF aiC').compile();
    const out = inst.styles$.getValue().map((b: { content: string }) => b.content).join('');
    expect(out).toContain('padding-left:16px');
    expect(out).toContain('padding-right:16px');
    expect(out).toContain('flex-shrink:0');
    expect(out).toContain('height:75px');
    expect(out).toContain('display:flex');
    expect(out).toContain('align-items:center');
  });

  test('px16 pt16 pb40 fxg1 ovyA — скролл-контент', () => {
    const inst = mn();
    inst.check('px16 pt16 pb40 fxg1 ovyA').compile();
    const out = inst.styles$.getValue().map((b: { content: string }) => b.content).join('');
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
    // fha — нет такого тега, результат пуст или не содержит justify-content через fha
    const out = css('fhaC');
    // fhaC не должен давать justify-content через тег fha (тег переименован в fxa)
    // Но может случайно совпасть с другим хендлером — проверяем только отсутствие fha-тега
    // Для чёткости: hander 'fha' удалён, значит 'fhaC' не порождает стиль
    expect(out).not.toContain('justify-content:center');
  });

  test('fvaC не зарегистрирован в новом MN (переименован в fyaC)', () => {
    const out = css('fvaC');
    expect(out).not.toContain('align-items:center');
  });

  test('fx → flex:1, НЕ display:flex (тег fx — только flex-shorthand)', () => {
    expect(css('fx')).toContain('flex:1');
    expect(css('fx')).not.toContain('display:flex');
  });

  test('dF → display:flex (работает в обоих — совместимость через тег d)', () => {
    expect(css('dF')).toContain('display:flex');
  });

  test('ovA → overflow:auto (в старом был корректен; в новом был баг — теперь исправлен)', () => {
    expect(css('ovA')).toContain('overflow:auto');
  });
});
