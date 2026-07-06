// @ts-nocheck
/* eslint-disable */
/**
 * Комплексные тесты variant groups для minotation v2.
 *
 * Покрывает все сценарии из spec §12 (12-variant-groups-css-output.md).
 * Тесты для ! модификатора помечены TODO — фича не реализована в v2.
 *
 * Spec: LABARATORY/PROJECTS_CONTEXT/minotation/AGENT_DRAFT/SPEC/12-variant-groups-css-output.md
 */

import {
  createMn, 
} from '../index';

function css(mn: ReturnType<typeof createMn>) {
  return mn.styles$.getValue().map(s => s.content).join('');
}

function make(opts?: { media?: Record<string, { query?: string;
selector?: string;
priority?: number }> }) {
  const mn = createMn(opts);
  mn('p',  (s) => ({
    style: {
      padding:      s.arg + 'px', 
    }, 
  }));
  mn('m',  (s) => ({
    style: {
      margin:       s.arg + 'px', 
    }, 
  }));
  mn('mt', (s) => ({
    style: {
      marginTop:    s.arg + 'px', 
    }, 
  }));
  mn('mb', (s) => ({
    style: {
      marginBottom: s.arg + 'px', 
    }, 
  }));
  // 'c' handler: cF → color:#F, cA → color:#A (arg = uppercase letter(s))
  mn('c',  (s) => ({
    style: {
      color: '#' + (s.arg || ''), 
    }, 
  }));
  mn.setSynonyms({
    a: ':active',
    d: ':focus',
    f: ':focus',
    h: ':hover', 
  });
  return mn;
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 Базовые случаи
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 Базовые случаи variant groups', () => {
  test('(p10|m5) → один класс .\\(p10\\|m5\\) с двумя телами', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\){padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\){margin:5px}');
    expect(c).not.toContain('.p10{');
    expect(c).not.toContain('.m5{');
  });

  test('p(10|20|30) → один класс с тремя padding-телами', () => {
    const mn = make();
    mn.getCompiler('class').check('p(10|20|30)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.p\\(10\\|20\\|30\\){padding:10px}');
    expect(c).toContain('.p\\(10\\|20\\|30\\){padding:20px}');
    expect(c).toContain('.p\\(10\\|20\\|30\\){padding:30px}');
    expect(c).not.toContain('.p10{');
  });

  test('(mt|mb)15 → один класс .\\(mt\\|mb\\)15', () => {
    const mn = make();
    mn.getCompiler('class').check('(mt|mb)15');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(mt\\|mb\\)15{margin-top:15px}');
    expect(c).toContain('.\\(mt\\|mb\\)15{margin-bottom:15px}');
  });

  test('вложенные (p(10|20)|m5) → один класс с тремя телами', () => {
    const mn = make();
    mn.getCompiler('class').check('(p(10|20)|m5)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p\\(10\\|20\\)\\|m5\\){padding:10px}');
    expect(c).toContain('.\\(p\\(10\\|20\\)\\|m5\\){padding:20px}');
    expect(c).toContain('.\\(p\\(10\\|20\\)\\|m5\\){margin:5px}');
    expect(c).not.toContain('.p10{');
    expect(c).not.toContain('.m5{');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 Multi-attr: один token через разные атрибуты → bodyMap по телу
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 Multi-attr: один token в разных атрибутах', () => {
  test('p10 через class + m-n + id → три селектора в одном правиле', () => {
    const mn = make();
    mn.getCompiler('class').check('p10');
    mn.getCompiler('m-n').check('p10');
    mn.getCompiler('id').check('p10');
    mn.compile();
    expect(css(mn)).toBe('.p10,[m-n~="p10"],#p10{padding:10px}');
  });

  test('(p10|m5) через class + m-n → два тела, каждое с двумя селекторами', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)');
    mn.getCompiler('m-n').check('(p10|m5)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\),[m-n~="(p10|m5)"]{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\),[m-n~="(p10|m5)"]{margin:5px}');
  });

  test('(p10|m5) через class + m-n + id → по три селектора в каждом правиле', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)');
    mn.getCompiler('m-n').check('(p10|m5)');
    mn.getCompiler('id').check('(p10|m5)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\),[m-n~="(p10|m5)"],#\\(p10\\|m5\\){padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\),[m-n~="(p10|m5)"],#\\(p10\\|m5\\){margin:5px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 Состояния (pseudo-classes) с variant groups
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 Состояния + variants', () => {
  test('(p10|m5):hover → псевдокласс в имени и как CSS pseudo', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5):hover');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\)\\:hover:hover{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\:hover:hover{margin:5px}');
  });

  test('(p10|m5):d — synonym d → :focus', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5):d');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\)\\:d:focus{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\:d:focus{margin:5px}');
  });

  test('(cF|cA):h → один класс с :hover, два CSS-правила (разные тела)', () => {
    const mn = make();
    mn.getCompiler('class').check('(cF|cA):h');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(cF\\|cA\\)\\:h:hover{color:#F}');
    expect(c).toContain('.\\(cF\\|cA\\)\\:h:hover{color:#A}');
  });

  test('bodyMap: три разных token с одинаковым телом → одно CSS-правило', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5):hover');
    mn.getCompiler('class').check('(p10|m5):d');
    mn.getCompiler('class').check('(p10|m5):h');
    mn.compile();
    const c = css(mn);
    // :hover и :h оба → :hover → bodyMap группирует padding:10px
    expect(c).toContain('.\\(p10\\|m5\\)\\:hover:hover,.\\(p10\\|m5\\)\\:d:focus,.\\(p10\\|m5\\)\\:h:hover{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\:hover:hover,.\\(p10\\|m5\\)\\:d:focus,.\\(p10\\|m5\\)\\:h:hover{margin:5px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 Медиазапросы + variants
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 Медиа + variants', () => {
  test('(p10|m5)@sm → @media блок с двумя телами', () => {
    const mn = make({
      media: {
        sm: {
          query: '(max-width:640px)',
          priority: 0, 
        }, 
      }, 
    });
    mn.getCompiler('class').check('(p10|m5)@sm');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('@media (max-width:640px)');
    expect(c).toContain('.\\(p10\\|m5\\)\\@sm{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\@sm{margin:5px}');
  });

  test('p(10|20)<.root@sm → media + parent, два тела', () => {
    const mn = make({
      media: {
        sm: {
          query: '(max-width:640px)',
          priority: 0, 
        }, 
      }, 
    });
    mn.getCompiler('class').check('p(10|20)<.root@sm');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('@media (max-width:640px)');
    expect(c).toContain('.root .p\\(10\\|20\\)\\<\\.root\\@sm{padding:10px}');
    expect(c).toContain('.root .p\\(10\\|20\\)\\<\\.root\\@sm{padding:20px}');
  });

  test('(p10|m5)@sm + p(10|20)<.root@sm → bodyMap группирует padding:10px', () => {
    const mn = make({
      media: {
        sm: {
          query: '(max-width:640px)',
          priority: 0, 
        }, 
      }, 
    });
    mn.getCompiler('class').check('(p10|m5)@sm');
    mn.getCompiler('class').check('p(10|20)<.root@sm');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\)\\@sm,.root .p\\(10\\|20\\)\\<\\.root\\@sm{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\@sm{margin:5px}');
    expect(c).toContain('.root .p\\(10\\|20\\)\\<\\.root\\@sm{padding:20px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 Родительский контекст + variants
// ─────────────────────────────────────────────────────────────────────────────

describe('§6 Родительский контекст + variants', () => {
  test('(p10|m5)<.parent → два тела с parent-контекстом', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)<.parent');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.parent .\\(p10\\|m5\\)\\<\\.parent{padding:10px}');
    expect(c).toContain('.parent .\\(p10\\|m5\\)\\<\\.parent{margin:5px}');
  });

  test('(p10|m5)<1.clsA → прямой родитель depth=1', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)<1.clsA');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.clsA>.\\(p10\\|m5\\)\\<1\\.clsA{padding:10px}');
    expect(c).toContain('.clsA>.\\(p10\\|m5\\)\\<1\\.clsA{margin:5px}');
  });

  test('(p10|m5)<.clsA<.clsB → цепочка двух предков', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)<.clsA<.clsB');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.clsB .clsA .\\(p10\\|m5\\)\\<\\.clsA\\<\\.clsB{padding:10px}');
    expect(c).toContain('.clsB .clsA .\\(p10\\|m5\\)\\<\\.clsA\\<\\.clsB{margin:5px}');
  });

  test('(p10|m5)<.(clsA.active|clsB):(d|f) — v2: состояние на элементе, без дедупликации', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)<.(clsA.active|clsB):(d|f)');
    mn.compile();
    const c = css(mn);
    const token = '.\\(p10\\|m5\\)\\<\\.\\(clsA\\.active\\|clsB\\)\\:\\(d\\|f\\)';
    // v2 поведение (отличается от v1):
    //  - состояние :focus на ЭЛЕМЕНТЕ (не на родителе)
    //  - d и f оба → :focus, но без дедупликации (4 селектора вместо 2)
    // v1 поведение: ".clsA.active:focus token,.clsB:focus token{...}" (2 селектора)
    expect(c).toContain(`.clsA.active ${token}:focus,.clsA.active ${token}:focus,.clsB ${token}:focus,.clsB ${token}:focus{padding:10px}`);
    expect(c).toContain(`.clsA.active ${token}:focus,.clsA.active ${token}:focus,.clsB ${token}:focus,.clsB ${token}:focus{margin:5px}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 Multiplier *N
// ─────────────────────────────────────────────────────────────────────────────

describe('§7 Multiplier *N (в конце токена)', () => {
  test('(p10|m5)*2 → удвоение селектора для каждого тела', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)*2');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\)\\*2.\\(p10\\|m5\\)\\*2{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\*2.\\(p10\\|m5\\)\\*2{margin:5px}');
  });

  test('(p10|m5)<.parent*2 → *N после parent (правильная позиция)', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)<.parent*2');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.parent .\\(p10\\|m5\\)\\<\\.parent\\*2.\\(p10\\|m5\\)\\<\\.parent\\*2{padding:10px}');
    expect(c).toContain('.parent .\\(p10\\|m5\\)\\<\\.parent\\*2.\\(p10\\|m5\\)\\<\\.parent\\*2{margin:5px}');
  });

  test('(p10|m5) и (p10|m5)*2 — bodyMap группирует одинаковые тела', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|m5)');
    mn.getCompiler('class').check('(p10|m5)*2');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\),.\\(p10\\|m5\\)\\*2.\\(p10\\|m5\\)\\*2{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\),.\\(p10\\|m5\\)\\*2.\\(p10\\|m5\\)\\*2{margin:5px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §8 ! модификатор — v1-специфика, НЕ реализована в v2
// Тесты документируют ожидаемый контракт
// ─────────────────────────────────────────────────────────────────────────────

describe('§8 ! модификатор — < направление (v1-only, TODO в v2)', () => {
  test.todo('cF:h!<1.clsA — :hover! на прямом родителе .clsA');
  test.todo('cF.focus!<1.clsA — .focus! на родителе .clsA');
  test.todo('cF(:a|.active!)<1.clsA — :active на el, .active! на родителе → одно правило');
  test.todo('cF(:f|.focus!|:h!)<1.clsA — три варианта, одно CSS-правило');
  test.todo('cA(:f|.focus!)<.clsB<.clsD — .focus! на самом внешнем предке .clsD');
  test.todo('(p10|m5):h!<.parent — :hover! на родителе для variant group');
});

describe('§9 ! модификатор — > направление (v1-only, TODO в v2)', () => {
  test.todo('cF(:a|.active!)>.clsA — :active на token-el, .active! на child .clsA');
  test.todo('cA>.clsA(:a|.active!) — варианты на child .clsA');
  test.todo('cF(:a|.active!)>.clsA>2div — .active! на innermost child div');
  test.todo('cA>.clsA(:a|.active!)>.clsB — :active на .clsA, ! меняет позицию .clsB');
});

// ─────────────────────────────────────────────────────────────────────────────
// §10 Обработчик не найден — silent skip
// ─────────────────────────────────────────────────────────────────────────────

describe('§10 Неизвестный хендлер в variant group → silent skip', () => {
  test('(p10|unknown5) — p10 генерируется, unknown5 не создаёт отдельного CSS', () => {
    const mn = make();
    mn.getCompiler('class').check('(p10|unknown5)');
    mn.compile();
    expect(css(mn)).toBe('.\\(p10\\|unknown5\\){padding:10px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §11 m-n атрибут + parent
// ─────────────────────────────────────────────────────────────────────────────

describe('§11 m-n атрибут + parent', () => {
  test('(p10|m5) через m-n + parent → атрибутный селектор с parent-контекстом', () => {
    const mn = make();
    mn.getCompiler('m-n').check('(p10|m5)<.parent');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.parent [m-n~="(p10|m5)<.parent"]{padding:10px}');
    expect(c).toContain('.parent [m-n~="(p10|m5)<.parent"]{margin:5px}');
  });
});
