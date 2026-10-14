/**
 * Примеры раздела README «Варианты и состояния без JS» компилируются так, как написано в разделе
 * (запрос трека web-games, 2026-10-14): документация не расходится с поведением.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import {
  scanTokens,
} from '../extractTokens';
import {
  scanTokensSyntax,
} from '../syntaxScan';

function css(tokens: string): string[] {
  const mn = minotationProvider({
    warningMode: 'error',
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return mn.styles$.getValue().map((s) => s.content);
}

test.each([
  ['(fx1|o0.5).transition (bg1D2A4D|cF).splash', ['.\\(fx1\\|o0\\.5\\)\\.transition.transition{flex:1}'
    + '.\\(fx1\\|o0\\.5\\)\\.transition.transition{opacity:.5}.\\(bg1D2A4D\\|cF\\)\\.splash.splash{background:#1d2a4d}'
    + '.\\(bg1D2A4D\\|cF\\)\\.splash.splash{color:#fff}']],
  ['(fx1|o0.5):not[.splash] (bg1D2A4D|cF).splash', ['.\\(fx1\\|o0\\.5\\)\\:not\\[\\.splash\\]:not(.splash){flex:1}'
    + '.\\(fx1\\|o0\\.5\\)\\:not\\[\\.splash\\]:not(.splash){opacity:.5}.\\(bg1D2A4D\\|cF\\)\\.splash.splash{background:#1d2a4d}'
    + '.\\(bg1D2A4D\\|cF\\)\\.splash.splash{color:#fff}']],
  ['o0.5.disabled', ['.o0\\.5\\.disabled.disabled{opacity:.5}']],
  ['cF00[data-variant=error] c0A0[data-variant=success]', ['.cF00\\[data-variant\\=error\\][data-variant=error]{color:#f00}'
    + '.c0A0\\[data-variant\\=success\\][data-variant=success]{color:#0a0}']],
  ['fwB[aria-pressed=true]', ['.fwB\\[aria-pressed\\=true\\][aria-pressed=true]{font-weight:bold}']],
  ['cF00(.active|[aria-current=page])', ['.cF00\\(\\.active\\|\\[aria-current\\=page\\]\\).active,'
    + '.cF00\\(\\.active\\|\\[aria-current\\=page\\]\\)[aria-current=page]{color:#f00}']],
  ['f14 f12.small f18.large', ['.f14{font-size:14px}.f12\\.small.small{font-size:12px}.f18\\.large.large{font-size:18px}']],
  ['c3 c0A7<.card:h tdU<.card:h', ['.c3{color:#333}', '@media (hover: hover){.card:hover .c0A7\\<\\.card\\:h{color:#0a7}'
    + '.card:hover .tdU\\<\\.card\\:h{text-decoration:underline}}']],
  ['bgE.active:h@m2', ['@media (max-width: 767.98px) and (hover: hover){.bgE\\.active\\:h\\@m2.active:hover{background:#eee}}']],
])('%s', (tokens, expected) => {
  expect(css(tokens)).toEqual(expected);
});

test('группа с состоянием: вкладка', () => {
  expect(css('c9 (c3|bb2|bsS|bc0A7).active').join('')).toBe('.c9{color:#999}'
    + '.\\(c3\\|bb2\\|bsS\\|bc0A7\\)\\.active.active{color:#333}'
    + '.\\(c3\\|bb2\\|bsS\\|bc0A7\\)\\.active.active{border-style:solid}'
    + '.\\(c3\\|bb2\\|bsS\\|bc0A7\\)\\.active.active{border-color:#0a7}'
    + '.\\(c3\\|bb2\\|bsS\\|bc0A7\\)\\.active.active{border-bottom-width:2px}');
});

/** Таблица «Не делайте так» и абзац под ней: что сканер берёт, а что — нет (оба сканера). */
test.each([
  ['<div className={cond ? \'bgE c3\' : \'cF\'} />', [
    'bgE',
    'c3',
    'cF',
  ]],
  ['<div className={cond && \'fwB\'} />', ['fwB']],
  ['<div className={x || \'c3\'} />', ['c3']],
  ['const thClass = isOpen ? \'dB\' : \'dN\';', ['dB', 'dN']],
  ['<div className={clsx({ fwB: active })} />', []],
  ['<div className={\'bg\' + color} />', []],
  ['<div className={\'p10 \' + (on ? \'cF\' : \'c0\')} />', []],
  ['<div className={`p10 ${on ? \'cF\' : \'c0\'}`} />', [
    'c0',
    'cF',
    'p10',
  ]],
])('сканер: %s', (source, expected) => {
  const options = {
    attr: 'className',
  };
  expect(Array.from(new Set(scanTokensSyntax(source, options))).sort()).toEqual(expected);
  expect(Array.from(new Set(scanTokens(source, options))).sort()).toEqual(expected);
});
