// @ts-nocheck
/* eslint-disable */
import postcss from 'postcss';
import {
  createMn, presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain,
} from '../index';
import type {
  MnFn,
} from '../preset/MnInstance';

function compileOne(mn: MnFn, token: string): string {
  const fresh = createMn();
  fresh.setPresets([presetStandard]);
  fresh.check(token);
  fresh.compile();
  return fresh.styles$.getValue().map(s => s.content).join(' ');
}

describe('presetStandard', () => {
  // ================================================================
  // Размеры
  // ================================================================
  describe('Width / Height', () => {
    test('w100 → width:100px', () => expect(compileOne(createMn(), 'w100')).toContain('width:100px'));
    test('w (без аргумента) → width:100%', () => expect(compileOne(createMn(), 'w')).toContain('width:100%'));
    test('w1/2 → width:50%', () => expect(compileOne(createMn(), 'w1/2')).toContain('width:50%'));
    test('w1/3 → width:33.33%', () => expect(compileOne(createMn(), 'w1/3')).toContain('width:33.33%'));
    test('w2/3 → width:66.66%', () => expect(compileOne(createMn(), 'w2/3')).toContain('width:66.66%'));
    test('w3/4 → width:75%', () => expect(compileOne(createMn(), 'w3/4')).toContain('width:75%'));
    test('w2/3+20 → calc(66.66% + 20px) (дефолтная единица px)', () => expect(compileOne(createMn(), 'w2/3+20')).toContain('width:calc(66.66% + 20px)'));
    test('w2/3+20px → calc(66.66% + 20px)', () => expect(compileOne(createMn(), 'w2/3+20px')).toContain('width:calc(66.66% + 20px)'));
    test('w2/3+20rem → calc(66.66% + 20rem)', () => expect(compileOne(createMn(), 'w2/3+20rem')).toContain('width:calc(66.66% + 20rem)'));
    test('w1/2-40 → calc(50% - 40px)', () => expect(compileOne(createMn(), 'w1/2-40')).toContain('width:calc(50% - 40px)'));
    test('h1/2 → height:50%', () => expect(compileOne(createMn(), 'h1/2')).toContain('height:50%'));
    test('h2/3+100 → calc(66.66% + 100px)', () => expect(compileOne(createMn(), 'h2/3+100')).toContain('height:calc(66.66% + 100px)'));
    test('w50p → width:50%', () => expect(compileOne(createMn(), 'w50p')).toContain('width:50%'));
    test('h50 → height:50px', () => expect(compileOne(createMn(), 'h50')).toContain('height:50px'));
    test('h (без аргумента) → height:100%', () => expect(compileOne(createMn(), 'h')).toContain('height:100%'));
    test('wmin320 → min-width:320px', () => expect(compileOne(createMn(), 'wmin320')).toContain('min-width:320px'));
    test('wmax800 → max-width:800px', () => expect(compileOne(createMn(), 'wmax800')).toContain('max-width:800px'));
    test('hmin100 → min-height:100px', () => expect(compileOne(createMn(), 'hmin100')).toContain('min-height:100px'));
    test('hmax100 → max-height:100px', () => expect(compileOne(createMn(), 'hmax100')).toContain('max-height:100px'));
    test('sq200 → width+height:200px', () => {
      const css = compileOne(createMn(), 'sq200');
      expect(css).toContain('width:200px');
      expect(css).toContain('height:200px');
    });
    test('sqmin200 → min-width+min-height:200px', () => {
      const css = compileOne(createMn(), 'sqmin200');
      expect(css).toContain('min-width:200px');
      expect(css).toContain('min-height:200px');
    });
    test('sqmax200 → max-width+max-height:200px', () => {
      const css = compileOne(createMn(), 'sqmax200');
      expect(css).toContain('max-width:200px');
      expect(css).toContain('max-height:200px');
    });
  });

  // ================================================================
  // Отступы
  // ================================================================
  describe('Padding / Margin', () => {
    test('p10 → padding:10px', () => expect(compileOne(createMn(), 'p10')).toContain('padding:10px'));
    test('pt5 → padding-top:5px', () => expect(compileOne(createMn(), 'pt5')).toContain('padding-top:5px'));
    test('pb5 → padding-bottom:5px', () => expect(compileOne(createMn(), 'pb5')).toContain('padding-bottom:5px'));
    test('pl5 → padding-left:5px', () => expect(compileOne(createMn(), 'pl5')).toContain('padding-left:5px'));
    test('pr5 → padding-right:5px', () => expect(compileOne(createMn(), 'pr5')).toContain('padding-right:5px'));
    test('m10 → margin:10px', () => expect(compileOne(createMn(), 'm10')).toContain('margin:10px'));
    test('mt5 → margin-top:5px', () => expect(compileOne(createMn(), 'mt5')).toContain('margin-top:5px'));
    test('mb5 → margin-bottom:5px', () => expect(compileOne(createMn(), 'mb5')).toContain('margin-bottom:5px'));
    test('ml5 → margin-left:5px', () => expect(compileOne(createMn(), 'ml5')).toContain('margin-left:5px'));
    test('mr5 → margin-right:5px', () => expect(compileOne(createMn(), 'mr5')).toContain('margin-right:5px'));
    test('m-5 → margin:-5px', () => expect(compileOne(createMn(), 'm-5')).toContain('margin:-5px'));
    test('px10 → padding-left+right:10px', () => {
      const css = compileOne(createMn(), 'px10');
      expect(css).toContain('padding-left:10px');
      expect(css).toContain('padding-right:10px');
    });
    test('py10 → padding-top+bottom:10px', () => {
      const css = compileOne(createMn(), 'py10');
      expect(css).toContain('padding-top:10px');
      expect(css).toContain('padding-bottom:10px');
    });
    test('mx10 → margin-left+right:10px', () => {
      const css = compileOne(createMn(), 'mx10');
      expect(css).toContain('margin-left:10px');
      expect(css).toContain('margin-right:10px');
    });
    test('my10 → margin-top+bottom:10px', () => {
      const css = compileOne(createMn(), 'my10');
      expect(css).toContain('margin-top:10px');
      expect(css).toContain('margin-bottom:10px');
    });
    test('px1.5 → padding-left+right:1.5px', () => {
      const css = compileOne(createMn(), 'px1.5');
      expect(css).toContain('padding-left:1.5px');
      expect(css).toContain('padding-right:1.5px');
    });
    test('mxA → margin-left+right:auto', () => {
      const css = compileOne(createMn(), 'mxA');
      expect(css).toContain('margin-left:auto');
      expect(css).toContain('margin-right:auto');
    });
    test('p1/4 → padding:25%', () => expect(compileOne(createMn(), 'p1/4')).toContain('padding:25%'));
    test('m1/3 → margin:33.33%', () => expect(compileOne(createMn(), 'm1/3')).toContain('margin:33.33%'));
    test('pt1/2+10 → padding-top:calc(50% + 10px)', () => expect(compileOne(createMn(), 'pt1/2+10')).toContain('padding-top:calc(50% + 10px)'));
    test('ml1/4-5rem → margin-left:calc(25% - 5rem)', () => expect(compileOne(createMn(), 'ml1/4-5rem')).toContain('margin-left:calc(25% - 5rem)'));
  });

  // ================================================================
  // Шрифт
  // ================================================================
  describe('Font', () => {
    test('f16 → font-size:16px', () => expect(compileOne(createMn(), 'f16')).toContain('font-size:16px'));
    test('fwBold → font-weight:bold', () => expect(compileOne(createMn(), 'fwBold')).toContain('font-weight:bold'));
    test('fw4 → font-weight:400', () => expect(compileOne(createMn(), 'fw4')).toContain('font-weight:400'));
    test('fw6 → font-weight:600', () => expect(compileOne(createMn(), 'fw6')).toContain('font-weight:600'));
    test('fw700 → font-weight:700', () => expect(compileOne(createMn(), 'fw700')).toContain('font-weight:700'));
    test('lh1_5 → line-height:1.5', () => expect(compileOne(createMn(), 'lh1_5')).toContain('line-height:1.5'));
    test('lh1.4 → line-height:1.4', () => expect(compileOne(createMn(), 'lh1.4')).toContain('line-height:1.4'));
    test('lh1 → line-height:1', () => expect(compileOne(createMn(), 'lh1')).toContain('line-height:1'));
    test('lh20px → line-height:20px', () => expect(compileOne(createMn(), 'lh20px')).toContain('line-height:20px'));
    test('ffArial → font-family:arial', () => expect(compileOne(createMn(), 'ffArial')).toContain('font-family:arial'));
    test('fsI → font-style:italic', () => expect(compileOne(createMn(), 'fsI')).toContain('font-style:italic'));
    test('fsN → font-style:normal', () => expect(compileOne(createMn(), 'fsN')).toContain('font-style:normal'));
    test('fvSmallCaps → font-variant:small-caps', () => expect(compileOne(createMn(), 'fvSmallCaps')).toContain('font-variant:small-caps'));
    test('fstCondensed → font-stretch:condensed', () => expect(compileOne(createMn(), 'fstCondensed')).toContain('font-stretch:condensed'));
    test('fontCaption → font:caption', () => expect(compileOne(createMn(), 'fontCaption')).toContain('font:caption'));
  });

  // ================================================================
  // Текст
  // ================================================================
  describe('Text', () => {
    test('tl → text-align:left', () => expect(compileOne(createMn(), 'tl')).toContain('text-align:left'));
    test('tr → text-align:right', () => expect(compileOne(createMn(), 'tr')).toContain('text-align:right'));
    test('tc → text-align:center', () => expect(compileOne(createMn(), 'tc')).toContain('text-align:center'));
    test('tj → text-align:justify', () => expect(compileOne(createMn(), 'tj')).toContain('text-align:justify'));
    test('tdU → text-decoration:underline', () => expect(compileOne(createMn(), 'tdU')).toContain('text-decoration:underline'));
    test('tdN → text-decoration:none', () => expect(compileOne(createMn(), 'tdN')).toContain('text-decoration:none'));
    test('ttU → text-transform:uppercase', () => expect(compileOne(createMn(), 'ttU')).toContain('text-transform:uppercase'));
    test('ttN → text-transform:none', () => expect(compileOne(createMn(), 'ttN')).toContain('text-transform:none'));
    test('vaMiddle → vertical-align:middle', () => expect(compileOne(createMn(), 'vaMiddle')).toContain('vertical-align:middle'));
    test('wsNowrap → white-space:nowrap', () => expect(compileOne(createMn(), 'wsNowrap')).toContain('white-space:nowrap'));
    test('wbBreakAll → word-break:break-all', () => expect(compileOne(createMn(), 'wbBreakAll')).toContain('word-break:break-all'));
    test('tsa → text-size-adjust:100%', () => expect(compileOne(createMn(), 'tsa')).toContain('text-size-adjust:100%'));
    test('break → word-break+white-space', () => {
      const css = compileOne(createMn(), 'break');
      expect(css).toContain('word-break:break-word');
      expect(css).toContain('white-space:normal');
    });
    test('tovEllipsis → text-overflow:ellipsis', () => expect(compileOne(createMn(), 'tovEllipsis')).toContain('text-overflow:ellipsis'));
    test('lts1px → letter-spacing:1px', () => expect(compileOne(createMn(), 'lts1px')).toContain('letter-spacing:1px'));
    test('ti40px → text-indent:40px', () => expect(compileOne(createMn(), 'ti40px')).toContain('text-indent:40px'));
    test('wmVerticalRl → writing-mode:vertical-rl', () => expect(compileOne(createMn(), 'wmVerticalRl')).toContain('writing-mode:vertical-rl'));
  });

  // ================================================================
  // Цвет
  // ================================================================
  describe('Color', () => {
    test('cF00 → color:#F00', () => expect(compileOne(createMn(), 'cF00')).toContain('color:#F00'));
    test('c000 → color:#000', () => expect(compileOne(createMn(), 'c000')).toContain('color:#000'));
    test('cT → color:transparent', () => expect(compileOne(createMn(), 'cT')).toContain('color:transparent'));
    test('cCT → color:currentColor', () => expect(compileOne(createMn(), 'cCT')).toContain('color:currentColor'));
    test('cD → color:#DDD', () => expect(compileOne(createMn(), 'cD')).toContain('color:#DDD'));
    test('cTransparent → color:transparent', () => expect(compileOne(createMn(), 'cTransparent')).toContain('color:transparent'));
    test('bgFFF → background:#FFF', () => expect(compileOne(createMn(), 'bgFFF')).toContain('background:#FFF'));
    test('bc000 → border-color:#000', () => expect(compileOne(createMn(), 'bc000')).toContain('border-color:#000'));
    test('bgcF00 → background-color:#F00', () => expect(compileOne(createMn(), 'bgcF00')).toContain('background-color:#F00'));
    test('strokeF00 → stroke:#F00', () => expect(compileOne(createMn(), 'strokeF00')).toContain('stroke:#F00'));
    test('fillFFF → fill:#FFF', () => expect(compileOne(createMn(), 'fillFFF')).toContain('fill:#FFF'));
  });

  // ================================================================
  // Отображение и позиционирование
  // ================================================================
  describe('Display / Position', () => {
    test('dB → display:block', () => expect(compileOne(createMn(), 'dB')).toContain('display:block'));
    test('dN → display:none', () => expect(compileOne(createMn(), 'dN')).toContain('display:none'));
    test('dF → display:flex', () => expect(compileOne(createMn(), 'dF')).toContain('display:flex'));
    test('dI → display:inline', () => expect(compileOne(createMn(), 'dI')).toContain('display:inline'));
    test('dT → display:table', () => expect(compileOne(createMn(), 'dT')).toContain('display:table'));
    test('dFlex → display:flex', () => expect(compileOne(createMn(), 'dFlex')).toContain('display:flex'));
    test('posA → position:absolute', () => expect(compileOne(createMn(), 'posA')).toContain('position:absolute'));
    test('posR → position:relative', () => expect(compileOne(createMn(), 'posR')).toContain('position:relative'));
    test('rlv → position:relative', () => expect(compileOne(createMn(), 'rlv')).toContain('position:relative'));
    test('abs → position:absolute', () => expect(compileOne(createMn(), 'abs')).toContain('position:absolute'));
    test('fixed → position:fixed', () => expect(compileOne(createMn(), 'fixed')).toContain('position:fixed'));
    test('lt → float:left', () => expect(compileOne(createMn(), 'lt')).toContain('float:left'));
    test('rt → float:right', () => expect(compileOne(createMn(), 'rt')).toContain('float:right'));
    test('clB → clear:both', () => expect(compileOne(createMn(), 'clB')).toContain('clear:both'));
    test('tbl → display:table', () => {
      const css = compileOne(createMn(), 'tbl');
      expect(css).toContain('display:table');
      expect(css).toContain('width:100%');
    });
    test('vHidden → visibility:hidden', () => expect(compileOne(createMn(), 'vHidden')).toContain('visibility:hidden'));
  });

  // ================================================================
  // Границы
  // ================================================================
  describe('Border', () => {
    test('r5 → border-radius:5px', () => expect(compileOne(createMn(), 'r5')).toContain('border-radius:5px'));
    test('r (без аргумента) → border-radius:10000px', () => expect(compileOne(createMn(), 'r')).toContain('border-radius:10000px'));
    test('rlt5 → border-top-left-radius:5px', () => expect(compileOne(createMn(), 'rlt5')).toContain('border-top-left-radius:5px'));
    test('rrt5 → border-top-right-radius:5px', () => expect(compileOne(createMn(), 'rrt5')).toContain('border-top-right-radius:5px'));
    test('rlb5 → border-bottom-left-radius:5px', () => expect(compileOne(createMn(), 'rlb5')).toContain('border-bottom-left-radius:5px'));
    test('rrb5 → border-bottom-right-radius:5px', () => expect(compileOne(createMn(), 'rrb5')).toContain('border-bottom-right-radius:5px'));
    test('bsSolid → border-style:solid', () => expect(compileOne(createMn(), 'bsSolid')).toContain('border-style:solid'));
    test('bsS → border-style:solid (single-char)', () => expect(compileOne(createMn(), 'bsS')).toContain('border-style:solid'));
    test('bxzBorderBox → box-sizing:border-box', () => expect(compileOne(createMn(), 'bxzBorderBox')).toContain('box-sizing:border-box'));
    test('bxzBB → box-sizing:border-box (сокращение)', () => expect(compileOne(createMn(), 'bxzBB')).toContain('box-sizing:border-box'));
    // b/bl/br/bt/bb → border-width (не border shorthand)
    test('b1 → border-width:1px', () => expect(compileOne(createMn(), 'b1')).toContain('border-width:1px'));
    test('b2 → border-width:2px', () => expect(compileOne(createMn(), 'b2')).toContain('border-width:2px'));
    test('bl1 → border-left-width:1px', () => expect(compileOne(createMn(), 'bl1')).toContain('border-left-width:1px'));
    test('br1 → border-right-width:1px', () => expect(compileOne(createMn(), 'br1')).toContain('border-right-width:1px'));
    test('bt1 → border-top-width:1px', () => expect(compileOne(createMn(), 'bt1')).toContain('border-top-width:1px'));
    test('bb1 → border-bottom-width:1px', () => expect(compileOne(createMn(), 'bb1')).toContain('border-bottom-width:1px'));
    test('bb2 → border-bottom-width:2px', () => expect(compileOne(createMn(), 'bb2')).toContain('border-bottom-width:2px'));
  });

  // ================================================================
  // Border по сторонам (style + color)
  // ================================================================
  describe('Border по сторонам', () => {
    // style
    test('bslS → border-left-style:solid', () => expect(compileOne(createMn(), 'bslS')).toContain('border-left-style:solid'));
    test('bsrS → border-right-style:solid', () => expect(compileOne(createMn(), 'bsrS')).toContain('border-right-style:solid'));
    test('bstS → border-top-style:solid', () => expect(compileOne(createMn(), 'bstS')).toContain('border-top-style:solid'));
    test('bsbS → border-bottom-style:solid', () => expect(compileOne(createMn(), 'bsbS')).toContain('border-bottom-style:solid'));
    // color
    test('bclF.12 → border-left-color:rgba(255,255,255,.12)', () => expect(compileOne(createMn(), 'bclF.12')).toContain('border-left-color:rgba(255,255,255,.12)'));
    test('bcrF.12 → border-right-color:rgba(255,255,255,.12)', () => expect(compileOne(createMn(), 'bcrF.12')).toContain('border-right-color:rgba(255,255,255,.12)'));
    test('bctF.08 → border-top-color:rgba(255,255,255,.08)', () => expect(compileOne(createMn(), 'bctF.08')).toContain('border-top-color:rgba(255,255,255,.08)'));
    test('bcbF.08 → border-bottom-color:rgba(255,255,255,.08)', () => expect(compileOne(createMn(), 'bcbF.08')).toContain('border-bottom-color:rgba(255,255,255,.08)'));
    test('bctF.1 → border-top-color:rgba(255,255,255,.1)', () => expect(compileOne(createMn(), 'bctF.1')).toContain('border-top-color:rgba(255,255,255,.1)'));
  });

  // ================================================================
  // Тени — box-shadow DSL
  // ================================================================
  describe('Shadow', () => {
    test('bxsh5 → box-shadow с offset 5px', () => {
      const css = compileOne(createMn(), 'bxsh5');
      expect(css).toContain('box-shadow:');
      expect(css).toContain('5px');
    });
    test('bxsh0r18cF.25 → 0 0 18px rgba(255,255,255,.25)', () => {
      const css = compileOne(createMn(), 'bxsh0r18cF.25');
      expect(css).toContain('box-shadow:');
      expect(css).toContain('0 0 18px');
      expect(css).toContain('rgba(255,255,255,.25)');
    });
    test('bxsh5r7 → blur 7px', () => expect(compileOne(createMn(), 'bxsh5r7')).toContain('7px'));
    test('bxsh5in → inset', () => expect(compileOne(createMn(), 'bxsh5in')).toContain('inset'));
    test('tsh5 → text-shadow с offset 5px', () => expect(compileOne(createMn(), 'tsh5')).toContain('text-shadow:'));
  });

  // ================================================================
  // Opacity / Object
  // ================================================================
  describe('Opacity / Object', () => {
    test('o70 → opacity:0.7', () => expect(compileOne(createMn(), 'o70')).toContain('opacity:0.7'));
    test('o100 → opacity:1', () => expect(compileOne(createMn(), 'o100')).toContain('opacity:1'));
    test('o0 → opacity:0', () => expect(compileOne(createMn(), 'o0')).toContain('opacity:0'));
    test('op0_5 → object-position:0 5', () => expect(compileOne(createMn(), 'op0_5')).toContain('object-position:0 5'));
  });

  // ================================================================
  // Overflow
  // ================================================================
  describe('Overflow', () => {
    test('ovH → overflow:hidden', () => expect(compileOne(createMn(), 'ovH')).toContain('overflow:hidden'));
    test('ov (без аргумента) → overflow:hidden', () => expect(compileOne(createMn(), 'ov')).toContain('overflow:hidden'));
    test('ovA → overflow:auto (A=auto, не absolute)', () => expect(compileOne(createMn(), 'ovA')).toContain('overflow:auto'));
    test('ovV → overflow:visible', () => expect(compileOne(createMn(), 'ovV')).toContain('overflow:visible'));
    test('ovS → overflow:scroll', () => expect(compileOne(createMn(), 'ovS')).toContain('overflow:scroll'));
    test('ovC → overflow:clip', () => expect(compileOne(createMn(), 'ovC')).toContain('overflow:clip'));
    test('ovAuto → overflow:auto (длинная форма)', () => expect(compileOne(createMn(), 'ovAuto')).toContain('overflow:auto'));
    test('ovxA → overflow-x:auto', () => expect(compileOne(createMn(), 'ovxA')).toContain('overflow-x:auto'));
    test('ovxAuto → overflow-x:auto', () => expect(compileOne(createMn(), 'ovxAuto')).toContain('overflow-x:auto'));
    test('ovyA → overflow-y:auto', () => expect(compileOne(createMn(), 'ovyA')).toContain('overflow-y:auto'));
    test('ovyS → overflow-y:scroll', () => expect(compileOne(createMn(), 'ovyS')).toContain('overflow-y:scroll'));
    test('ovyScroll → overflow-y:scroll', () => expect(compileOne(createMn(), 'ovyScroll')).toContain('overflow-y:scroll'));
    test('ovx (без аргумента) → overflow-x:hidden', () => expect(compileOne(createMn(), 'ovx')).toContain('overflow-x:hidden'));
    test('ovy (без аргумента) → overflow-y:hidden', () => expect(compileOne(createMn(), 'ovy')).toContain('overflow-y:hidden'));
  });

  // ================================================================
  // Слои
  // ================================================================
  describe('Layers', () => {
    test('z10 → z-index:10', () => expect(compileOne(createMn(), 'z10')).toContain('z-index:10'));
    test('z-1 → z-index:-1', () => expect(compileOne(createMn(), 'z-1')).toContain('z-index:-1'));
    test('crPointer → cursor:pointer', () => expect(compileOne(createMn(), 'crPointer')).toContain('cursor:pointer'));
    test('eNone → pointer-events:none', () => expect(compileOne(createMn(), 'eNone')).toContain('pointer-events:none'));
    test('usNone → user-select:none', () => expect(compileOne(createMn(), 'usNone')).toContain('user-select:none'));
  });

  // ================================================================
  // Flex
  // ================================================================
  describe('Flex', () => {
    test('fx (без аргумента) → flex:1', () => expect(compileOne(createMn(), 'fx')).toContain('flex:1'));
    test('fx1 → flex:1', () => expect(compileOne(createMn(), 'fx1')).toContain('flex:1'));
    test('fxdColumn → flex-direction:column', () => expect(compileOne(createMn(), 'fxdColumn')).toContain('flex-direction:column'));
    test('fxb100px → flex-basis:100px', () => expect(compileOne(createMn(), 'fxb100px')).toContain('flex-basis:100px'));
    test('fxwWrap → flex-wrap:wrap', () => expect(compileOne(createMn(), 'fxwWrap')).toContain('flex-wrap:wrap'));
    test('fxg1 → flex-grow:1', () => expect(compileOne(createMn(), 'fxg1')).toContain('flex-grow:1'));
    test('fxs0 → flex-shrink:0', () => expect(compileOne(createMn(), 'fxs0')).toContain('flex-shrink:0'));
    test('fxaCenter → justify-content:center', () => expect(compileOne(createMn(), 'fxaCenter')).toContain('justify-content:center'));
    test('fxaC → justify-content:center (короткое имя)', () => expect(compileOne(createMn(), 'fxaC')).toContain('justify-content:center'));
    test('fxaB → justify-content:space-between', () => expect(compileOne(createMn(), 'fxaB')).toContain('justify-content:space-between'));
    test('fyaStart → align-items:start', () => {
      const css = compileOne(createMn(), 'fyaStart');
      expect(css).toContain('align-items:start');
    });
    test('fyaC → align-items:center + align-content:center', () => {
      const css = compileOne(createMn(), 'fyaC');
      expect(css).toContain('align-items:center');
      expect(css).toContain('align-content:center');
    });
    test('jcCenter → justify-content:center', () => expect(compileOne(createMn(), 'jcCenter')).toContain('justify-content:center'));
    test('aiCenter → align-items:center', () => expect(compileOne(createMn(), 'aiCenter')).toContain('align-items:center'));
    test('asCenter → align-self:center', () => expect(compileOne(createMn(), 'asCenter')).toContain('align-self:center'));
    test('acCenter → align-content:center', () => expect(compileOne(createMn(), 'acCenter')).toContain('align-content:center'));
    test('or1 → order:1', () => expect(compileOne(createMn(), 'or1')).toContain('order:1'));
  });

  // ================================================================
  // Transform
  // ================================================================
  describe('Transform', () => {
    test('x-50% → translateX(-50%)', () => expect(compileOne(createMn(), 'x-50%')).toContain('translateX(-50%)'));
    test('x10 → translateX(10px)', () => expect(compileOne(createMn(), 'x10')).toContain('translateX(10px)'));
    test('xY-50% → translateY(-50%)', () => expect(compileOne(createMn(), 'xY-50%')).toContain('translateY(-50%)'));
    test('xS1.5 → scale(1.5)', () => expect(compileOne(createMn(), 'xS1.5')).toContain('scale(1.5)'));
    test('xRz70 → rotateZ(70deg)', () => expect(compileOne(createMn(), 'xRz70')).toContain('rotateZ(70deg)'));
    test('xRx-60 → rotateX(-60deg)', () => expect(compileOne(createMn(), 'xRx-60')).toContain('rotateX(-60deg)'));
    test('xRy45 → rotateY(45deg)', () => expect(compileOne(createMn(), 'xRy45')).toContain('rotateY(45deg)'));
  });

  // ================================================================
  // Transition
  // ================================================================
  describe('Transition', () => {
    test('dn250 → transition-duration:250ms', () => expect(compileOne(createMn(), 'dn250')).toContain('transition-duration:250ms'));
    test('dn (без аргумента) → 250ms', () => expect(compileOne(createMn(), 'dn')).toContain('transition-duration:250ms'));
    test('delay100 → transition-delay:100ms', () => expect(compileOne(createMn(), 'delay100')).toContain('transition-delay:100ms'));
    test('ttfEase → transition-timing-function:ease', () => expect(compileOne(createMn(), 'ttfEase')).toContain('transition-timing-function:ease'));
    test('ttf (без аргумента) → ease', () => expect(compileOne(createMn(), 'ttf')).toContain('transition-timing-function:ease'));
  });

  // ================================================================
  // Background
  // ================================================================
  describe('Background', () => {
    test('bgsCover → background-size:cover', () => expect(compileOne(createMn(), 'bgsCover')).toContain('background-size:cover'));
    test('bgaFixed → background-attachment:fixed', () => expect(compileOne(createMn(), 'bgaFixed')).toContain('background-attachment:fixed'));
    test('bgrNoRepeat → background-repeat:no-repeat', () => expect(compileOne(createMn(), 'bgrNoRepeat')).toContain('background-repeat:no-repeat'));
  });

  // ================================================================
  // Outline
  // ================================================================
  describe('Outline', () => {
    test('olN → outline:none', () => expect(compileOne(createMn(), 'olN')).toContain('outline:none'));
    test('ol0 → outline:0', () => expect(compileOne(createMn(), 'ol0')).toContain('outline:0'));
    test('olo-2 → outline-offset:-2px', () => expect(compileOne(createMn(), 'olo-2')).toContain('outline-offset:-2px'));
    test('olsSolid → outline-style:solid', () => expect(compileOne(createMn(), 'olsSolid')).toContain('outline-style:solid'));
    test('olw2 → outline-width:2px', () => expect(compileOne(createMn(), 'olw2')).toContain('outline-width:2px'));
  });

  // ================================================================
  // Appearance
  // ================================================================
  describe('Appearance', () => {
    test('apcNone → appearance:none', () => expect(compileOne(createMn(), 'apcNone')).toContain('appearance:none'));
  });

  // ================================================================
  // Позиционирование от сторон
  // ================================================================
  describe('Sides', () => {
    test('s0 → top+bottom+left+right:0', () => {
      const css = compileOne(createMn(), 's0');
      expect(css).toContain('top:0');
      expect(css).toContain('bottom:0');
      expect(css).toContain('left:0');
      expect(css).toContain('right:0');
    });
    test('s (без аргумента) → все 0', () => {
      const css = compileOne(createMn(), 's');
      expect(css).toContain('top:0');
      expect(css).toContain('left:0');
    });
    test('st0 → top:0', () => expect(compileOne(createMn(), 'st0')).toContain('top:0'));
    test('sb0 → bottom:0', () => expect(compileOne(createMn(), 'sb0')).toContain('bottom:0'));
    test('sl0 → left:0', () => expect(compileOne(createMn(), 'sl0')).toContain('left:0'));
    test('sr0 → right:0', () => expect(compileOne(createMn(), 'sr0')).toContain('right:0'));
  });

  // ================================================================
  // Stroke
  // ================================================================
  describe('Stroke', () => {
    test('sw2 → stroke-width:2px', () => expect(compileOne(createMn(), 'sw2')).toContain('stroke-width:2px'));
  });

  // ================================================================
  // List
  // ================================================================
  describe('List', () => {
    test('lisNone → list-style:none', () => expect(compileOne(createMn(), 'lisNone')).toContain('list-style:none'));
    test('lispInside → list-style-position:inside', () => expect(compileOne(createMn(), 'lispInside')).toContain('list-style-position:inside'));
    test('listDecimal → list-style-type:decimal', () => expect(compileOne(createMn(), 'listDecimal')).toContain('list-style-type:decimal'));
  });

  // ================================================================
  // Page break
  // ================================================================
  describe('Page break', () => {
    test('pgbbAlways → break-before:always', () => expect(compileOne(createMn(), 'pgbbAlways')).toContain('break-before:always'));
    test('pgbaAvoid → break-after:avoid', () => expect(compileOne(createMn(), 'pgbaAvoid')).toContain('break-after:avoid'));
  });

  // ================================================================
  // Filter / Backdrop-filter
  // ================================================================
  describe('Filter', () => {
    // ft — filter с CamelCase-функцией
    test('ftBlur10 → filter:blur(10px)', () => expect(compileOne(createMn(), 'ftBlur10')).toContain('blur(10px)'));
    test('ftBlur4 → filter:blur(4px)', () => expect(compileOne(createMn(), 'ftBlur4')).toContain('blur(4px)'));
    test('ftGrayscale100 → filter:grayscale(100%)', () => expect(compileOne(createMn(), 'ftGrayscale100')).toContain('grayscale(100%)'));
    test('ftBrightness150 → filter:brightness(150%)', () => expect(compileOne(createMn(), 'ftBrightness150')).toContain('brightness(150%)'));
    // ftb — backdrop-filter
    test('ftbBlur10 → backdrop-filter:blur(10px)', () => expect(compileOne(createMn(), 'ftbBlur10')).toContain('blur(10px)'));
    test('ftbBlur8 → backdrop-filter:blur(8px)', () => expect(compileOne(createMn(), 'ftbBlur8')).toContain('blur(8px)'));
    test('ftbBlur12 → backdrop-filter:blur(12px)', () => expect(compileOne(createMn(), 'ftbBlur12')).toContain('blur(12px)'));
    test('ftbBlur10 содержит backdrop-filter', () => expect(compileOne(createMn(), 'ftbBlur10')).toContain('backdrop-filter'));
    test('mbmMultiply → mix-blend-mode:multiply', () => expect(compileOne(createMn(), 'mbmMultiply')).toContain('mix-blend-mode:multiply'));
  });

  // ================================================================
  // Разное
  // ================================================================
  describe('Разное', () => {
    test('contrast → image-rendering:pixelated', () => expect(compileOne(createMn(), 'contrast')).toContain('image-rendering:pixelated'));
    test('ratio → position:relative;padding-top:100%', () => {
      const css = compileOne(createMn(), 'ratio');
      expect(css).toContain('position:relative');
      expect(css).toContain('padding-top:100%');
    });
    test('ratio3x2 → padding-top:66.67%', () => expect(compileOne(createMn(), 'ratio3x2')).toContain('padding-top:66.666'));
    test('cfx → clearfix :after', () => expect(compileOne(createMn(), 'cfx')).toContain('.cfx:after'));
  });

  // ================================================================
  // Font extras (fsm, fef)
  // ================================================================
  describe('Font extras', () => {
    test('fsmAntialiased → font-smooth:antialiased', () => expect(compileOne(createMn(), 'fsmAntialiased')).toContain('font-smooth:antialiased'));
    test('fefEmboss → font-effect:emboss', () => expect(compileOne(createMn(), 'fefEmboss')).toContain('font-effect:emboss'));
  });

  // ================================================================
  // Color extras (olc, tdc, temc)
  // ================================================================
  describe('Color extras', () => {
    test('olcF00 → outline-color:#F00', () => expect(compileOne(createMn(), 'olcF00')).toContain('outline-color:#F00'));
    test('tdcF00 → text-decoration-color:#F00', () => expect(compileOne(createMn(), 'tdcF00')).toContain('text-decoration-color:#F00'));
    test('temcF00 → text-emphasis-color:#F00', () => expect(compileOne(createMn(), 'temcF00')).toContain('text-emphasis-color:#F00'));
  });

  // ================================================================
  // Display extras (sticky, jt, layout)
  // ================================================================
  describe('Display extras', () => {
    test('sticky → position:sticky', () => expect(compileOne(createMn(), 'sticky')).toContain('position:sticky'));
    test('jt → float:none', () => expect(compileOne(createMn(), 'jt')).toContain('float:none'));
    test('layout (без аргумента) → display:flex', () => expect(compileOne(createMn(), 'layout')).toContain('display:flex'));
    test('layoutGrid → display:grid', () => expect(compileOne(createMn(), 'layoutGrid')).toContain('display:grid'));
  });

  // ================================================================
  // Text extras (tal, tdl, tds, tdsi, tdt, ww, tw, wsc, wos)
  // ================================================================
  describe('Text extras', () => {
    test('talCenter → text-align-last:center', () => expect(compileOne(createMn(), 'talCenter')).toContain('text-align-last:center'));
    test('tdlUnderline → text-decoration-line:underline', () => expect(compileOne(createMn(), 'tdlUnderline')).toContain('text-decoration-line:underline'));
    test('tdsObjects → text-decoration-skip:objects', () => expect(compileOne(createMn(), 'tdsObjects')).toContain('text-decoration-skip:objects'));
    test('tdsiAuto → text-decoration-skip-ink:auto', () => expect(compileOne(createMn(), 'tdsiAuto')).toContain('text-decoration-skip-ink:auto'));
    test('tdt2px → text-decoration-thickness:2px', () => expect(compileOne(createMn(), 'tdt2px')).toContain('text-decoration-thickness:2px'));
    test('wwBreakWord → word-wrap:break-word', () => expect(compileOne(createMn(), 'wwBreakWord')).toContain('word-wrap:break-word'));
    test('twBalance → text-wrap:balance', () => expect(compileOne(createMn(), 'twBalance')).toContain('text-wrap:balance'));
    test('wscCollapse → white-space-collapse:collapse', () => expect(compileOne(createMn(), 'wscCollapse')).toContain('white-space-collapse:collapse'));
    test('wos1em → word-spacing:1em', () => expect(compileOne(createMn(), 'wos1em')).toContain('word-spacing:1em'));
  });

  // ================================================================
  // Border extras (bi, bdcl, bsp)
  // ================================================================
  describe('Border extras', () => {
    test('biNone → border-image:none', () => expect(compileOne(createMn(), 'biNone')).toContain('border-image:none'));
    test('bdclCollapse → border-collapse:collapse', () => expect(compileOne(createMn(), 'bdclCollapse')).toContain('border-collapse:collapse'));
    test('bsp5 → border-spacing:5px', () => expect(compileOne(createMn(), 'bsp5')).toContain('border-spacing:5px'));
  });

  // ================================================================
  // Overflow extras (ovs, ovsc)
  // ================================================================
  describe('Overflow extras', () => {
    test('ovsPaging → overflow-style:paging', () => expect(compileOne(createMn(), 'ovsPaging')).toContain('overflow-style:paging'));
    test('ovscTouch → overflow-scrolling:touch', () => expect(compileOne(createMn(), 'ovscTouch')).toContain('overflow-scrolling:touch'));
  });

  // ================================================================
  // Misc (rsz, cp, ta, inset)
  // ================================================================
  describe('Misc', () => {
    test('rszBoth → resize:both', () => expect(compileOne(createMn(), 'rszBoth')).toContain('resize:both'));
    test('cpAuto → clip:auto', () => expect(compileOne(createMn(), 'cpAuto')).toContain('clip:auto'));
    test('taNone → touch-action:none', () => expect(compileOne(createMn(), 'taNone')).toContain('touch-action:none'));
    test('inset (без аргумента) → inset:0', () => expect(compileOne(createMn(), 'inset')).toContain('inset:0'));
    test('inset10 → inset:10px', () => expect(compileOne(createMn(), 'inset10')).toContain('inset:10px'));
    test('inset10_20 → inset:10px 20px', () => expect(compileOne(createMn(), 'inset10_20')).toContain('inset:10px 20px'));
  });

  // ================================================================
  // Flex extras (fxf)
  // ================================================================
  describe('Flex extras', () => {
    test('fxfColumn → flex-flow:column', () => expect(compileOne(createMn(), 'fxfColumn')).toContain('flex-flow:column'));
  });

  // ================================================================
  // Grid (g, gt, gtc, gtr, gac, gar, gaf, gap, gapc, gapr, gg, ggc, ggr, gc, gr)
  // ================================================================
  describe('Grid', () => {
    test('g_auto_ → grid:auto', () => expect(compileOne(createMn(), 'g_auto_')).toContain('grid:auto'));
    test('gtAuto → grid-template:auto', () => expect(compileOne(createMn(), 'gtAuto')).toContain('grid-template:auto'));
    test('gtcAuto → grid-template-columns:auto', () => expect(compileOne(createMn(), 'gtcAuto')).toContain('grid-template-columns:auto'));
    test('gtrAuto → grid-template-rows:auto', () => expect(compileOne(createMn(), 'gtrAuto')).toContain('grid-template-rows:auto'));
    test('gacAuto → grid-auto-columns:auto', () => expect(compileOne(createMn(), 'gacAuto')).toContain('grid-auto-columns:auto'));
    test('garAuto → grid-auto-rows:auto', () => expect(compileOne(createMn(), 'garAuto')).toContain('grid-auto-rows:auto'));
    test('gafColumn → grid-auto-flow:column', () => expect(compileOne(createMn(), 'gafColumn')).toContain('grid-auto-flow:column'));
    test('gap20 → gap:20px', () => expect(compileOne(createMn(), 'gap20')).toContain('gap:20px'));
    test('gapc10 → column-gap:10px', () => expect(compileOne(createMn(), 'gapc10')).toContain('column-gap:10px'));
    test('gapr10 → row-gap:10px', () => expect(compileOne(createMn(), 'gapr10')).toContain('row-gap:10px'));
    test('gg20 → grid-gap:20px (legacy)', () => expect(compileOne(createMn(), 'gg20')).toContain('grid-gap:20px'));
    test('ggc10 → grid-column-gap:10px (legacy)', () => expect(compileOne(createMn(), 'ggc10')).toContain('grid-column-gap:10px'));
    test('ggr10 → grid-row-gap:10px (legacy)', () => expect(compileOne(createMn(), 'ggr10')).toContain('grid-row-gap:10px'));
    test('gc_span_2_ → grid-column:span 2', () => expect(compileOne(createMn(), 'gc_span_2_')).toContain('grid-column:span 2'));
    test('gr_1_3_ → grid-row:1 3', () => expect(compileOne(createMn(), 'gr_1_3_')).toContain('grid-row:1 3'));
  });

  // ================================================================
  // Transform extras (ts)
  // ================================================================
  describe('Transform extras', () => {
    test('tsFlat → transform-style:flat', () => expect(compileOne(createMn(), 'tsFlat')).toContain('transform-style:flat'));
  });

  // ================================================================
  // Transition extras (tn, tp, spnr)
  // ================================================================
  describe('Transition extras', () => {
    test('tn_all_ → transition:all', () => expect(compileOne(createMn(), 'tn_all_')).toContain('transition:all'));
    test('tp_opacity_ → transition-property:opacity', () => expect(compileOne(createMn(), 'tp_opacity_')).toContain('transition-property:opacity'));
    test('spnr (без аргумента) → animation:spnr 1000ms linear infinite', () => {
      const css = compileOne(createMn(), 'spnr');
      expect(css).toContain('animation:spnr 1000ms linear infinite');
    });
    test('spnr500 → animation:spnr 500ms', () => expect(compileOne(createMn(), 'spnr500')).toContain('animation:spnr 500ms'));
  });

  // ================================================================
  // Background extras (bgi, bgp, bgpx, bgpy, bgo, bgcp, bgbk)
  // ================================================================
  describe('Background extras', () => {
    test('bgiNone → background-image:None', () => expect(compileOne(createMn(), 'bgiNone')).toContain('background-image:None'));
    test('bgpCenter → background-position:center', () => expect(compileOne(createMn(), 'bgpCenter')).toContain('background-position:center'));
    test('bgpxCenter → background-position-x:center', () => expect(compileOne(createMn(), 'bgpxCenter')).toContain('background-position-x:center'));
    test('bgpyBottom → background-position-y:bottom', () => expect(compileOne(createMn(), 'bgpyBottom')).toContain('background-position-y:bottom'));
    test('bgoContentBox → background-origin:content-box', () => expect(compileOne(createMn(), 'bgoContentBox')).toContain('background-origin:content-box'));
    test('bgcpText → background-clip:text', () => expect(compileOne(createMn(), 'bgcpText')).toContain('background-clip:text'));
    test('bgbkEach → background-break:each', () => expect(compileOne(createMn(), 'bgbkEach')).toContain('background-break:each'));
  });

  // ================================================================
  // List extras (lisi)
  // ================================================================
  describe('List extras', () => {
    test('lisiNone → list-style-image:None', () => expect(compileOne(createMn(), 'lisiNone')).toContain('list-style-image:None'));
  });

  // ================================================================
  // Content / Quotes (cnt, q)
  // ================================================================
  describe('Content / Quotes', () => {
    test('cnt (без аргумента) → content:""', () => expect(compileOne(createMn(), 'cnt')).toContain('content:""'));
    test('cntHello_world → content:Hello world', () => expect(compileOne(createMn(), 'cntHello_world')).toContain('content:Hello world'));
    test('q (без аргумента) → quotes:none', () => expect(compileOne(createMn(), 'q')).toContain('quotes:none'));
  });

  // ================================================================
  // Page break extras (pgbi)
  // ================================================================
  describe('Page break extras', () => {
    test('pgbiAvoid → break-inside:avoid', () => expect(compileOne(createMn(), 'pgbiAvoid')).toContain('break-inside:avoid'));
  });

  // ================================================================
  // Table (cps, ec)
  // ================================================================
  describe('Table', () => {
    test('cpsBottom → caption-side:bottom', () => expect(compileOne(createMn(), 'cpsBottom')).toContain('caption-side:bottom'));
    test('ecHide → empty-cells:hide', () => expect(compileOne(createMn(), 'ecHide')).toContain('empty-cells:hide'));
  });

  // ================================================================
  // Aspect ratio (ar)
  // ================================================================
  describe('Aspect ratio', () => {
    test('ar (без аргумента) → aspect-ratio:1', () => expect(compileOne(createMn(), 'ar')).toContain('aspect-ratio:1'));
    test('ar16_9 → aspect-ratio:16/9', () => expect(compileOne(createMn(), 'ar16_9')).toContain('aspect-ratio:16/9'));
    test('ar4_3 → aspect-ratio:4/3', () => expect(compileOne(createMn(), 'ar4_3')).toContain('aspect-ratio:4/3'));
  });
});

describe('presetSynonyms', () => {
  test('h → :hover', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.check('cF00:h');
    mn.compile();
    expect(mn.styles$.getValue()[0]?.content || '').toContain(':hover');
  });
  test('f → :focus', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.check('cF00:f');
    mn.compile();
    expect(mn.styles$.getValue()[0]?.content || '').toContain(':focus');
  });
});

describe('presetMedias', () => {
  test('p10@m → @media (max-width: 991.98px)', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetMedias]);
    mn.check('p10@m');
    mn.compile();
    expect(mn.styles$.getValue()[0]?.content || '').toContain('@media (max-width: 991.98px)');
  });
  test('p10@d → @media (min-width: 992px)', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetMedias]);
    mn.check('p10@d');
    mn.compile();
    expect(mn.styles$.getValue()[0]?.content || '').toContain('@media (min-width: 992px)');
  });
  test('safari → селектор .safari без @media', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetMedias]);
    mn.check('cF00@safari');
    mn.compile();
    const content = mn.styles$.getValue()[0]?.content || '';
    expect(content).toContain('.safari');
    expect(content).not.toContain('@media');
  });
});

describe('presetNormalize', () => {
  test('assign генерирует правила для *, body, img, a', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetNormalize]);
    mn.check('');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(css).toContain('*, *:before, *:after');
    expect(css).toContain('box-sizing:border-box');
    expect(css).toContain('max-width:100%');
    expect(css).toContain('height:auto');
  });
});

describe('presetMain', () => {
  test('содержит сброс для html и body', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetMain]);
    mn.check('');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(css).toContain('line-height:1.15');
    expect(css).toContain('box-sizing:border-box');
  });
});

describe('CSS validation', () => {
  test('postcss: нет структурных ошибок', () => {
    const mn = createMn();
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ]);
    mn.check('w1/2 w1/3 w50p p10 cF00<.p:h bgFFF fx fxdColumn');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join('\n');
    expect(() => postcss.parse(css)).not.toThrow();
  });

  test('целевой класс (имя лексемы) экранирует все спецсимволы', () => {
    const tokens = [
      'w1/2',
      'p10@m',
      'cF00<.p',
      'cF00>.c',
      'cF00:h',
      'cF00*2',
      'test[attr]',
      'test(a|b)',
      'test#id',
      'test+a',
      'test~a',
      'test!x',
      'test$x',
      'test^x',
      'test&x',
    ];
    const mn = createMn();
    mn.setPresets([presetStandard, presetMedias]);
    mn.check(tokens.join(' '));
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');

    // Целевой класс — тот, что образован от compileClassName.
    // С группировкой селекторов несколько токенов с одним CSS-телом объединяются:
    // .sel1,.sel2{body} — нужно находить все классы, не только последний перед {
    // Извлекаем все классы, которые начинаются с . и за ними идут экранированные символы или буквы/цифры
    const classPattern = /\.[a-zA-Z0-9_](?:[a-zA-Z0-9_]|\\[^])*/g;
    const targetClasses = css.match(classPattern) || [];
    const barePattern = /[@/!()|*$^&<>+~#[\]\\]/;

    for (const tc of targetClasses) {
      const bare = tc.slice(1).replace(/\\./g, ''); // убираем . и экранированные пары
      expect(bare).not.toMatch(barePattern);
    }
    expect(targetClasses.length).toBeGreaterThan(4);
  });

  test('контекстные селекторы НЕ экранируются (>.+~# — валидный CSS)', () => {
    const mn = createMn();
    mn.setPresets([presetStandard]);
    mn.check('cF00<.parent cF00<.a+.b cF00>.child cF00<#myid');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(css).toMatch(/\.parent /);
    expect(css).toMatch(/\.a\+\.b/);
    expect(css).toMatch(/\.child/);
    expect(css).toMatch(/#myid/);
  });

  test('состояния генерируют валидные псевдоклассы', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetSynonyms]);
    mn.check('cF00:h cF00:f cF00:a cF00:even cF00:first cF00:last');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join(' ');
    expect(css).toMatch(/:hover/);
    expect(css).toMatch(/:focus/);
    expect(css).toMatch(/:active/);
    expect(css).toMatch(/:nth-child\(2n\)/);
    expect(css).toMatch(/:first-child/);
    expect(css).toMatch(/:last-child/);
  });

  test('медиа-запросы генерируют валидный CSS', () => {
    const mn = createMn();
    mn.setPresets([presetStandard, presetMedias]);
    mn.check('p10@m p10@d p10@m5 p10@dark');
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join('\n');
    expect(() => postcss.parse(css)).not.toThrow();
    expect(css).toContain('@media (max-width: 991.98px)');
    expect(css).toContain('@media (min-width: 992px)');
  });

  test('полный CSS-вывод парсится postcss без ошибок (все пресеты)', () => {
    const mn = createMn();
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
      presetNormalize,
      presetMain,
    ]);
    mn.check([
      'w1/2',
      'h100vh',
      'p10@m',
      'cF00<.p:h',
      'bgFFF',
      'fx',
      'fxdColumn',
      'fxaCenter',
      'jcSpaceBetween',
      'r5',
      'o70',
      'break',
      'rlv',
      'abs',
      's0',
      'cF00<.a+.b',
      'cF00<#myid',
      'cF00<.parent@m:h',
    ].join(' '));
    mn.compile();
    const css = mn.styles$.getValue().map(s => s.content).join('\n');
    expect(() => postcss.parse(css)).not.toThrow();
  });
});
