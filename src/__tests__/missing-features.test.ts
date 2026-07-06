// @ts-nocheck
/* eslint-disable */
/**
 * Forward-looking тесты: ожидаемое поведение, ещё не реализованное.
 *
 * Эти тесты ЗАВЕДОМО ПАДАЮТ на текущем коде — они документируют контракт,
 * который должна выполнять новая версия после реализации.
 *
 * Зафиксированные разрывы с minimalist-notation v1:
 *
 * 1. ID атрибут — должен генерировать #id, а не [id~="token"]
 * 2. Variants группировка — (a|b) должна создавать ОДИН CSS-класс .\(a\|b\)
 *    с объединёнными стилями, а не разворачивать в отдельные .a и .b
 * 3. Multiplier *N — p10*2 должен давать .p10\*2.p10\*2{...},
 *    *N является частью имени класса, не стрипается
 * 4. childs в StyleResult — связанные дочерние эссенции
 * 5. selectors в StyleResult — дополнительные статические CSS-селекторы
 * 6. Объединение селекторов одного essence из разных attr-типов
 */

import {
  createMn, 
} from '../index';

function css(mn: ReturnType<typeof createMn>) {
  return mn.styles$.getValue().map(s => s.content).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Атрибут 'id' → #id
// Сейчас генерирует [id~="p10"], должен генерировать #p10
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 id attr → #id (MISSING)', () => {
  test('getCompiler("id") → #token{...}', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('id').check('p10');
    mn.compile();
    expect(css(mn)).toBe('#p10{padding:10px}');
  });

  test('id + self-class → #p10\\.active.active', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('id').check('p10.active');
    mn.compile();
    expect(css(mn)).toBe('#p10\\.active.active{padding:10px}');
  });

  test('id + parent <.parent → .parent #p10\\<\\.parent', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('id').check('p10<.parent');
    mn.compile();
    expect(css(mn)).toBe('.parent #p10\\<\\.parent{padding:10px}');
  });

  test('id + :hover → #p10\\:h:hover', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.setSynonyms({
      h: ':hover', 
    });
    mn.getCompiler('id').check('p10:h');
    mn.compile();
    expect(css(mn)).toBe('#p10\\:h:hover{padding:10px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Объединение селекторов из разных attr-типов
// id + m-n с одним essence → #tok,[m-n~="tok"]{...}
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 группировка селекторов из разных attr-типов (MISSING)', () => {
  test('id + m-n с тем же essence → объединяются', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('id').check('p10');
    mn.getCompiler('m-n').check('p10');
    mn.compile();
    // Один CSS-блок с двумя селекторами через запятую
    const c = css(mn);
    expect(c).toBe('#p10,[m-n~="p10"]{padding:10px}');
  });

  // Заметка: class + m-n группировка уже работает в текущей версии
  // (тело одинаковое → bodyMap объединяет селекторы)
  test('class + m-n с тем же essence → .p10,[m-n~="p10"]{...} (уже работает)', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.check('p10');
    mn.getCompiler('m-n').check('p10');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.p10,[m-n~="p10"]{padding:10px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Variants — ОДИН комбинированный CSS-класс
//
// В старой версии (p10|m5) создаёт HTML-класс "(p10|m5)" буквально
// и CSS: .\(p10\|m5\){padding:10px}.\(p10\|m5\){margin:5px}
//
// В НОВОЙ версии сейчас это разворачивается в ОТДЕЛЬНЫЕ .p10 и .m5 — неверно,
// потому что HTML-атрибут class="(p10|m5)" не совпадёт ни с .p10 ни с .m5
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 variants (a|b) → один CSS-класс (MISSING)', () => {
  test('(p10|m5) → один класс .\\(p10\\|m5\\) с обоими стилями', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn('m', (s) => ({
      style: {
        margin: s.arg + 'px', 
      }, 
    }));
    mn.check('(p10|m5)');
    mn.compile();
    const c = css(mn);
    // Один класс с двумя CSS-блоками
    expect(c).toContain('.\\(p10\\|m5\\){padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\){margin:5px}');
    // НЕ создаёт отдельных .p10 и .m5
    expect(c).not.toContain('.p10{');
    expect(c).not.toContain('.m5{');
  });

  test('p(10|20|30) → один класс .p\\(10\\|20\\|30\\) с тремя блоками', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.check('p(10|20|30)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.p\\(10\\|20\\|30\\){padding:10px}');
    expect(c).toContain('.p\\(10\\|20\\|30\\){padding:20px}');
    expect(c).toContain('.p\\(10\\|20\\|30\\){padding:30px}');
    expect(c).not.toContain('.p10{');
  });

  test('(mt|mb)15 → один класс .\\(mt\\|mb\\)15', () => {
    const mn = createMn();
    mn('mt', (s) => ({
      style: {
        marginTop: s.arg + 'px', 
      }, 
    }));
    mn('mb', (s) => ({
      style: {
        marginBottom: s.arg + 'px', 
      }, 
    }));
    mn.check('(mt|mb)15');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(mt\\|mb\\)15{margin-top:15px}');
    expect(c).toContain('.\\(mt\\|mb\\)15{margin-bottom:15px}');
  });

  test('(p10|m5)<.parent → один класс с родительским контекстом', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn('m', (s) => ({
      style: {
        margin: s.arg + 'px', 
      }, 
    }));
    mn.check('(p10|m5)<.parent');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.parent .\\(p10\\|m5\\)\\<\\.parent{padding:10px}');
    expect(c).toContain('.parent .\\(p10\\|m5\\)\\<\\.parent{margin:5px}');
  });

  test('(p10|m5) через getCompiler("m-n") → [m-n~="(p10|m5)"]', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn('m', (s) => ({
      style: {
        margin: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('m-n').check('(p10|m5)');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('[m-n~="(p10|m5)"]{padding:10px}');
    expect(c).toContain('[m-n~="(p10|m5)"]{margin:5px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Multiplier *N — *N является частью имени класса
//
// Старая версия: p10*2 → HTML class="p10*2", CSS: .p10\*2.p10\*2{...}
// Новая версия: ожидается то же самое
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 multiplier *N (MISSING)', () => {
  test('p10*2 → .p10\\*2.p10\\*2{padding:10px}', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.check('p10*2');
    mn.compile();
    expect(css(mn)).toBe('.p10\\*2.p10\\*2{padding:10px}');
  });

  test('p10*3 → .p10\\*3.p10\\*3.p10\\*3{padding:10px}', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.check('p10*3');
    mn.compile();
    expect(css(mn)).toBe('.p10\\*3.p10\\*3.p10\\*3{padding:10px}');
  });

  // p10*1: *1 сохраняется в имени класса, НО селектор не повторяется — уже работает
  test('p10*1 → .p10\\*1{...} (*N в имени класса — уже работает)', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.check('p10*1');
    mn.compile();
    expect(css(mn)).toBe('.p10\\*1{padding:10px}');
  });

  test('id + p10*2 → #p10\\*2#p10\\*2{...}', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('id').check('p10*2');
    mn.compile();
    expect(css(mn)).toBe('#p10\\*2#p10\\*2{padding:10px}');
  });

  test('[m-n~=...] + *2 → [m-n~="p10*2"][m-n~="p10*2"]{...}', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn.getCompiler('m-n').check('p10*2');
    mn.compile();
    expect(css(mn)).toBe('[m-n~="p10*2"][m-n~="p10*2"]{padding:10px}');
  });

  test('(p10|m5)*2 → один класс с дублированием', () => {
    const mn = createMn();
    mn('p', (s) => ({
      style: {
        padding: s.arg + 'px', 
      }, 
    }));
    mn('m', (s) => ({
      style: {
        margin: s.arg + 'px', 
      }, 
    }));
    mn.check('(p10|m5)*2');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('.\\(p10\\|m5\\)\\*2.\\(p10\\|m5\\)\\*2{padding:10px}');
    expect(c).toContain('.\\(p10\\|m5\\)\\*2.\\(p10\\|m5\\)\\*2{margin:5px}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. childs в StyleResult — дочерние связанные эссенции
//
// Старая версия: mn('tbl', ...) с childs на mn('tbl.cell', ...)
// При использовании tbl — автоматически генерируется CSS для дочерних элементов
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 childs в StyleResult (MISSING)', () => {
  test('childs: дочерняя эссенция генерирует CSS-правило с дочерним селектором', () => {
    const mn = createMn();
    mn('tbl', () => ({
      style: {
        display: 'table',
      },
      childs: ['tbl.cell'],
    }));
    mn('tbl.cell', () => ({
      style: {
        display: 'table-cell',
      },
      selectors: ['>*'],
    }));
    mn.check('tbl');
    mn.compile();
    const c = css(mn);
    expect(c).toContain('display:table');
    expect(c).toContain('.tbl>*{display:table-cell}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. selectors в StyleResult — дополнительные статические CSS-селекторы
//
// Старая версия: mn('rlv', () => ({ style: { position: 'relative' }, selectors: ['.rlv'] }))
// Генерирует CSS для .rlv ДОПОЛНИТЕЛЬНО к основному классу
// ─────────────────────────────────────────────────────────────────────────────

describe('§6 selectors в StyleResult (MISSING)', () => {
  test('selectors: ДОПОЛНИТЕЛЬНЫЙ CSS-блок под статическим селектором', () => {
    const mn = createMn();
    // Токен 'rlv' → класс .rlv; selectors указывает ЕЩЁ добавить .relative-elem
    mn('rlv', () => ({
      style: {
        position: 'relative',
      },
      selectors: ['.relative-elem'],
    }));
    mn.check('rlv');
    mn.compile();
    const c = css(mn);
    // Оба селектора группируются в один блок (bodyMap объединяет по одинаковому телу)
    expect(c).toContain('.rlv,.relative-elem{position:relative}');
  });
});
