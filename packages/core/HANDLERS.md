# Minotation — справочник хендлеров

> ## Не уверены, умеет ли нотация что-то — не гадайте, проверьте
>
> ```bash
> cd packages/minotation/packages/core
> pnpm try 'gtc1fr_auto'
> pnpm try 'cr' 'r0_10_10_0' 'gtc1fr@-760'
> pnpm try 'gtcRepeat\(auto-fit,minmax\(240px,1fr\)\)'   # скобки экранируются
> ```
>
> Скрипт компилирует токен и печатает получившийся CSS вместе с предупреждениями.
> Этот справочник не полон: возможностей в коде больше, чем описано здесь, и они
> регулярно называются не так, как ожидаешь. Вывод «нотация этого не умеет», сделанный
> по памяти или по беглому чтению этого файла, несколько раз оказывался неверным —
> и в CSS уезжали правила, которые прекрасно выражались токеном
> (см. `AGENT_DRAFT/RESEARCH/04_v1-v2-parity-audit-2026-09-23.md`).

Примеры проверены прямыми вызовами `minotationProvider` + `presetStandard` (и где
нужно — `presetSynonyms`/`presetMedias`) против собранного `dist/`, не по тестам —
`presets.test.ts`, на который ссылался этот файл раньше, удалён (заменён на
`css-validation.test.ts` + `preset-standard.test.ts`).

---

## CSS-переменные в значениях

Хендлеры значений принимают `--name` → `var(--name)`, `---name` → `env(--name)`,
`--name,fallback` → `var(--name,fallback)`:

| Токен | CSS |
|-------|-----|
| `w--sidebar` | `width:var(--sidebar)` |
| `c--ink` | `color:var(--ink)` |
| `bg--panel` | `background:var(--panel)` |
| `bc--line` | `border-color:var(--line)` |
| `p--gap` | `padding:var(--gap)` |
| `f--size` | `font-size:var(--size)` |
| `ff--mono` | `font-family:var(--mono)` (с 2026-09-22; раньше давало `font-family:"-mono"`) |
| `lh--tight` | `line-height:var(--tight)` (с 2026-09-22; раньше молча давало `line-height:1`) |
| `o--op` | `opacity:var(--op)` (с 2026-09-22; раньше `opacity:0`) |
| `pt---safe-top` | `padding-top:env(--safe-top)` |

### В составном значении

`_` разделяет части значения, и каждая часть проверяется на переменную отдельно —
поэтому переменные работают и внутри шорткатов (с 2026-09-23; раньше такое значение
уходило в вывод литералом, без предупреждения):

| Токен | CSS |
|-------|-----|
| `ol3px_solid_--marker` | `outline:3px solid var(--marker)` |
| `tn_all_0.2s_--ease` | `transition:all 0.2s var(--ease)` |
| `bxsh_0_0_10px_--shadow` | `box-shadow:0 0 10px var(--shadow)` |
| `font16px/1.55_--font` | `font:16px/1.55 var(--font)` |
| `ol_1px_solid_---safe` | `outline:1px solid env(--safe)` |
| `ff--mono,serif` | `font-family:var(--mono,serif)` (с 2026-09-23; раньше `"-mono",serif`) |

Имя переменной сохраняется как есть и не переводится в kebab-case: `c--myInk` →
`color:var(--myInk)`.

### `_` в имени переменной: терминатор `;`

По умолчанию `_` — разделитель частей, поэтому `--line_soft` разобралось бы как
`var(--line) soft`. Чтобы `_` вошёл в имя, имя закрывают точкой с запятой:

| Токен | CSS |
|-------|-----|
| `ol--border_size;_solid_--marker` | `outline:var(--border_size) solid var(--marker)` |
| `w--my_width;` | `width:var(--my_width)` |
| `p--gap_size;` | `padding:var(--gap_size)` |
| `w--my_w;+5` | `width:calc(var(--my_w) + 5px)` |
| `ol--a_b;_solid_--c_d;` | `outline:var(--a_b) solid var(--c_d)` |

Терминатор необязателен: для имени без `_` (`w--gap` и `w--gap;`) результат одинаков —
его можно ставить всегда, не разбираясь, каким путём разбирается конкретный хендлер.

Экранирование (`\_`) для этого не годится и не поддерживается: обратный слэш снимается
раньше, на разборе токена, и до хендлера не доходит.

### Градиенты (`bg`, `maskbg`): разделитель — дефис

У `bg`/`maskbg` части значения разделяет **дефис**, а не `_` (тот остаётся модификатором).
Имя переменной закрывается `;`, как обычно. Отдаётся два объявления: первый цвет как
fallback и сам градиент.

| Токен | CSS |
|-------|-----|
| `bgF00-00F` | `background:linear-gradient(180deg,#f00 0%,#00f 100%)` |
| `bg0F0-00F` | `background:linear-gradient(180deg,#0f0 0%,#00f 100%)` |
| `bgF00-00F-0F0` | три точки, проценты распределяются сами (`0% / 50% / 100%`) |
| `bg--a;--b;--c` | градиент из трёх переменных |
| `bg--a;-F00-324` | переменная и два цвета вперемешку |
| `bg--my_a;--my_b` | переменные с `_` в имени — терминатор работает и здесь |

Модификаторы (через `_`, в конце): `_g90` — угол (`+90°` к базовым 180°), `_r` — радиальный,
`_rpt` — повторяющийся. `maskbg` — то же самое для `mask-image`.

До 2026-09-23 градиенты для `background` молча не работали: валидатор проверял значение как
чистый цвет и отбраковывал `linear-gradient(…)` целиком.

### Свойства со своим разбором

Переменные работают во всём стандартном пресете — проверяется сплошным прогоном всех
зарегистрированных хендлеров. Стоит знать про две группы, где значение выглядит иначе:

| Токен | CSS |
|-------|-----|
| `bs--v` | `border-style:var(--v)` |
| `pgba--v` | `page-break-after:var(--v);break-after:var(--v)` |
| `bgi--hero` | `background-image:var(--hero)` — переменная подставляется как значение целиком; предполагается, что `url(…)` лежит в ней самой |
| `lisi--v` | `list-style-image:var(--v)` |
| `maski--v` | `mask-image:var(--v)` |

## Формат токена

```
{tag}{arg}           → base
{tag}{arg}:h         → hover
{tag}{arg}.cls       → when element has class .cls
{tag}{arg}@m         → media query
{tag}{arg}<.parent   → inside .parent
```

- **tag** — начальная последовательность строчных латинских букв (`REGEXP_MATCH_NAME`
  в `core/index.ts` останавливается на первом не-строчном символе)
- **arg** — всё остальное (цифры, `-`, `_`, `.`, заглавные буквы, `%`, …)
- `-i` в конце аргумента → `!important`

---

## Экранирование

Символы `< > : . [ ] # + ~` — границы селектора внутри одного токена (родитель, состояние,
self-class, медиа, атрибут-суффикс и т.п., см. разделы ниже). Экранирование через `\`
защищает символ от такой трактовки:

```
cF.active     →  .cF\.active.active{color:#fff}      — точка = self-class, ".active" — условие
cF\.active    →  .cF\\\.active{color:#fff}            — экранированная точка не создаёт условие,
                                                          весь суффикс — буквальная часть токена
```

**Исключение не нужно для `.`/`+` перед цифрой** — оно и так не считается границей:
`f1.5em`/`cF+38` разбираются как есть, без экранирования (`.5`/`+38` — часть аргумента,
десятичное число или числовой суффикс, см. «Self-class условия»,
`AGENT_DRAFT/SPEC/04-grammar-07-self-class.md`). Экранирование нужно только когда следующий
символ — **не цифра** (буква, конец строки и т.п.) и при этом граница НЕ нужна.

**Почему в CSS-селекторе оказывается несколько `\` подряд.** Исходный `\` НЕ вырезается
парсером — он остаётся частью токена и требует своего экранирования как обычный CSS-спецсимвол
(отдельно от точки, которую он защищает). Это осознанно: `cF.active` и `cF\.active` должны
компилироваться в РАЗНЫЙ CSS (с условием `.active` и без) — если бы `\` вырезался, обе записи
после компиляции выглядели бы в HTML одинаково (`class="cF.active"`), и различить их стало бы
невозможно. Поэтому в HTML для экранированной формы `\` пишется буквально:
`class="cF\.active"`.

---

## Цвет (`color()`)

Формат: `{hex}` или `{hex}.{alpha}`

| Токен | CSS |
|-------|-----|
| `cF` | `color:#fff` |
| `cF.38` | `color:rgba(255,255,255,.38)` |
| `cF.75` | `color:rgba(255,255,255,.75)` |
| `c0` | `color:#000` |
| `c0.5` | `color:rgba(0,0,0,.5)` |
| `cF00` | `color:#f00` |
| `c0A0A12` | `color:#0a0a12` |

Hex всегда в нижнем регистре независимо от регистра токена. Alpha в `rgba(...)` — без
ведущего нуля (`.38`, не `0.38`).

Синонимы: `F` = `#fff`, `D` = `#ddd`, `T` = `transparent`, `CT` = `currentColor`.
(`L` синонимом **не является** — `cL` даёт буквальное `color:l`, не `#eee`.)

`color()` ищет последнюю точку → всё после неё = alpha (0–1):
```
F.38      → hex=F → #fff → rgba(255,255,255,.38)
0A0A12.75 → hex=0A0A12 → rgb(10,10,18) → rgba(10,10,18,.75)
```

Той же грамматикой `color()` устроены и другие одноцветные хендлеры:
`olc` (`outline-color`), `bgc` (`background-color`), `temc` (`text-emphasis-color`),
`tdc` (`text-decoration-color`), `thc` (`-webkit-tap-highlight-color` — вендорное
свойство без нестандартного аналога, суффикс `thc0` → `#000`). Формат аргумента и
синонимы (`F`/`D`/`T`/`CT`) — те же, что у `color()` выше.

---

## Значения размеров (`val()`)

| Аргумент | CSS-значение |
|----------|-------------|
| `10` | `10px` |
| `10px` | `10px` |
| `10em` | `10em` |
| `1.5` | `1.5px` |
| `1.5em` | `1.5em` |
| `50%` | `50%` |
| `-50%` | `-50%` |
| `A` | `auto` |
| `N` | `none` |

**`p` НЕ является сокращением для `%`** — `w50p` падает с ошибкой парсинга
(«Unit "p" is invalid»), нужно писать литеральный процент: `w50%`.

---

## Отступы

Именование: **x** = горизонталь (left/right), **y** = вертикаль (top/bottom).

| Токен | CSS |
|-------|-----|
| `p10` | `padding:10px` |
| `px8` | `padding-left:8px;padding-right:8px` |
| `py4` | `padding-top:4px;padding-bottom:4px` |
| `px1.5` | `padding-left:1.5px;padding-right:1.5px` |
| `pt4` | `padding-top:4px` |
| `pb4` | `padding-bottom:4px` |
| `pl4` | `padding-left:4px` |
| `pr4` | `padding-right:4px` |
| `m0` | `margin:0` |
| `mx4` | `margin-left:4px;margin-right:4px` |
| `my12` | `margin-top:12px;margin-bottom:12px` |
| `mxA` | `margin-left:auto;margin-right:auto` |
| `mb8` | `margin-bottom:8px` |
| `mt8` | `margin-top:8px` |
| `mx0` | `margin-left:0;margin-right:0` |

---

## Размеры

| Токен | CSS |
|-------|-----|
| `w` | `width:100%` |
| `w320` | `width:320px` |
| `w50%` | `width:50%` |
| `h75` | `height:75px` |
| `sq32` | `width:32px;height:32px` |
| `sq44` | `width:44px;height:44px` |
| `wmin60` | `min-width:60px` |

---

## Позиционирование

| Токен | CSS |
|-------|-----|
| `fixed` | `position:fixed` |
| `abs` | `position:absolute` |
| `rlv` | `position:relative` |
| `sticky` | `position:sticky` |
| `st16` | `top:16px` |
| `sr16` | `right:16px` |
| `sb24` | `bottom:24px` |
| `sl50%` | `left:50%` |
| `s0` | `top:0;right:0;bottom:0;left:0` |
| `z1200` | `z-index:1200` |

---

## Flex

⚠️ **`fx` — это не `display:flex`.** Флекс-контейнер — `dF`; `fx…` задаёт свойство `flex`
(`fx1` → `flex:1`). Частая ошибка у тех, кто приходит из Tailwind, где `flex` означает display.

`fx` — только `flex`-shorthand (`fx1` → `flex:1`), **не** `display:flex` (для этого — `dF`,
см. Типографику/Display ниже). Без аргумента (`fx` без числа) хендлер не срабатывает —
**всегда указывайте значение** (`fx1`, `fx0_1_Auto`, …).

| Токен | CSS |
|-------|-----|
| `fx1` | `flex:1` |
| `fxdC` | `flex-direction:column` |
| `aiC` | `align-items:center` |
| `aiS` / `aiST` | `align-items:start` / `stretch` |
| `dG` / `dIG` | `display:grid` / `inline-grid` |
| `dFR` / `dCN` | `display:flow-root` / `contents` |
| `aiE` | `align-items:end` |
| `jcE` / `jcS` / `jcSE` | `justify-content:end` / `start` / `space-evenly` |
| `jcC` | `justify-content:center` |
| `jcSB` | `justify-content:space-between` |
| `fxg1` | `flex-grow:1` |
| `fxs0` | `flex-shrink:0` |
| `asST` | `align-self:stretch` |
| `acC` | `align-content:center` |
| `gap2` | `gap:2px` (обе оси) |
| `gapx16` / `gapy8` | `column-gap:16px` / `row-gap:8px` — раздельно по осям (2026-09-22) |
| `fxwW` | `flex-wrap:wrap` |
| `jsC` / `jiC` | `justify-self:center` / `justify-items:center` — grid (2026-09-22) |

`gap` многозначным не бывает (`gap8_16` не работает и не появится — D-003, atomicity):
для разных значений по осям — `gapx`/`gapy`, по образцу `px`/`py` у padding/margin.

`js`/`ji` (`justify-self`/`justify-items`) до 2026-09-22 не существовали вовсе — добавлены
при аудите покрытия свойств; буквы согласованы с `jc`/`ai`/`as`/`ac` (см. таблицу ниже),
плюс `L`/`R` (left/right) и `A`/`LG` (auto — только `js`; legacy — только `ji`).

**Карты синонимов `jc`/`ai`/`as`/`ac`/`js`/`ji` — разные объекты** (общей таблицы `alignVal` не существует),
но с 2026-09-22 одинаковые буквы означают одно и то же:

| Токен | `jc` | `ai` | `as` | `js` | `ji` |
|-------|------|------|------|------|------|
| `C` | Center | Center | Center | Center | Center |
| `FE` | FlexEnd | FlexEnd | FlexEnd | — | — |
| `FS` | FlexStart | FlexStart | FlexStart | — | — |
| `SA` | SpaceAround | — | — | — | — |
| `SB` | SpaceBetween | — | — | — | — |
| `B` | — | Baseline | Baseline | Baseline | Baseline |
| `S` | Start | Start | Start | Start | Start |
| `ST` | Stretch | Stretch | Stretch | Stretch | Stretch |
| `E` | End | End | End | End | End |
| `SE` | SpaceEvenly | SelfEnd | SelfEnd | SelfEnd | SelfEnd |
| `SS` | — | SelfStart | SelfStart | SelfStart | SelfStart |
| `N` | Normal | Normal | Normal | Normal | Normal |
| `A` | — | — | Auto | Auto | — |
| `L`/`R` | Left/Right | — | — | Left/Right | Left/Right |
| `LG` | — | — | — | — | Legacy |

Набор коротких форм пополнен 2026-09-22 современными значениями CSS (`dG`, `dIG`, `dFR`, `dCN`,
`aiE`, `aiS`, `aiN`, `aiSS`, `aiSE`, `jcE`, `jcS`, `jcSE`, `jcN`, `jcST`, `jcL`, `jcR`,
`acSE`, `acN`, `acB`). **Ломающее изменение той же даты:** `aiS` теперь `start` (было `stretch`) —
буква `S` во всех четырёх свойствах значит одно и то же; `align-items:stretch` — это `aiST`.

Буква, которой нет ни в одной карте, больше **не** падает в буквальный `toKebabCase`
(`jcQ` дал бы `justify-content:q`) — такое значение бракуется с предупреждением
`invalid-css-value`, см. `isUnresolvedSynonym` в `cssGrammar.ts`.

⚠️ **Известная проблема** (не входит в эту документацию, зафиксировано в `PLAN.md`):
`fx0_1_Auto` и подобные значения с заглавной буквой внутри multi-value ломаются —
`toKebabCase` вставляет `-` перед заглавной буквой, считая её началом camelCase, а не
началом отдельного ключевого слова. Не используйте заглавные буквы в multi-value
аргументах `fx`/`fxw` до починки.

---

## Типографика

| Токен | CSS |
|-------|-----|
| `f12` | `font-size:12px` |
| `f14` | `font-size:14px` |
| `f22` | `font-size:22px` |
| `fw5` | `font-weight:500` |
| `fw600` | `font-weight:600` (значение CSS как есть; с 2026-09-22 — раньше давало `900`) |
| `fwBold` | `font-weight:bold` |
| `lh1.5` | `line-height:1.5` — безразмерный множитель, как в CSS |
| `lh1` | `line-height:1` |
| `lh20px` | `line-height:20px` — единица указывается явно |
| `lh1.2em` | `line-height:1.2em` |
| `lh150%` | `line-height:150%` — единица проходит как написана |
| `lh--tight` | `line-height:var(--tight)` |
| `lts2` | `letter-spacing:2px` |
| `lts1.5` | `letter-spacing:1.5px` |
| `lts0.06em` | `letter-spacing:0.06em` (единицу указывать можно) |
| `ltsN` | `letter-spacing:normal` |
| `ttU` | `text-transform:uppercase` |
| `taC` | `text-align:center` |
| `taR` | `text-align:right` |
| `taL` | `text-align:left` |
| `dB` | `display:block` |
| `dN` | `display:none` |
| `dF` | `display:flex` |
| `crP` | `cursor:pointer` |
| `usN` | `user-select:none` |

Значения с единицами (`lts0.06em`, `lts-0.02em`) и синоним `ltsN` до 2026-09-22 браковались
валидатором как «битое CSS-значение» — исправлено (`isSpacingValue` в `cssGrammar.ts`).

**`line-height` — единственное свойство, где голое число НЕ означает пиксели**: как и в CSS,
это безразмерный множитель (`lh1.5` → `1.5`), потому что потомки наследуют коэффициент, а не
фиксированную высоту. Любая единица пишется явно и попадает в CSS как есть — `lh20px`,
`lh1.2em`, `lh150%`.

Изменено 2026-09-22, две правки за раз: (1) голое число больше не получает `px` — `lh1` давало
`line-height:1px`, строку высотой в пиксель; (2) проценты больше не пересчитываются в множитель —
`lh150%` давало `1.5`, то есть на один результат приходилось два способа записи, причём с подменой
смысла: `150%` наследуется вычисленным значением, а `1.5` — коэффициентом.

`letter-spacing`, наоборот, приведён к общему правилу: `lts2` → `2px`, `lts0.06em` → `0.06em`
(раньше выводилось без единицы — невалидный CSS). 

Text-align — тег `ta` + буква (`taC`/`taR`/`taL`/`taJ`/`taE`/`taS`), а **не** отдельные
теги `tc`/`tr`/`tl` — их не существует, токен просто не даёт CSS без ошибки.


⚠️ **Не документировано до 2026-09-22.** Теги `td`/`tdc`/`tds…`/`tem…` существовали в коде,
но не были описаны в этом справочнике — найдено при аудите покрытия свойств.

### Text-decoration / text-emphasis / text-underline

| Токен | CSS |
|-------|-----|
| `tdU` | `text-decoration:underline` (значения из карты `TD_SYNONYMS`: `N`one, `U`nderline, `O`verline, `L`ineThrough) |
| `tdlL` | `text-decoration-line:line-through` (та же карта `TD_SYNONYMS`, отдельное свойство) |
| `tdc--accent` | `text-decoration-color:var(--accent)` |
| `tdstDotted` | `text-decoration-style:dotted` — добавлено 2026-09-22 |
| `tdsNone` | `text-decoration-skip:none` |
| `tdsiAuto` | `text-decoration-skip-ink:auto` |
| `tdt2px` | `text-decoration-thickness:2px` |
| `tuo2px` | `text-underline-offset:2px` — добавлено 2026-09-22 |
| `tupFromFont` | `text-underline-position:from-font` — добавлено 2026-09-22 |
| `temNone` | `text-emphasis:none` (значение — суффикс целиком, passthrough; без суффикса хендлер не срабатывает) |
| `temcF00` | `text-emphasis-color:#f00` |
| `tempOver` | `text-emphasis-position:over` |
| `tems_Filled_Dot` | `text-emphasis-style:Filled Dot` — ведущий `_` даёт пробелы вместо дефисов (без него `temsFilledDot` даст ошибочное `filled-dot`) |

`td`/`tdl` — **не пишите произвольное значение**, только буквы из `TD_SYNONYMS` (`N`/`U`/`O`/`L`);
остальные хендлеры этой группы (`tdc`, `tds…`, `tem…`) — обычный camelCase/snakeCase passthrough
без карты синонимов, как `apc`/`bga`/`ff`.

---

## Цвет фона / фон

По умолчанию `altColor` включён — background/color-хендлеры выводят **и** hex, **и**
`rgba(...)` (браузерный fallback), даже если запрошена только rgba-форма. Чтобы получить
только `rgba(...)`, нужно явно передать `altColor: 'off'` в опции `minotationProvider`.

| Токен | CSS (default, `altColor` не задан) |
|-------|-----|
| `bg0` | `background:#000` |
| `bgF` | `background:#fff` |
| `bgF.1` | `background:rgba(255,255,255,.1)` |
| `bg0A0A12.75` | `background:rgba(10,10,18,.75)` |
| `bg0A0A12.88` | `background:rgba(10,10,18,.88)` |
| `bgcF.12` | `background-color:rgba(255,255,255,.12)` |
| `bgcF.15` | `background-color:rgba(255,255,255,.15)` |
| `bgcF.28` | `background-color:rgba(255,255,255,.28)` |

С `altColor: 'off'`: `bgF.1` → только `background:rgba(255,255,255,.1)`.

---

## Граница

Граница задаётся **тремя отдельными токенами**, не одним compound:

```
border: '1px solid rgba(255,255,255,0.1)'
→  b1  bsS  bcF.1
```

| Токен | CSS |
|-------|-----|
| `b1` | `border-width:1px` |
| `bsS` | `border-style:solid` |
| `bcF.1` | `border-color:rgba(255,255,255,.1)` (см. `altColor` выше) |

Паттерн сторон: суффикс `l/r/t/b` к каждому из трёх токенов:

| Сторона | width | style | color |
|---------|-------|-------|-------|
| все | `b1` | `bsS` | `bcF.1` |
| left | `bl1` | `bslS` | `bclF.12` |
| right | `br1` | `bsrS` | `bcrF.1` |
| top | `bt1` | `bstS` | `bctF.1` |
| bottom | `bb1` | `bsbS` | `bcbF.08` |

```
border-left:   '1px solid rgba(255,255,255,0.12)'  →  bl1  bslS  bclF.12
border-top:    '1px solid rgba(255,255,255,0.1)'   →  bt1  bstS  bctF.1
border-bottom: '1px solid rgba(255,255,255,0.08)'  →  bb1  bsbS  bcbF.08
```

**Не поддерживается:** несколько цветов в одном `bc`-токене (`border-color` умеет
это по CSS-спецификации — до 4 значений по сторонам, как `padding`, но здесь
хендлер всегда красит все стороны ОДНИМ цветом). До 2026-09-23 непонятый суффикс
(`bcF00_0F0`) молча заменялся на чёрный (`bc0`, дефолт-алиас) без предупреждения —
исправлено: любой непустой суффикс, который не удалось разобрать, бракует токен
целиком (essence не даёт CSS). Пустой суффикс (`bc` без ничего) — по-прежнему
легитимный дефолт (`border-color:currentColor`).

---

## Border-radius

| Токен | CSS |
|-------|-----|
| `r` | `border-radius:10000px` (полный круг — умолчание, не 9999) |
| `r1` | `border-radius:1px` |
| `r4` | `border-radius:4px` |
| `r8` | `border-radius:8px` |

---

## Box-sizing

| Токен | CSS |
|-------|-----|
| `bxzBB` | `box-sizing:border-box` |
| `bxzCB` | `box-sizing:content-box` |

---

## Box-shadow

Формат: `bxsh{blur}[X{offsetX}][Y{offsetY}][R{spread}][c{hex}][In]` — модификаторы можно
комбинировать в любом порядке внутри одного суффикса.

| Токен | CSS |
|-------|-----|
| `bxsh18` | `box-shadow:0px 0px 18px 0px #000` |
| `bxsh19r3` | `box-shadow:0px 0px 19px 3px #000` (`r`/`R` — spread) |
| `bxsh19c43F` | `box-shadow:0px 0px 19px 0px #43f` |
| `bxsh19r3c43F` | `box-shadow:0px 0px 19px 3px #43f` |
| `bxsh19x5y5r3c43F` | `box-shadow:5px 5px 19px 3px #43f` |
| `bxsh10in` | `box-shadow:inset 0px 0px 10px 0px #000` |

⚠️ Буква `r`/`R` внутри `bxsh…` означает **spread**, а не `border-radius` (тот — отдельный тег `r`).

**Inset**: модификатор — **строчный** `in`: `bxsh10in` → `box-shadow:inset 0px 0px 10px 0px #000`.
Заглавный `In` модификатором не является (`bxsh10In` → без inset) — так же, как в v1
(уточнено 2026-09-17 по примеру владельца; прежняя формулировка «не применяется ни в каком
сочетании» проверяла только заглавную форму).
Изолированный `r`/`R`-модификатор БЕЗ ведущего числа (`bxshR3` — суффикс состоит только из
spread, без blur) раньше давал мусор в позиции blur (`box-shadow:0px 0px Rpx 3px #000`, где
`Rpx` — буквальная строка; то же поведение было унаследовано из оригинала v1, не регрессия
этого порта). **С 2026-09-04** такой мусор ловится проверкой валидности CSS-вывода
(`REGEXP_INVALID_CSS_VALUE`, `core/utils.ts`) — essence бракуется целиком (CSS не эмитится),
в `mn.warnings$`/`onWarning` уходит `'invalid-css-value'`-предупреждение. Всегда указывайте
blur первым числом.

Аналогично устроен `tsh` (`text-shadow`), но **без spread** — `SHADOW_HANDLERS.tsh` не
включает `r` в сборку строки, `tsh10r2c00F` → `text-shadow:0px 0px 10px #00f` (spread
молча отбрасывается на уровне самого хендлера, это не баг — так и в v1).

---

## Переходы / анимация

| Токен | CSS |
|-------|-----|
| `dn` | `transition-duration:250ms` |
| `dn150` | `transition-duration:150ms` |
| `dn200` | `transition-duration:200ms` |
| `dn300` | `transition-duration:300ms` |

`transition-property` по умолчанию — `all` (CSS-умолчание). Для большинства кейсов достаточно просто `dn200` без уточнения отдельных свойств.

---

## Фильтры

Формат аргумента: `{CamelCase имя функции}{число}[единица]`

| Токен | CSS |
|-------|-----|
| `ftBlur10` | `filter:blur(10px)` |
| `ftBlur4` | `filter:blur(4px)` |
| `ftGrayscale100` | `filter:grayscale(100)` (без `%`) |
| `ftBrightness150` | `filter:brightness(150)` (без `%`) |

Тег `ftb` = `backdrop-filter`:

| Токен | CSS |
|-------|-----|
| `ftbBlur8` | `backdrop-filter:blur(8px)` |
| `ftbBlur10` | `backdrop-filter:blur(10px)` |
| `ftbBlur12` | `backdrop-filter:blur(12px)` |

Единицы по умолчанию: `blur` → `px`, `hue-rotate` → `deg`, остальное — **без единицы**
для одиночного вызова (см. `ftGrayscale100`/`ftBrightness150` выше).

Несколько функций через `_` — в этой форме единица `%` уже появляется:
`ftBlur3_Invert20` → `filter:blur(3px) invert(20%)`.

---

## Transform

Весь transform — через один хендлер `x` с единым мини-DSL в аргументе (не отдельные
`translateX`/`translateY`/`scale`/`rotate` вызовы — `translate(x,y)` **всегда**
присутствует как база, даже если x/y не заданы):

```
x{число}[%][Y{число}[%]][Z{число}[%]][S{число}][R{x|y|z}{число}{unit}]
```

| Токен | CSS |
|-------|-----|
| `x-50%` | `transform:translate(-50%,0px)` |
| `xY-50%` | `transform:translate(0px,-50%)` |
| `xS150` | `transform:translate(0px,0px) scale(1.5)` |
| `xRz70` | `transform:translate(0px,0px) rotateZ(70deg)` |
| `xRx-60` | `transform:translate(0px,0px) rotateX(-60deg)` |
| `x50Y30S150Rz45` | `transform:translate(50px,30px) scale(1.5) rotateZ(45deg)` |

**`S{n}` — это `n / 100`, не буквальный множитель CSS `scale()`**: `xS150` → `scale(1.5)`,
не `xS1.5` (это даст `scale(0.015)` — `1.5 / 100`). Направление у `R` — строго одна из
строчных букв `x`/`y`/`z` сразу после `R`.

---

## Misc

| Токен | CSS |
|-------|-----|
| `ov` | `overflow:hidden` |
| `ovyA` | `-webkit-overflow-scrolling:touch;overflow-y:auto` |
| `contrast` | `image-rendering:optimize-contrast;image-rendering:-webkit-optimize-contrast` |
| `ratio3x2` | `padding-top:66.67%` + `>*{position:absolute;top:0;right:0;bottom:0;left:0}` (было `66.66%` до фикса `toFixed`, RESEARCH/05, 2026-09-23) |

---

## Custom properties (`var()` / `env()`)

Объявление — токен `--имя=значение`; подстановка — `--имя` на месте аргумента любого
числового хендлера, три дефиса — `env()`. Работает как в v1 (сверено 2026-09-17).

| Токен | CSS |
|-------|-----|
| `--v=10px` | `--v:10px` |
| `w--v` | `width:var(--v)` |
| `w---width` | `width:env(--width)` |
| `w--v,10px` | `width:var(--v,10px)` (fallback) |
| `h--v+5` | `height:var(--v+5)` |

---

## Медиа-запросы

⚠️ Задокументировано только 2026-09-23 — само поведение существовало и было полностью рабочим
(и в основном покрыто тестами, `media-templates.test.ts`) намного раньше, просто без единой
строки в `HANDLERS.md` (см. `AGENT_DRAFT/RESEARCH/04_v1-v2-parity-audit-2026-09-23.md`,
`RESEARCH/05_v1-v2-behavioral-discrepancies-2026-09-23.md`). Два способа задать медиа-условие
после `@`, оба работают ОДНОВРЕМЕННО, второй не отменяет первый:

### 1. Именованное медиа — `@имя`

Имя ищется в `options.media`/`mn.media` (регистрируется через `presetMedias` или вручную).
Если имя не найдено — см. п. 2 (может оказаться шаблоном диапазона), а если и не шаблон —
имя используется как ЛИТЕРАЛЬНЫЙ `@media`-запрос (см. `p10@x` в таблице ниже — `x` не входит
ни в один пресет и не подходит под шаблон диапазона, поэтому остаётся как есть).

```typescript
mn.media.dark = { query: '(prefers-color-scheme: dark)' };
```

Таблица ниже (и следующая) показывает только само CSS-объявление внутри правила — реальный
вывод оборачивает его в `@media {...}` и класс-селектор целиком (`@media x{.p10\@x{padding:10px}}`).

| Токен | CSS |
|-------|-----|
| `p10@x` | `padding:10px` (нераспознанное имя `x` — используется как `@media x` буквально) |

`presetMedias` уже регистрирует готовый набор: `m`/`m2`/`m3` (мобильные брейкпоинты, max-width
991.98/767.98/639.98px), `d`/`d2` (десктоп, min-width), `mouse` (`(pointer: fine) and
(hover: hover)` — то же условие, что неявно используется в `:h`, см. «Состояния и контекст»),
`dark`/`light` (`prefers-color-scheme`) и другие — полный список в `src/presets/medias.ts`.

### 2. Диапазон прямо в токене — `@{width}x{height}^{priority}`

Если имя НЕ найдено в `options.media`, оно проверяется на соответствие шаблону диапазона
(`parseMediaTemplate`, `core/index.ts`) — если подходит, `@media` строится из чисел без
какой-либо предварительной регистрации. Формат сегмента (для ширины и для высоты независимо):

```
пусто        →  условие для этой оси не добавляется
N            →  max-*: Npx           (голое число = верхняя граница)
N-           →  min-*: Npx           (число с хвостовым дефисом = нижняя граница)
N-M          →  min-*: Npx И max-*: Mpx
```

Полная форма — `{ширина}x{высота}`, `x`-часть (высота) не обязательна. Хвостовой `^N`
(после всего шаблона, до его разбора) задаёт приоритет явно — если не указан, приоритет
выводится из max-значения автоматически (шире диапазон — ниже приоритет).

| Токен | CSS (объявление) | Получившийся `@media` |
|-------|-------------------|------------------------|
| `f20@768` | `font-size:20px` | `(max-width: 768px)` |
| `f20@-768` | `font-size:20px` | `(max-width: 768px)` (ведущий `-` — тот же результат, что и голое число) |
| `f30@992-` | `font-size:30px` | `(min-width: 992px)` |
| `f50@1000-1200` | `font-size:50px` | `(min-width: 1000px) and (max-width: 1200px)` |
| `f40@x600` | `font-size:40px` | `(max-height: 600px)` |
| `f3@x10-60` | `font-size:3px` | `(min-height: 10px) and (max-height: 60px)` |

Полный пример — ширина и высота диапазоном одновременно, плюс явный приоритет:

```
f20@768-992x300-600^2
→ @media (min-width: 768px) and (max-width: 992px) and (min-height: 300px) and (max-height: 600px){font-size:20px}
```

Шаблон диапазона сочетается с остальными частями токена как обычно — родителем (`<.parent`),
состоянием (`:hover`), группой (`(a|b)`) — все они разбираются независимо от того, именованное
это медиа или шаблон:

```
p10@600<.parent      → .parent { @media (max-width: 600px) { .селектор{padding:10px} } }
p10:hover@600        → @media (max-width: 600px) { .селектор:hover{padding:10px} }
(p10|m5)@600-900     → @media (min-width: 600px) and (max-width: 900px) { оба тела в одном блоке }
```

---

## Состояния и контекст

```
bgF.1:h              → background on :hover
cF.38.paused         → color when element has class "paused"
bgcF.12.active       → background-color when element has class "active"
```

| Токен | CSS |
|-------|-----|
| `bgF.1:h` | `.bgF\.1\:h:hover{background:rgba(255,255,255,.1)}` — внутри `@media (pointer: fine) and (hover: hover)`: `:h` = `:hover@mouse`, как в v1 (восстановлено 2026-09-17) |
| `cF.38.paused` | `.cF\.38\.paused.paused{color:rgba(255,255,255,.38)}` |
| `bgcF.12.active` | `.bgcF\.12\.active.active{background-color:rgba(255,255,255,.12)}` |

### Параметризованные состояния `:state[args]`

`[args]` после `:state` превращается в круглые скобки CSS-функции — для параметризованных
псевдоклассов (`:nth-child()`, `:nth-of-type()` и т.п.):

| Токен | CSS |
|-------|-----|
| `p10:nth-child[2n]` | `.p10\:nth-child\[2n\]:nth-child(2n){padding:10px}` |

### Атрибут-селектор как суффикс — `[attr=val]`

⚠️ Существовало ещё в v1 (`old/minimalist-notation/docs-ru.md`, раздел «Complex selectors»),
перенесено в `HANDLERS.md` только 2026-09-23 (см. `AGENT_DRAFT/RESEARCH/04_v1-v2-parity-audit-2026-09-23.md`).
`[attr=val]` в конце токена (без предшествующего `:state`) добавляется к селектору как
самостоятельный CSS-атрибут-селектор — работает как второе, независимое условие наравне с
`.cls`:

| Токен | CSS |
|-------|-----|
| `bg--ink[aria-pressed=true]` | `.bg--ink\[aria-pressed\=true\][aria-pressed=true]{background:var(--ink)}` |

Как и с `.cls` — в HTML класс должен присутствовать **буквально целиком**, включая скобки:
`class="bg--ink[aria-pressed=true]"`. Полезно для условий, завязанных на ARIA/data-атрибуты
без JS-переключения класса — браузер сам реагирует на изменение атрибута.

### Реестр `mn.states` — именованные группы состояний

`mn.states` — публичное, ничем не заполненное по умолчанию расширение: можно объявить
собственные короткие имена, разворачивающиеся в НЕСКОЛЬКО псевдоклассов сразу (в отличие от
`mn.synonyms`/`presetSynonyms`'s `h`/`f`/`a`, которые дают ровно один псевдокласс на синоним):

```typescript
mn.states = { interactive: [':hover', ':focus'] };
```

```
mn.getCompiler('class')('p10:interactive');
mn.compile();
→ .p10\:interactive:focus,.p10\:interactive:hover{padding:10px}
```

Имя не из `mn.states` остаётся литеральным псевдоклассом как есть (`p10:checked` →
`:checked{padding:10px}`) — `mn.states` не обязателен, просто способ сократить часто
повторяющуюся комбинацию состояний до одного имени.

⚠️ Пример выше не входит в таблицу «Токен → CSS» намеренно: он требует предварительной
настройки (`mn.states = {...}`) на конкретном инстансе, которую автоматический тест
`handlers-doc.test.ts` не воспроизводит (компилирует только с пресетами, без кастомных
`mn.states`) — не путать с примерами из таблиц, где голого токена достаточно.

**Паттерн модификатора:** токен с `.cls` всегда статически присутствует в className,
а сам класс `cls` добавляется условно.

```tsx
// правильно: оба токена статически видны сканеру
className={`cF cF.38.paused ${musicPaused ? 'paused' : ''}`}

// работает и так — mnVite/mnWebpack теперь сканируют и template literals,
// но динамическая часть (${...}) из строки вырезается перед разбором на токены,
// поэтому сам токен-модификатор ('cF.38.paused') всё равно должен быть виден
// как ЛИТЕРАЛЬНЫЙ текст где-то в файле — просто вставить его целиком внутрь
// ${...} недостаточно
className={`${musicPaused ? 'cF.38.paused' : 'cF'}`}
```

### Пример замены MUI `sx` на MN

```tsx
// Было:
sx={{
  mt: 1, mx: 0, width: '100%', boxSizing: 'border-box',
  px: 1.5, py: 0.75, borderRadius: 1, border: '1px solid',
  borderColor: active ? 'rgba(120,180,255,0.35)' : 'rgba(255,255,255,0.12)',
  bgcolor:     active ? 'rgba(80,140,255,0.1)'   : 'rgba(255,255,255,0.04)',
  transition: 'border-color 0.2s, background-color 0.2s',
}}

// Стало:
className={`mt1 mx0 w bxzBB px1.5 py0.75 r1 b1 bsS dn200
  bcF.12 bgF.04 bc78B4FF.35.perParticle bg508CFF.1.perParticle ${active ? 'perParticle' : ''}`}
```

---

## Группировка `(a|b)` и множитель `*N`

⚠️ Существовало ещё в v1 (`old/minimalist-notation/docs-ru.md`, раздел «Grouping»), перенесено
в `HANDLERS.md` только 2026-09-23 (см. `AGENT_DRAFT/RESEARCH/04_v1-v2-parity-audit-2026-09-23.md`) —
до этого было покрыто тестами (`variant-groups.test.ts`, 376 строк) и не задокументировано вовсе.

`(a|b)` в любом месте токена разворачивается в НЕСКОЛЬКО CSS-объявлений сразу — но
**в один и тот же буквальный CSS-селектор**: сам токен (со скобками и `|`) — это ровно то,
что должно стоять в `class="..."` в HTML. Ничего не подставляется/не переписывается —
группировка влияет только на то, сколько хендлеров/свойств задействовать для одного и того же
литерального класса, а не на то, какие отдельные классы можно написать в разметке:

```
(bg|bc)F00         → .\(bg\|bc\)F00{background:#f00}.\(bg\|bc\)F00{border-color:#f00}
(bg|bc)F00.active  → .\(bg\|bc\)F00\.active.active{background:#f00}
                      .\(bg\|bc\)F00\.active.active{border-color:#f00}
```

⚠️ Эти два примера намеренно даны блоком кода, а не таблицей «Токен → CSS»: реальный `|`
внутри markdown-таблицы пришлось бы экранировать как `\|` (синтаксис самого Markdown) — а этот
же символ `\` минотация трактует КАК СВОЙ СОБСТВЕННЫЙ экранирующий символ (см. «Экранирование»
выше) и перестаёт видеть `|` как границу группы. Табличная форма с `\|` компилировалась бы в
буквальный, неразвёрнутый токен — не в то, что показано здесь. Найдено на этом же материале
2026-09-23 (см. `RESEARCH/04_v1-v2-parity-audit-2026-09-23.md`) — сохранено как явное
предупреждение, чтобы не повторить.

Реальная польза — именно во втором примере: без группировки пришлось бы писать
`bgF00.active bcF00.active` (суффикс `.active` дублируется на каждую ветку). С группировкой
общий суффикс (`.cls`, `[attr=val]`, `:state`, `@media`, `<parent`) пишется один раз — чем он
длиннее, тем больше экономия. Голая группировка без общего суффикса (`(bg|bc)F00`) почти
бесполезна: запись не короче, а `(`/`|`/`)` в `class="..."` — нестандартно.

Группируется тег (`(bg|bc)F00`), значение (`p(10|20|30)`), состояние (`:(h|a)`), и вложенно
(`(p(10|20)|m5)`). Множитель `*N` в конце токена повторяет селектор N раз (составной
`.cls.cls`-селектор — редкий кейс для перебивания специфичности другого правила):

| Токен | CSS |
|-------|-----|
| `p10*2` | `.p10\*2.p10\*2{padding:10px}` |

Полная грамматика и больше примеров (вложенность, `@media`+группа, родительский контекст+
группа, `m-n`/`id`-атрибуты) — `AGENT_DRAFT/SPEC/12-variant-groups-css-output.md`,
`AGENT_DRAFT/SPEC/04-grammar-01-groups-variants.md`, `AGENT_DRAFT/SPEC/04-grammar-05-multiplier.md`
(черновики, но реализация уже соответствует им и покрыта тестами).

---

## Auto-префиксы (`presetPrefixes`)

⚠️ Существовало в v1 (раздел «Auto prefixes»), в v2 подключено, экспортируется, покрыто
тестами (`preset-prefixes.test.ts`) — но было не задокументировано вовсе до 2026-09-23.

Отдельный опциональный пресет (не входит в `presetStandard`, подключается явно) — добавляет
`-webkit-`/`-moz-` дубли для заранее заданного списка CSS-свойств (`transform`,
`flex-direction` и прочие flex-свойства, `backdropFilter`, `backgroundClip`, `appearance`
(только `-webkit-`), `userSelect`, `pointerEvents`, `transitionDuration` и др.):

```typescript
import { minotationProvider, presetStandard, presetPrefixes } from 'minotation';
const mn = minotationProvider({ presets: [presetStandard, presetPrefixes] });
```

```
fxdC   → .fxdC{-webkit-flex-direction:column;-moz-flex-direction:column;flex-direction:column}
apcNone → .apcNone{-webkit-appearance:none;appearance:none}   (без -moz-appearance)
ov     → .ov{overflow:hidden}   (вне списка — без префиксов)
```

Список префиксуемых свойств расширяется через `propertiesStringify.prefixedAttrs` (см.
`src/presets/prefixes.ts`) — не входит в объём этого документа, читать исходник при
необходимости добавить новое свойство.

---

## Динамические пресеты (`*.mn.ts`)

Пресет можно подключить **прямо из кода приложения**, как обычный side-effect импорт:

```tsx
// src/main.tsx
import './mn/preset.mn';   // подключается как side-effect
```

Сборочный плагин (minotation-vite / minotation-webpack) перехватывает файл по расширению (`.mn.ts`, `.mn.js`, `.mn.tsx`), выполняет пресет-функцию на внутреннем mn-инстансе и возвращает в бандл пустой ES-модуль — **в рантайм ничего не попадает**.

### Формат файла пресета

```ts
// src/mn/app.mn.ts
import type { MnInstance } from 'minotation';

export function presetApp(mn: MnInstance): void {
  mn('card', () => ({ style: { borderRadius: '8px' } }));
  mn.setKeyframes('pulse', {
    '0%, 100%': { opacity: '0.6' },
    '50%':      { opacity: '1'   },
  });
}
```

Плагин ищет дефолтный экспорт (`export default`) или первую функцию среди named-экспортов.

### HMR в dev-режиме

При изменении `*.mn.ts`-файла:
1. Плагин перезагружает пресет.
2. Создаёт свежий mn-инстанс с обновлёнными пресетами + всеми накопленными токенами.
3. Отправляет новый CSS через WebSocket (событие `mn:update`).
4. Браузер обновляет `<style data-mn>` без перезагрузки.

Токены из других файлов приложения **не теряются** — `fileTokens` Map персистентен между пересборками.

### Конфигурация в vite.config.ts

Статические пресеты (базовый набор) передаются через `presets: [...]`.  
Динамические пресеты в `*.mn.ts` **не нужно** перечислять в конфиге — они подхватываются автоматически:

```ts
// vite.config.ts
mnVite({
  attr: 'className',
  extensions: ['.tsx', '.jsx'],
  presets: [presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain],
  // presetExtensions: ['.mn.ts', '.mn.js', '.mn.tsx'],  // дефолт — менять не нужно
})
```

---

## Shorthand с несколькими значениями

Значения через `_` — по CSS-правилу «1–4 значения» (`padding`/`margin`/`border-width`/
`border-radius`/`border-color`; `gap`/`grid-gap`/`border-spacing` — до двух). Пять и больше —
отбраковка. Сверено с v1 2026-09-17 (до этого валидатор v2 ошибочно бракал такие токены).

| Токен | CSS |
|-------|-----|
| `p10_20` | `padding:10px 20px` |
| `p1_2_3_4` | `padding:1px 2px 3px 4px` |
| `m0_auto` | `margin:0 auto` |
| `p10_20-5` | `padding:10px calc(20px - 5px)` |
| `r4_8_12_16` | `border-radius:4px 8px 12px 16px` |
| `b1_2` | `border-width:1px 2px` |

---

## Дочерние эссенции `x.y`

`mn('tbl.cell', { selectors: ['>*'], style: {…} })` — дочерняя часть эссенции `tbl`:
при компиляции токена `tbl` правило для `.tbl>*` добавляется автоматически, важность и
медиа родителя наследуются. Восстановлено 2026-09-17 (регрессия миграции на кортежи).

| Токен | CSS |
|-------|-----|
| `tbl` | `display:table` + `.tbl>*{display:table-cell;vertical-align:middle}` |

---

## Валидация CSS-значений

Помимо универсальной эвристики `REGEXP_INVALID_CSS_VALUE` (см. Box-shadow выше) —
с **2026-09-05** для ~40 CSS-свойств, которые ядро само формирует из числового/
цветового ввода (не пропускает пользовательский текст насквозь), действует
строгая per-свойству грамматика (`cssGrammar.ts`): `padding`/`margin`/`width`/
`height`/`top`/`right`/`bottom`/`left`/`border-radius`/`gap`/`flex-basis` —
длина/проценты/`calc()`/`auto`; `border-*-color`/`background(-color)`/`color`/
`outline-color`/`fill`/`stroke` — hex/`rgba()`/CSS-идентификатор (именованные
цвета типа `red`, keyword-значения типа `invert` не enum'ятся отдельно —
идентификатор-по-форме уже достаточно узкий фильтр); `opacity`/`z-index`/
`order`/`flex-grow`/`flex-shrink`/`font-weight` — число/integer; `border-width`/
`outline-width` — длина или `thin`/`medium`/`thick`; `transition-duration`/
`transition-delay` — время (`s`/`ms`); `line-height` — длина или голое число
(из `%`-ввода). Свойства ВНЕ этого набора (в основном permissive
camelCase/snakeCase pass-through хендлеры — `apc`, `bga`, `ff`, `td` и т.п.)
по-прежнему проверяются только универсальной эвристикой — строгий enum для
них означал бы заново изобретать сознательно permissive дизайн этих хендлеров.
Подстановки `var(...)`/`env(...)` валидны для любого свойства и грамматикой не
проверяются (с 2026-09-17; до этого валидатор ошибочно браковал `w--v` — регрессия
против v1, найдена по примеру владельца). Детали и обоснование границ — JSDoc
`core/src/cssGrammar.ts`.

---

## `strict` — жёсткий отказ вместо `console.warn`

По умолчанию (`onWarning: 'console'`, `strict` не задан) битый токен — неизвестный
хендлер, невалидное CSS-значение, превышение `maxDepth` в режиме `'block'` — не
роняет сборку: предупреждение уходит в `console.warn`/`mn.warnings$`, сам токен
просто не даёт CSS-правила (warn-and-continue). Опция `MnOptions.strict: true`
меняет это на throw-and-fail-build: если за цикл `mn.compile()` накоплен хотя бы
один `MnWarning`, `compile()` бросает `MnStrictError` (после того как вся обычная
работа компиляции уже сделана — `styles$` успевает обновиться, `onWarning`
по-прежнему вызывается как обычно, `strict` не подменяет его, а добавляет отказ
поверх).

```typescript
// Библиотека: strict: false по умолчанию.
const mn = minotationProvider({ presets: [presetStandard] });

// Наша сборка: включаем строгую проверку явно.
const mn = minotationProvider({ presets: [presetStandard], strict: true });
mn.getCompiler('class')('totally-unknown-xyz');
mn.compile(); // → throw MnStrictError: "MN strict: 1 warning(s) during compile: ..."
```

**Почему по умолчанию `false`.** Токены минотации — обычные CSS-классы по форме
(`p10`, `dF`, `uChip`), и на реальной разметке они массово соседствуют с классами
сторонних библиотек, семантическими маркерами, BEM-классами и т.п. — статический
сканер (`minotation-vite`/`minotation-astro`) пытается скомпилировать ЛЮБОЙ токен
в атрибуте `class`, поэтому "неизвестный хендлер" — ожидаемый, частый и почти
всегда безвредный случай в общем проекте. `strict: true` уместен только там, где
состав токенов контролируется полностью (например, свой сайт на минотации без
сторонних CSS-фреймворков) — там ложных срабатываний нет, а реальная опечатка
в токене стоит того, чтобы уронить сборку, а не тихо потерять CSS-правило.

**Build-плагины.** `minotation-vite`/`minotation-astro` не оборачивают
`mn.compile()` в try/catch — `MnStrictError`, брошенный из `generateBundle`/
`transformIndexHtml`, доходит до Vite/Rollup/Astro как обычная ошибка плагина и
роняет сборку штатным образом. Включается через вложенную опцию `mn`:

```javascript
// astro.config.mjs / vite.config.ts
mnAstro({ attr: 'class', presets: [...], mn: { strict: true } })
```

---

## Нетривиальные механизмы

### Как разбирается токен (реальный код, не `splitStem`/`parseLexeme`)

Внутренних модулей `splitStem`/`parseLexeme`, на которые раньше ссылался этот раздел,
**в текущем коде не существует** — это были модули упразднённой v2-архитектуры. Реальный
разбор — прямой regex-матчинг в `core/index.ts`/`selectorsCompileProvider/`:

- **Имя эссенции**: `REGEXP_MATCH_NAME = /^([a-z]+)(.*)$/` — тег = ведущая
  последовательность строчных `a-z`, всё остальное — суффикс (аргумент).
  ```
  ftBlur10    →  tag="ft",  suffix="Blur10"
  ftbBlur8    →  tag="ftb", suffix="Blur8"
  b1          →  tag="b",   suffix="1"
  x-50%       →  tag="x",   suffix="-50%"
  cF.38       →  tag="c",   suffix="F.38"
  ```
- **Контекстные границы** (для построения CSS-селектора, не для значения эссенции):
  `< > : . [ ] # + ~ @ !` — **точка ЯВЛЯЕТСЯ границей** (self-class-механизм,
  `cF.active` → `.cF\.active.active`), в отличие от того, что утверждалось здесь раньше.
  Экранированная точка (`\.`) или точка перед цифрой (десятичное значение вроде `f1.5em`)
  границей не считается.

### Ограничение mnVite/mnWebpack-сканера

Токены извлекаются функцией `extractTokens` (`minotation` core) из значений атрибута в
одной из форм: `attr="..."`, `attr='...'`, `attr={'...'}`, `attr={"..."}"`,
`` attr={`...`} `` (template literal — **берутся только литеральные сегменты**,
`${...}`-интерполяции вырезаются целиком перед разбором на токены).

**Не поддерживаются** (токен не попадёт в CSS): объектные литералы вида
`slotProps={{ root: { className: '...' } }}` (MUI slotProps и т.п.).

Правило то же, что и раньше: токены, нужные в нескольких состояниях, обязательно должны
присутствовать как литеральный текст хотя бы в одном месте файла — динамически
СКОНСТРУИРОВАННая строка (`` `cF${suffix}` ``) не даст извлечь токен.

---

*Примеры проверены прямыми вызовами `minotationProvider`+`presetStandard` против
собранного `dist/` (не через тесты) — дата последней сверки: см. `CHANGELOG.md` minotation.*
