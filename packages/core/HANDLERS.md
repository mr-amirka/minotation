# Minotation — справочник хендлеров

> ## Не уверены, умеет ли нотация что-то — не гадайте, проверьте
>
> ```bash
> cd packages/minotation/packages/core
> pnpm try 'gtc1fr_A'
> pnpm try 'cr' 'r0_10_10_0' 'gtc1fr@760'
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
| `tnA_0.2s_--ease` | `transition:all 0.2s var(--ease)` |
| `tn_opacity_0.2s_--ease` | `transition:opacity 0.2s var(--ease)` |
| `bxsh10c--shadow` | `box-shadow:0px 0px 10px 0px var(--shadow)` |
| `tnA_0.2s_---safe` | `transition:all 0.2s env(--safe)` |
| `ff--mono,serif` | `font-family:var(--mono,serif)` (с 2026-09-23; раньше `"-mono",serif`) |

Имя переменной сохраняется как есть и не переводится в kebab-case: `c--myInk` →
`color:var(--myInk)`.

### `_` в имени переменной: терминатор `;`

По умолчанию `_` — разделитель частей, поэтому `--line_soft` разобралось бы как
`var(--line) soft`. Чтобы `_` вошёл в имя, имя закрывают точкой с запятой:

| Токен | CSS |
|-------|-----|
| `tn--border_size;_A_--ease` | `transition:var(--border_size) all var(--ease)` |
| `w--my_width;` | `width:var(--my_width)` |
| `p--gap_size;` | `padding:var(--gap_size)` |
| `w--my_w;+5` | `width:calc(var(--my_w) + 5px)` |
| `tn--a_b;_A_--c_d;` | `transition:var(--a_b) all var(--c_d)` |

Терминатор необязателен: для имени без `_` (`w--gap` и `w--gap;`) результат одинаков —
его можно ставить всегда, не разбираясь, каким путём разбирается конкретный хендлер.

Экранирование (`\_`) для этого не годится и не поддерживается: обратный слэш снимается
раньше, на разборе токена, и до хендлера не доходит.

### Градиенты (`bg`, `mk`): разделитель — дефис

У `bg`/`mk` части значения разделяет **дефис**, а не `_` (тот остаётся модификатором).
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
`_rpt` — повторяющийся. `mk` — то же самое для `mask-image`.

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
| `mki--v` | `mask-image:var(--v)` |

### Свойства-картинки: что заворачивается в `url()`

`bgi`, `lisi`, `mki` оборачивают в `url("…")` только **голый путь**:

| Токен | CSS |
|-------|-----|
| `bgi_a\.png` | `background-image:url("a.png")` |
| `bgi_images/a\.png` | `background-image:url("images/a.png")` |
| `bgiN`, `bgi` | `background-image:none` |
| `bgiInherit` | `background-image:inherit` |
| `bgi_url\(a\.png\)` | `background-image:url(a.png)` — уже функция, проходит как есть |
| `bgi_linear-gradient\(red,blue\)` | `background-image:linear-gradient(red,blue)` |

До 2026-09-26 обёртка была безусловной, поэтому `bgi_url\(a\.png\)` давало
`url("url(a.png)")`, `bgi_none` — `url("none")`, а градиент превращался в имя
файла. Краткой записи `bgiN` не было вовсе; с D-113 `bgi_none` и `bgiNone` бракуются с подсказкой «Write it
shorter: "bgiN"».

### Список переменных через запятую

`;` завершает имя переменной — и теперь работает в том числе перед запятой:

| Токен | CSS |
|-------|-----|
| `gtc--a;--b` | `grid-template-columns:var(--a) var(--b)` — `;` даёт пробел |
| `gtc--a;,--b` | `grid-template-columns:var(--a),var(--b)` — запятая явно |
| `gtc--my_a;,--my_b;` | `grid-template-columns:var(--my_a),var(--my_b)` |

Ведущий `_` для этого не нужен: между двумя переменными подряд другого смысла
у `;` нет. `_` остаётся переключателем режима «не кебабить значение».

Три дефиса после `;` — это вычитание, а не разделитель: `w--a;---b` →
`width:calc(var(--a) - var(--b))`. Пробел перед `env()` пишется явно —
`w--a;_---b`.

Без `;` запятая после имени остаётся **фолбэком**, как в CSS:
`ff--mono,serif` → `font-family:var(--mono,serif)`.

До 2026-09-26 `g_--a;,--b` давало `grid:--a;,--b` — переменные не
разворачивались, а `;` уезжал в CSS литералом.

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

### Ведущий `_` — «значение уже готово»

Подчёркивание в начале аргумента отключает разбор: подчёркивания становятся
пробелами, `--имя` разворачивается в `var(--имя)`, остальное уходит в CSS как
написано.

```
tnA_0.2s_--ease     →  transition:all 0.2s var(--ease)
ff_Times_New_Roman  →  font-family:"Times New Roman"
```

**Доступен только там, где значение составное, и не для слов, у которых есть буква.** У свойства с закрытым
перечнем готового значения, которого нотация не предусмотрела, не бывает, поэтому такой выход там только пропускал
мусор: до 2026-09-26 `ov_solid` давал `overflow:solid`, `of_solid` — `object-fit:solid`, `d_solid` — `display:solid`.
Слово CSS с буквой пишется буквой и в составном значении — в каждой части (D-113): `d_inline_flow-root` бракуется с
подсказкой «Write it shorter: "dI_FR"». Сырой режим остаётся для того, что буквами не пишется: имён, переменных,
функций, чисел.

Составные среди свойств со словарём — пять, плюс позиция объекта:

| Тег | Свойство | Пример |
|-----|----------|--------|
| `d` | `display` | `dI_FR` → `display:inline flow-root` |
| `lis` | `list-style` | `lisD_I` → `list-style:disc inside` |
| `ovb` | `overscroll-behavior` | `ovbCT_A` |
| `td` | `text-decoration` | `tdU_W_Red` |
| `tcha` | `touch-action` | `tchaPX_PY` |
| `op` | `object-position` | `opL_T` (см. «Позиция и трансформация») |

У остальных пишите краткую или полную запись: `ovA`, `dB`, `ofCT`.

---

## `content` — кавычки ставит хендлер

Ведущий `_` означает «дальше текст» и сам оборачивает значение в кавычки:

| Токен | CSS |
|-------|-----|
| `cnt_Hello_World` | `content:"Hello World"` |
| `cnt_→` | `content:"→"` |
| `cnt_` | `content:""` — текста после `_` нет, значит пустая строка |
| `cntS` | `content:" "` — пробел |
| `cntN` | `content:none` |

`cnt__` бракуется: у пробела одна запись, `cntS`. Внутри текста подчёркивания
работают как обычно — `cnt_a__b` → `content:"a  b"`.

**Пустая строка, пробел и `none` — три разных случая.** `content:""` создаёт
псевдоэлемент (обычный приём для `::before`/`::after` с оформлением),
`content:none` не создаёт его вовсе.

Без `_` ожидается ключевое слово свойства, буквой: `cnt` и `cntN` → `none`, `cntOQ` / `cntCQ` → `open-quote` /
`close-quote`, `cntNOQ` / `cntNCQ` → `no-open-quote` / `no-close-quote`; `cntNormal` (буквы пока нет —
RESEARCH/22, Q7) и CSS-wide (`cntInherit`). Полные слова с буквой (`cntNone`, `cntOpenQuote`) бракуются с подсказкой
(D-113).

Текст без `_` бракуется: `cntHello` — ошибка с подсказкой, потому что
`content:hello` браузер отбрасывает (текст в `content` требует кавычек).
До 2026-09-26 такая запись молча давала нерабочее правило.

**Кавычка внутри текста экранируется:**

| Токен | CSS |
|-------|-----|
| `cnt_he_said_"hi"` | `content:"he said \"hi\""` |
| `cnt_a_"b"_c` | `content:"a \"b\" c"` |

Трактовать кавычку как «автор управляет кавычками сам» нельзя: `content: a "b" c`
по грамматике невалиден, то есть такое правило оставляло бы дыру ровно там, где
его и вводили.

Не оборачиваются два случая — распознаются сами:

| Токен | CSS | Почему |
|-------|-----|--------|
| `cnt_attr\(href\)` | `content:attr(href)` | значение целиком — вызов функции |
| `cnt--v` | `content:var(--v)` | подстановка |

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

### Единицы длины

Принимаются все единицы длины из спецификации CSS:

| Группа | Единицы |
|--------|---------|
| Абсолютные | `px` `cm` `mm` `q` `in` `pt` `pc` |
| Шрифтовые | `em` `ex` `ch` `cap` `ic` `lh` |
| Шрифтовые от корня | `rem` `rex` `rch` `ric` `rlh` |
| Viewport | `vw` `vh` `vmin` `vmax` `vi` `vb` |
| Viewport: малый / большой / динамический | `svw` `svh` `svmin` `svmax` · `lvw` `lvh` `lvmin` `lvmax` · `dvw` `dvh` `dvmin` `dvmax` |
| Контейнер (container queries) | `cqw` `cqh` `cqi` `cqb` `cqmin` `cqmax` |
| Проценты | `%` |

Ходовые формы: `hmin100dvh` (высота экрана без адресной строки браузера),
`w50cqw`, `p1lh`, `r10cqmin`.

Единица, которой в списке нет, бракуется с предупреждением — токен в CSS не
попадает: `w10zz`, `ti10zz`. Так же бракуется единица не того типа у
свойства-длины: `ti10s`, `ti10deg`, `ti10fr`.

### Знак

Минус допустим только там, где свойство принимает отрицательные значения:
`m-5`, `st-5`, `ti-5`, `lts-5`, `z-5`. У `padding`, `width`/`height`,
`border-width`, `font-size`, `border-radius` он бракуется — браузер такое
правило отбрасывает целиком (`w-5`, `p-5`, `r-5`).

Вычитание под это правило не попадает: `w10-5` → `width:calc(10px - 5px)`.
Знак результата заранее не известен, а со слагаемым-переменной
(`w--a-10`) и не может быть известен на этапе компиляции.

### Процент и количество значений

Оба ограничения задаются по свойству, а не по семейству, — свойства делятся
по ним по-разному:

| | Принимает | Не принимает |
|---|---|---|
| Процент | `p` `m` `r` `f` `w` `h` `ti` `tdt` `tuo` `fxb` `sw` `ggc` | `b`* `olw` `wos` `bsp` |
| Несколько значений | `p` `m` `b` `r` `bsp` `gg` | `bt`* `olw` `ti` `tdt` `tuo` `fxb` `ggc` `ggr` `sw` `w` `h` `f` |

\* `b` без стороны берёт до четырёх значений (`b1_2_3_4`), а `bt`/`bl`/… —
одно: это `border-top-width`, у которого сторон уже нет.

Дробь всегда разворачивается в процент, поэтому `b1/2` бракуется там же, где
`b10%`, а `p1/2` → `padding:50%` работает.

---

## Отступы

Именование: **x** = ось строки (inline: в горизонтальном тексте лево + право), **y** = ось блока (block: верх + низ).

**Оси — логические свойства (D-101, 2026-10-26)**, как у Tailwind 4: `px`/`py`, `mx`/`my`, `sx`/`sy`, `bx`/`by`,
`bcx`/`bcy`, `bsx`/`bsy` пишут `padding-inline` / `padding-block`, `margin-inline`…, `inset-inline`…,
`border-inline-width`…, `border-inline-color`…, `border-inline-style`…. В горизонтальном тексте (LTR и RTL) вид тот
же, что у физической пары; при `writing-mode: vertical-*` отступ идёт вдоль текста. Перекрытие работает как раньше:
`px16 pl0` — `pl` позже в CSS и побеждает на своей стороне. Остальные стороны (`t`, `b`, `l`, `r`, `xt`, `yl`, `lt`…)
— физические всегда.

Физическая пара — опция ядра `axisMode: 'physical'` (по умолчанию `'logical'`):

```js
const mn = minotationProvider({ presets: [presetStandard], axisMode: 'physical' });
// px16 → padding-left:16px;padding-right:16px
mn.setOptions({ axisMode: 'logical' }); mn.recompile(); // живой инстанс: px16 → padding-inline:16px
```

| Токен | CSS |
|-------|-----|
| `p10` | `padding:10px` |
| `px8` | `padding-inline:8px` |
| `py4` | `padding-block:4px` |
| `px1.5` | `padding-inline:1.5px` |
| `pt4` | `padding-top:4px` |
| `pb4` | `padding-bottom:4px` |
| `pl4` | `padding-left:4px` |
| `pr4` | `padding-right:4px` |
| `m0` | `margin:0` |
| `mx4` | `margin-inline:4px` |
| `my12` | `margin-block:12px` |
| `mxA` | `margin-inline:auto` |
| `mb8` | `margin-bottom:8px` |
| `mt8` | `margin-top:8px` |
| `mx0` | `margin-inline:0` |

**Логические стороны (A2, D-097; имена K3, D-103)** — как у Tailwind 4: `s`/`e` — начало и конец оси строки, `bs`/`be`
— начало и конец оси блока. Пишут одно логическое свойство в любом `axisMode`; в LTR `ps` — слева, в RTL — справа.
Конец строки у padding — **`pie`**, не `pe`: `pe` — `pointer-events`, и `pe10` отвечает «did you mean "pie10"».

| Токен | CSS |
|-------|-----|
| `ps10` | `padding-inline-start:10px` |
| `pie10` | `padding-inline-end:10px` |
| `pbs10` | `padding-block-start:10px` |
| `pbe10` | `padding-block-end:10px` |
| `ms8` | `margin-inline-start:8px` |
| `meA` | `margin-inline-end:auto` |
| `mbs8` | `margin-block-start:8px` |
| `mbe8` | `margin-block-end:8px` |

Сторона перекрывает ось и общий токен так же, как физическая: `px16 ps0` — `ps` позже в CSS.

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
| `iz100` | `inline-size:100px` (логическая ширина, A2) |
| `bz50%` | `block-size:50%` |
| `izmin60` | `min-inline-size:60px` |
| `bzmaxN` | `max-block-size:none` |

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
| `sx0` | `inset-inline:0` (D-101; `axisMode: 'physical'` — `left:0;right:0`) |
| `sy10` | `inset-block:10px` |
| `ss0` | `inset-inline-start:0` (A2: `s` — inset, второе `s` — start) |
| `se0` | `inset-inline-end:0` |
| `sbs0` | `inset-block-start:0` |
| `sbe0` | `inset-block-end:0` |
| `z1200` | `z-index:1200` |

---

## Flex

⚠️ **`fx` — это не `display:flex`.** Флекс-контейнер — `dF`; `fx…` задаёт свойство `flex`
(`fx1` → `flex:1`). Частая ошибка у тех, кто приходит из Tailwind, где `flex` означает display.

`fx` — только `flex`-shorthand (`fx1` → `flex:1`), **не** `display:flex` (для этого — `dF`,
см. Типографику/Display ниже). Без аргумента (`fx` без числа) хендлер не срабатывает —
**всегда указывайте значение** (`fx1`, `fx0_1_A`, …).

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
но с 2026-09-22 одинаковые буквы означают одно и то же. С 2026-10-26 это константы модуля
(`ALIGN_CONTENT_WORDS`, `JUSTIFY_CONTENT_WORDS`, …): их же берут пары `plc`/`pli`/`pls` (группа C).
`''` → center у `jc` и `ai` — только у них, в константы не входит:

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

Слова в составном значении `fx` пишутся буквами в каждой части (D-113): `fx0_1_A` → `flex:0 1 auto`, `fx1_1_C` →
`flex:1 1 content`; `fx0_1_Auto` и `fx0_1_auto` бракуются с подсказкой «Write it shorter: "fx0_1_A"».

---

## Типографика

### `font` — только то, что не выражается атомарно

| Токен | CSS |
|-------|-----|
| `fontInherit` | `font:inherit` |
| `fontC` | `font:caption` |
| `fontI` | `font:icon` |
| `fontM` | `font:menu` |
| `fontMB` | `font:message-box` |
| `fontSC` | `font:small-caption` |
| `fontSB` | `font:status-bar` |

Эти значения задают **весь набор шрифтовых свойств разом** — family, size,
line-height, weight, style, variant, stretch. Атомарными тегами их не собрать:
`font-variant` и `font-stretch` отдельных тегов не имеют.

**Составная форма убрана 2026-09-26.** `font16px/1.55_--font` и
`font12px_Arial` больше не принимаются — это был второй способ записать то же
самое:

```
font16px/1.55_--font   →   f16 lh1.55 ff--font
font12px_Arial         →   f12 ffArial
```

Решение то же, что сняло общий `ol`: два способа задать один стиль плодят
зоопарк, а с ростом числа стилей атомарная форма выигрывает и по числу правил.

| Токен | CSS |
|-------|-----|
| `f12` | `font-size:12px` |
| `f14` | `font-size:14px` |
| `f22` | `font-size:22px` |
| `fw5` | `font-weight:500` |
| `fw600` | `font-weight:600` (значение CSS как есть; с 2026-09-22 — раньше давало `900`) |
| `fwB` | `font-weight:bold` |
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
| `tdstDT` | `text-decoration-style:dotted` — добавлено 2026-09-22 |
| `tdsN` | `text-decoration-skip:none` |
| `tdsiA` | `text-decoration-skip-ink:auto` |
| `tdt2px` | `text-decoration-thickness:2px` |
| `tuo2px` | `text-underline-offset:2px` — добавлено 2026-09-22 |
| `tupFF` | `text-underline-position:from-font` — добавлено 2026-09-22 |
| `temN` | `text-emphasis:none` (значение — суффикс целиком, passthrough; без суффикса хендлер не срабатывает) |
| `temcF00` | `text-emphasis-color:#f00` |
| `tempO` | `text-emphasis-position:over` |
| `temsF_D` | `text-emphasis-style:filled dot` — буква в каждой части (D-113) |

`td`/`tdl` — **не пишите произвольное значение**, только буквы из `TD_SYNONYMS` (`N`/`U`/`O`/`L`);
остальные хендлеры этой группы (`tdc`, `tds…`, `tem…`) — обычный camelCase/snakeCase passthrough
без карты синонимов, как `ap`/`bga`/`ff`.

---

## Цвет фона / фон

`bg` задаёт **цвет или градиент** — и только их. Картинка, позиция, размер и
повтор пишутся атомарными тегами: `bgi`, `bgpx`/`bgpy`, `bgs`, `bgr`.

Голое число у `bgs`, `bgpx`, `bgpy` (и у `mks`, `va`, толщины в `td`) — пиксели, как у прочих длин (D-104):
`bgs10` → `background-size:10px`, `bgs10_20` → `10px 20px`, `bgpy-10` → `background-position-y:-10px`. Размер
отрицательным не бывает: `bgs-10px`, `mks-5` — ошибка «expected a length, zero or positive» (раньше `bgs-10px` давало
`background-size:-10px`, и браузер отбрасывал правило). Длин в размере не больше двух, `cover`/`contain` стоят
одни: `bgs10_20_30` — «at most 2 lengths», `bgsCV_10` — «"cover" stands alone»; у `td` толщина одна
(`tdU_2_3` — «at most 1 length»). Раньше все три давали CSS, который браузер отбрасывал.

Числовые формы бракуются с 2026-09-27: `bg10zz` давало `background:10zz`,
`bg1/2` — `background:1/2`, `bg10_20` — `background:10_20`, а `bg100%-20px`
собиралось в градиент из мусора (`linear-gradient(180deg,100% 0%,20px 100%)`).
Стопы градиента обязаны быть цветами или переменными.

**`mk` цвета не принимает.** `mask-image` по грамматике это картинка или
градиент, поэтому `mkF00` бракуется — маска задаётся градиентом
(`mkF00-00F`) или переменной.


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
| `bx1` | `border-inline-width:1px` |
| `bsyS` | `border-block-style:solid` |
| `bcxF00` | `border-inline-color:#f00` |

Паттерн сторон: суффикс `l/r/t/b` к каждому из трёх токенов:

| Сторона | width | style | color |
|---------|-------|-------|-------|
| все | `b1` | `bsS` | `bcF.1` |
| left | `bl1` | `bslS` | `bclF.12` |
| right | `br1` | `bsrS` | `bcrF.1` |
| top | `bt1` | `bstS` | `bctF.1` |
| bottom | `bb1` | `bsbS` | `bcbF.08` |
| ось строки (D-101) | `bx1` | `bsxS` | `bcxF.1` |
| ось блока (D-101) | `by1` | `bsyS` | `bcyF.1` |
| начало строки (A2) | `bis1` | `bssS` | `bcsF.1` |
| конец строки (A2) | `bie1` | `bseS` | `bceF.1` |
| начало блока (A2) | `bbs1` | `bsbsS` | `bcbsF.1` |
| конец блока (A2) | `bbe1` | `bsbeS` | `bcbeF.1` |

Ширина по началу/концу строки — **`bis`/`bie`** (K3, D-103): `bs` — `border-style`, `bs1` отвечает
«did you mean "bis1"». У `border-image` логических сторон нет.

| Токен | CSS |
|-------|-----|
| `bis1` | `border-inline-start-width:1px` |
| `bbe2` | `border-block-end-width:2px` |
| `bssS` | `border-inline-start-style:solid` |
| `bcbeF00` | `border-block-end-color:#f00` |

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
| `rlt4` | `border-top-left-radius:4px` |
| `rss4` | `border-start-start-radius:4px` (угол: начало блока, начало строки) |
| `rse4` | `border-start-end-radius:4px` |
| `res4` | `border-end-start-radius:4px` |
| `ree4` | `border-end-end-radius:4px` |
| `rs8` | `border-start-start-radius:8px;border-end-start-radius:8px` (оба угла начала строки) |
| `re8` | `border-start-end-radius:8px;border-end-end-radius:8px` |

Угол перекрывает пару углов: `rs8 rss0` — `rss` позже в CSS.

---

## Box-sizing

| Токен | CSS |
|-------|-----|
| `bxzBB` | `box-sizing:border-box` |
| `bxzCB` | `box-sizing:content-box` |

---

## Box-shadow

Формат: `bxsh{blur}[x{offsetX}][y{offsetY}][r{spread}][m{повтор}][c{цвет}][in]`.

**Порядок жёсткий** (2026-09-27): `bxsh19c43Fx5y5r3` бракуется, писать нужно
`bxsh19x5y5r3c43F`. Раньше порядок был свободным — это следствие реализации, а
не замысел; одно значение не должно записываться по-разному.

| Токен | CSS |
|-------|-----|
| `bxsh18` | `box-shadow:0px 0px 18px 0px #000` |
| `bxsh19r3` | `box-shadow:0px 0px 19px 3px #000` (`r`/`R` — spread) |
| `bxsh19c43F` | `box-shadow:0px 0px 19px 0px #43f` |
| `bxsh19r3c43F` | `box-shadow:0px 0px 19px 3px #43f` |
| `bxsh19x5y5r3c43F` | `box-shadow:5px 5px 19px 3px #43f` |
| `bxsh10in` | `box-shadow:inset 0px 0px 10px 0px #000` |

⚠️ Буква `r`/`R` внутри `bxsh…` означает **spread**, а не `border-radius` (тот — отдельный тег `r`).

**Единица** указывается при blur и распространяется на все длины записи:
`bxsh1.5em` → `box-shadow:0em 0em 1.5em 0em #000`, `bxsh10dvh` →
`0dvh 0dvh 10dvh 0dvh #000`. До 2026-09-26 склейка была жёстко `px` и единица
молча терялась (`bxsh1.5em` давал `1.5px`).

Модификаторы `x`/`y`/`r` — целые числа без единицы: единица у записи одна.

Две единицы недоступны. `%` — потому что тень по грамматике принимает
`<length>`, а не проценты (`bxsh10%` бракуется). `in` (дюймы) — из-за коллизии
с модификатором `in` (inset), который здесь важнее; дюймы — единица печати и на
экране не нужны.

### Переменная и несколько теней

| Токен | CSS |
|-------|-----|
| `bxsh--shadow` | `box-shadow:var(--shadow)` |
| `bxsh--a,--b` | `box-shadow:var(--a),var(--b)` |
| `bxshB--blur` | `box-shadow:0px 0px var(--blur) 0px #000` |
| `bxshB--blur;c--shadow` | `box-shadow:0px 0px var(--blur) 0px var(--shadow)` |
| `bxsh10c--shadow` | `box-shadow:0px 0px 10px 0px var(--shadow)` |
| `bxsh10x0y2c0.1,5x0y1c0.05` | две разные тени через запятую |
| `bxshN` | `box-shadow:none` |

**Переменная без буквы — это вся тень целиком** (`bxsh--shadow` →
`box-shadow:var(--shadow)`), как `--x` у любого другого свойства. Переменная
именно в позиции blur пишется через `B`: `bxshB--blur`.

Буква заглавная по той же причине, что `X`/`Y`/`R`/`M`: строчная слилась бы с
именем тега — `bxshb…` ядро прочитает как тег `bxshb`, не найдёт хендлера и
молча пропустит токен как чужой класс.

До 2026-09-29 `bxsh--shadow` клало переменную в blur, а остальные слоты
добирались умолчаниями: получалось `0px 0px var(--shadow) 0px #000` —
правило, которого автор не писал, и без предупреждения.

`;` после имени переменной — терминатор, как везде в нотации: без него имя
жадно заберёт следующие модификаторы.

**Сырой режим (`bxsh_…`) убран 2026-09-26.** Мини-язык покрывает всё, что он
давал, а на списке теней он ломался: запятая уходила внутрь `var(…)` и
`bxsh_0_2px_8px_--shadow,0_1px_2px_--shadow2` давало
`0 2px 8px var(--shadow,0) 1px 2px var(--shadow2)`.

Модификаторы без ведущего значения теперь бракуются: `bxshR3` раньше давал
мусор `Rpx` в позиции blur.

**Inset**: модификатор — **строчный** `in`: `bxsh10in` → `box-shadow:inset 0px 0px 10px 0px #000`.
Заглавный `In` модификатором не является (`bxsh10In` → без inset) — так же, как в v1
(уточнено 2026-09-17 по примеру владельца; прежняя формулировка «не применяется ни в каком
сочетании» проверяла только заглавную форму).
Изолированный `r`/`R`-модификатор БЕЗ ведущего числа (`bxshR3` — суффикс состоит только из
spread, без blur) раньше давал мусор в позиции blur (`box-shadow:0px 0px Rpx 3px #000`, где
`Rpx` — буквальная строка; унаследовано из v1). С 2026-09-26 такая запись бракуется самим
хендлером с подсказкой — blur пишется первым числом.

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

### `tn` — слоты в фиксированном порядке

```
tn{свойство}_{длительность}_{плавность}_{задержка}
```

| Токен | CSS |
|-------|-----|
| `tn200` | `transition:200ms` — голое число получает `ms`, как у `dn` |
| `tn0.2s` | `transition:0.2s` |
| `tnA` | `transition:all` |
| `tnN` | `transition:none` (D-111) |
| `tnA_0.2s` | `transition:all 0.2s` |
| `tn_color_0.2s_E` | `transition:color 0.2s ease` |
| `tn_color_0.2s_EIO_0.1s` | `transition:color 0.2s ease-in-out 0.1s` |
| `tn_0.2s_0.1s` | `transition:0.2s 0.1s` — первое время длительность, второе задержка |
| `tn_cubic-bezier\(0,0,1,1\)` | `transition:cubic-bezier(0,0,1,1)` |

**Буквы** (D-109) — те же, что у `tp` и `ttf`: `A` — `all` в слоте свойства; плавность — `L` (`linear`),
`E` (`ease`), `EI`, `EO`, `EIO` (`ease-in`, `ease-out`, `ease-in-out`), `SS`, `SE` (`step-start`, `step-end`).
Длинное слово отвечает буквой (D-015): `tn_A_0.2s` → «write it shorter — "A" instead of "all"»,
`tn_color_0.2s_ease-in` → «"EI" instead of "ease-in"». Функции плавности (`cubic-bezier(…)`, `steps(…)`,
`linear(…)`) пишутся как в CSS. `none` — буквой, как у `tp` и `an` (D-111): `tnN`; `tnNone` и `tn_none` →
«Write it shorter: "tnN" instead of "tnNone" — same value».

Каждый слот необязателен, но **порядок обязателен**: `tn_0.2s_A` и
`tn_E_0.2s` бракуются, хотя CSS их принимает. Грамматика
`<single-transition>` — набор `||`, порядок в ней свободный; нотация
фиксирует один, чтобы одно и то же не записывалось по-разному, а ошибка
называлась словами.

**Несколько свойств с одними параметрами** — через `;`:

```
tn_color;background;border-color_0.2s
→ transition:color 0.2s,background 0.2s,border-color 0.2s
```

Такого сокращения в CSS нет: там каждое свойство пишется целым блоком.
`transition: color, background 0.2s` означает другое — `color` получит
длительность по умолчанию (`0s`, то есть без анимации).

`;` здесь разделитель списка, а не терминатор имени переменной: имя переменной
начинается с `--` и к этому моменту уже развёрнуто в `var(…)`, так что
`tn_--prop;_0.2s` по-прежнему даёт `transition:var(--prop) 0.2s`.

**Несколько переходов через запятую** — то, ради чего shorthand остался:

```
tn_color_0.2s_E,transform_0.4s_L
→ transition:color 0.2s ease,transform 0.4s linear
```

Атомарные `tp`/`dn`/`ttf`/`delay` пишут по одному значению на все свойства
сразу, поэтому разные параметры разным свойствам ими не задать. Одиночный
переход лучше писать атомарно: `dn200 tpA ttfE`.

`tp` — какие свойства анимируются: `tpA` — `all`, `tpN` — `none`, свойство — словом (`tp_color`,
`tpBackgroundColor`), список — через запятую, как в CSS и как в старой версии: `tp_color,opacity` →
`transition-property:color,opacity`. `;` — сокращение `tn` для общих параметров, а у `tp` параметров нет:
`tp_color;opacity` и `tpColor_Opacity` бракуются с подсказкой «as "tp_color,opacity"», как и пустой элемент,
одна буква (`tpB`) и `none` в списке (D-106). До D-106 запятая бракалась, а `;` уходил в CSS как есть и обрывал
объявление: `transition-property:color;opacity` анимировал один `color`.

Элемент списка начинается со строчной (D-107): `tnColor;opacity_200`, `wcTransform,opacity`, `ffArial,sansSerif`.
Заглавная сразу после `,`/`;` — второе написание того же класса, поэтому бракуется с подсказкой: `tnColor;Opacity_200`
→ «write "Color;opacity"». Внутри элемента заглавная по-прежнему пишет дефис (`tpColor,backgroundColor` →
`color,background-color`), префикс производителя — явным дефисом: `wcTransform,-webkitTransform` →
`transform,-webkit-transform`.

До 2026-09-26 проверки не было вовсе: `tn200` давало `transition:200` (число
без единицы), `tn10zz` — `transition:10zz`.

### `an` — анимация, слоты в фиксированном порядке

```
an_{имя}_{длительность}_{плавность}_{задержка}_{повторы}_{направление}_{заполнение}_{состояние}
```

| Токен | CSS |
|-------|-----|
| `an_wg-appear_0.2s_EO_0.3s_both` | `animation:wg-appear 0.2s ease-out 0.3s both` |
| `an_spin_1s_L_infinite` | `animation:spin 1s linear infinite` |
| `an_fade_200` | `animation:fade 200ms` — голое число получает `ms`, как у `tn` |
| `an_fade_200_300_2_alternate_forwards_paused` | `animation:fade 200ms 300ms 2 alternate forwards paused` |
| `anN` | `animation:none` (`anNone` и `an_none` бракуются с подсказкой, D-113) |
| `an_a_1s,b_2s` | `animation:a 1s,b 2s` — несколько анимаций через запятую |

Как у `tn`: каждый слот необязателен, порядок — обязателен (`an_1s_fade` — предупреждение с
перечнем слотов). Первое время — длительность, второе — задержка; голое число после задержки —
число повторов; `none` до длительности — имя, после — заполнение.

**Плавность — буквами**, как у `tn` и `atf` (D-111): `L`, `E`, `EI`, `EO`, `EIO`, `SS`, `SE`. Буква — плавность
только после имени или длительности: первая часть — всегда имя (`an_e_1s` — анимация `e`, как и `anE_1s`).
Длинное слово отвечает буквой: `an_fade_1s_ease-out` → «write it shorter — "EO" instead of "ease-out"»; в первой
части — с напоминанием о месте: `an_ease_1s` → «… "E" instead of "ease"; easing goes after the name or the
duration». Функции плавности (`cubic-bezier(…)`, `steps(…)`) пишутся как в CSS.

**Ключевые кадры — в пресете проекта** (`mn.setKeyframes`), сама анимация — токеном:

```ts
// src/components/LoadingScreen/loadingScreen.mn.ts — подключается импортом ради побочного эффекта
import type { MnInstance } from 'minotation';

export default function presetLoadingScreen(mn: MnInstance): void {
  mn.setKeyframes('wg-appear', {
    from: { opacity: '0' },
    to: { opacity: '1' },
  });
}
```
```tsx
// LoadingScreen.tsx
import './loadingScreen.mn';

<div className="an_wg-appear_0.2s_EO_0.3s_both" />
```
```css
@keyframes wg-appear{from{opacity:0}to{opacity:1}}
.an_wg-appear_0\.2s_EO_0\.3s_both{animation:wg-appear 0.2s ease-out 0.3s both}
```

Отдельного хендлера на анимацию в пресете больше не нужно: раньше её приходилось заводить своим
хендлером (`mn('wgAppear', () => ({ style: { animation: '…' } }))`), потому что `an` не было
(запрос трека web-games, 2026-10-14).

#### Именованные анимации (группа G, D-097)

Четыре анимации Tailwind — с кадрами, которые попадают в вывод только при использовании:

| Токен | CSS |
|-------|-----|
| `anSpin` | `@keyframes spin{to{transform:rotate(360deg)}}` + `animation:spin 1s linear infinite` |
| `anPing` | `@keyframes ping{75%,100%{transform:scale(2);opacity:0}}` + `animation:ping 1s cubic-bezier(0,0,.2,1) infinite` |
| `anPulse` | `@keyframes pulse{50%{opacity:.5}}` + `animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite` |
| `anBounce` | `@keyframes bounce{0%,100%{…}50%{…}}` + `animation:bounce 1s infinite` |
| `an_spin_2s` | те же кадры `spin` + `animation:spin 2s` — с частями значение как написано |
| `anN` | `animation:none` |

Кадры выводятся один раз, сколько бы токенов их ни использовало. Кадры, заданные автором под тем же
именем (`mn.setKeyframes('spin', …)`), выигрывают: пресет их не перезаписывает.

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

Отдельные теги `rx`/`ry`/`rz` задают только поворот: `rx45` →
`transform:rotateX(45deg)`, `rz` без аргумента — `180deg`.

**Единица поворота** — угловая: `deg` (умолчание), `grad`, `rad`, `turn`.
`rx0.5turn`, `x10Y20Rz45deg` работают; `rx10px`, `rx10s`, `x10Y20Rz45px`
бракуются с предупреждением. До 2026-09-26 единица не проверялась и уходила
в CSS как написана (`rotateX(10px)`), а `rxInherit` давал склейку слова с
единицей — `rotateX(Inheritdeg)`. Мимо валидатора ядра это проходило:
`transform` не в его таблице.

---

## Переопределение токенов компонента — `mne` / `mnClass`

У всех MN-классов специфичность **одинаковая** (`.f20` и `.f24` — по одному классу),
поэтому при `class="f20 f24"` побеждает не порядок в атрибуте, а порядок правил
в CSS-файле. Автор компонента на него не влияет, и на практике специфичность
накручивают вручную — `f24*2`, `bg4*2`.

Утилита решает это иначе: **перекрытый токен просто не попадает в атрибут**.

```jsx
import { mne, mnClass } from 'minotation';

export function TextA(props) {
  return <div {...props} className={mne('f20 dB bgC', props.className)} />;
}

// или с предвычисленной базой — разбор базы не зависит от пропсов
const textAClass = mnClass('f20 dB bgC');
export function TextA(props) {
  return <div {...props} className={textAClass(props.className)} />;
}

<TextA className="f24 bg4" />   // → class="dB f24 bg4"
```

Флаги — как у `classnames`, без отдельной библиотеки (D-040): объект
`{ классы: условие }` добавляет ключи с истинным значением и, как строка,
перекрывает токены левее.

```jsx
mne('dB f12', props.className, { cF00: isError, dN: !isOpen });
textAClass('cF00', { bar: true, baz: false });   // → 'f20 dB bgC cF00 bar'
mne('cF00 p10', { c0F0: isOk });                 // isOk → 'p10 c0F0'
```

Токены конфликтуют, если совпали **тег и контекст** — имя хендлера плюс всё, что
задаёт, когда и к чему правило применяется:

| Токены | Конфликт | Почему |
|---|---|---|
| `f20` / `f24` | да | один тег, один контекст |
| `f20` / `f24@sm` | нет | разные медиа-контексты |
| `cF00` / `c00F:hover` | нет | разные состояния |
| `p10<.parent` / `p12<.parent` | да | один предок |
| `p10-i` / `p12` | нет | `!important` победит и так |

**Чужие классы проходят насквозь и никогда никого не отменяют.** Кебаб
(`text-center`, `btn-primary`) отличается от MN по дефису перед БУКВОЙ: `mt-10` —
это отрицательный margin, а `mt-auto` — чужой класс. Граница: camelCase-класс чужой
системы (`someClass`) по форме неотличим от токена (`some` + `Class`).

`mnMap('f24 bg4 active someClass')` отдаёт разобранное — `{ f: '24', bg: '4',
active: '', some: 'Class' }`; это та форма, в которой удобно пробрасывать
родительские токены во фреймворк. `mnKey('f24@sm')` → `'f@sm'` — ключ конфликта
одного токена.

Модуль ничего не импортирует — ни ядро, ни `fundamentool`: рассчитан на вызов
на каждый рендер, в том числе там, где `minotation` подключена только плагином сборки.

---

## Общий `ol` убран — только `olw`/`ols`/`olc`

Контур задаётся атомарно:

```
olw3 olsS olc--marker      outline-width:3px; outline-style:solid; outline-color:var(--marker)
olwTN olsDT olcBT          толщина, стиль и системный цвет
```

Общего `ol` (`ol3px_solid_--marker`) больше нет. По числу правил он выигрывал,
пока контуров в проекте один-два, и проигрывал от четырёх комбинаций — но решающим
оказалось не это: **два способа задать одно и то же сами по себе хуже, чем один
менее оптимальный.** Чем больше стилей в проекте, тем вернее побеждает атомарная
форма, и держать оба способа значит плодить зоопарк.

Составное значение и терминатор `;` никуда не делись — они есть у остальных
шорткатов, где атомарных аналогов в CSS нет: `tn` (transition), `bxsh` (box-shadow),
`font`, `bgs`, `fx`.

---

## Состояния: синонимы и предупреждение о незарегистрированном имени

Полное имя псевдокласса работает всегда, без всякого синонима: `p10:focus-visible`,
`p10:autofill`, `p10:target`. Синоним — это только короткая запись.

**Неизвестное имя не бракуется, но предупреждает** (с 2026-09-25). Пропуск сделан
осознанно: псевдокласс может быть специфичен для окружения или ещё не быть в
стандарте. Но раньше опечатка уходила в CSS молча — `p10:fv` давал мёртвое правило
`.p10\:fv:fv{…}`. Теперь это `unregistered-state`: правило по-прежнему компилируется,
а предупреждение подсказывает завести синоним и держать в проекте одну каноническую
запись.

| Группа | Синонимы |
|---|---|
| Базовые | `a` :active · `c` :checked · `d` :disabled · `f` :focus · `h` :hover |
| Фокус | `fv` :focus-visible · `fw` :focus-within |
| Ссылки | `v` :visited · `link` :link · `al` :any-link · `t` :target |
| Содержимое | `e` :empty · `root` :root |
| Формы | `r` :required · `opt` :optional · `ro` :read-only · `rw` :read-write · `invalid` · `valid` · `ir` :in-range · `oor` :out-of-range · `ps` :placeholder-shown · `ind` :indeterminate · `def` :default · `af` :autofill · `i` плейсхолдер (псевдоэлемент, с вендорными префиксами) |
| Структурные | `n` :nth-child · `first` · `last` · `only` · `even` · `odd` · `fot` :first-of-type · `lot` :last-of-type · `oot` :only-of-type · `nt` :nth-of-type · `nl` :nth-last-child · `nlt` :nth-last-of-type |
| Функциональные | `not` · `is` · `where` · `has` — ключ совпадает с именем, это штатный синтаксис: `p10:not[.a]` |

`:invalid` и `:valid` намеренно оставлены полными словами — они читаются лучше, чем
любое сокращение.

Псевдоэлементы состояниями не считаются и не предупреждают: `p10::before` даёт
`::before`.

⚠️ Полное имя там, где есть синоним, **предупреждает**: `p10:hover` → warning,
`p10:h` → тишина. Это и есть смысл механизма — одна каноническая форма на проект.
Нужен другой канон — заведите свой синоним через `mn.synonyms({ hover: ':hover' })`.

---

## Висячий сепаратор в конце имени

Контекстный символ в конце имени, без самой части, бракуется (с 2026-09-25).
В четырёх формах из пяти он давал синтаксически битый CSS, а не просто лишний символ:

| Токен | Что давал до отбраковки |
|---|---|
| `p10@` | правило `.p10\@{…}` — суффикс медиа молча испарялся |
| `p10:` | селектор `.p10\::{…}` — висячее двоеточие |
| `p10.` | селектор `.p10\..{…}` — висячая точка |
| `p10#` | селектор `.p10\##{…}` — висячая решётка |
| `p10~` | селектор `.p10\~~{…}` — висячий комбинатор |
| `p10@sm&` | `.p10\@sm&{…}` — неэкранированный `&` в имени класса |

Экранированный символ — часть значения и не задет: `bgi_a\.` даёт
`background-image:url("a.")`, `ff_a\:` — `font-family:a:`.

`p10<` и `p10>` бракуются своим, более точным сообщением («пустой контекстный
сегмент», §13 спеки).

---

## Скобки: группа вариантов или CSS-функция

`(a|b)` — **группа вариантов**: `p10@(sm|md)` разворачивается в два медиа-контекста,
селектор `'(button|[type=submit])'` в `mn.assign` — в два селектора.

**После функционального псевдокласса скобки — его аргумент** (D-077, с 2026-10-14):
`cF:not(.a)` ≡ `cF:not[.a]` → `:not(.a)`, `cF:n(2n+1)` → `:nth-child(2n+1)`, `cF:has(>img)` →
`:has(>img)`; внутри аргумента скобки — CSS (`cF:not(:n(2n))` → `:not(:nth-child(2n))`). Функциональные —
`:not`, `:is`, `:where`, `:has`, `:nth-*`, `:lang`, `:dir`, `:host`, `:host-context`, `:state`,
`::part`, `::slotted`, `::highlight` и др., а также синонимы, которые в них разворачиваются (`:n`).
Раньше `cF:not(.a)` давало `:not.a` без единого предупреждения.

**Подозрительные группы — `groupSuspectMode`** (`'warn'` по умолчанию | `'silent'` | `'strict'`):
группа, которая даёт заведомо битый CSS, —

| Запись | Даёт | Что имелось в виду |
|---|---|---|
| `cF:is(.a\|.b)` | селекторы `:is.a`, `:is.b` | `cF:is[.a,.b]` или `cF(:is[.a]\|:is[.b])` |
| `cF:h(2n)` | селектор `:hover2n` | аргумент (`:h[2n]`) или `cF:h(.x)` — дописать к селектору |

**Скобки как CSS везде — `groupMode: 'css'`** (по умолчанию `'groups'`): групп нет, скобки после
функционального псевдокласса — аргумент, остальные — часть значения или селектора без экранирования:
`gtcRepeat(auto-fit,minmax(240px,1fr))`, `crUrl(a\.png)` (точку в значении экранировать по-прежнему — она
граница класса), `mn.assign('li:nth-child(2n)', …)`. Цена — `(a|b)`, `w(|max)150` и `p10:h(.x)` недоступны.

В значении (до первого контекстного символа) скобки **без `|` группой не являются** и с 2026-09-25
бракуются (в режиме `'groups'`). Раньше такая запись молча теряла сами скобки:

| Запись | Что давала до отбраковки |
|---|---|
| `gtcRepeat(auto-fit,minmax(240px,1fr))` | значение `grid-template-columns:repeatauto-fit,minmax240px,1fr` — вместо функции `repeat()` |
| `crUrl(a.png)` | значение `cursor:urla`, а `.png` уезжал в селектор — вместо `url(a.png)` |
| `'button:not(.plain)'` в `mn.assign` | селектор `button:not.plain` — вместо `button:not(.plain)` |
| `'li:nth-child(2n)'` в `mn.assign` | селектор `li:nth-child2n` — вместо `li:nth-child(2n)` |

**Вырожденные группы и пустые скобки тоже бракуются** (с 2026-09-25):

| Запись | Что давала до отбраковки |
|---|---|
| `p10@(sm|)` | правило дважды — в `@media sm` И безусловно, медиа-запрос обесценен |
| `p10@(\|)` | суффикс `@` молча испарялся |
| `p10:(hover\|)` | селектор с висячим двоеточием (`.p10…:`) — невалидный CSS |
| `p10@()` | пустые скобки исчезали, оставляя странное имя класса |

Пустые скобки бракуются в любой позиции — они бессмысленны и как группа, и как scope.

**Пустая альтернатива проверяется по результату, а не по записи** (с 2026-10-04).
Группа сначала разворачивается в варианты, и бракуется вариант, оставшийся без части
контекста. Сама по себе пустая альтернатива не дефект:

| Запись | Итог | Варианты |
|---|---|---|
| `w(\|max)150` | законно: `width` и `max-width` | `w150`, `wmax150` |
| `p(\|t)10` | законно: `padding` и `padding-top` | `p10`, `pt10` |
| `p10@(sm\|)` | брак: висячий `@` | `p10@sm`, `p10@` |
| `p10:(hover\|)` | брак: висячий `:` | `p10:hover`, `p10:` |
| `p10@(\|sm):h` | брак: состояние после медиа (D-088) | `p10@:h`, `p10@sm:h` |
| `w(\|)150` | брак: группа ничего не варьирует | `w150`, `w150` |

До 2026-10-04 пустая альтернатива бракуется везде, и законные `w(|max)150` не работали.
Запрет был шире своего обоснования: все найденные тогда дефекты были в контекстной части,
где пустой вариант оставляет висячий сепаратор. Проверка по результату ловит ровно это —
и заодно закрыла ту же форму, записанную без группы: `p10@:h` до этого компилировался
молча, медиа испарялось, и адаптивное правило становилось безусловным.

В селекторах `mn.assign` действует то же правило по результату: бракуется пустой
вариант. `'(h1|)'` даёт варианты `h1` и пустую строку — пустой селектор, битый CSS.
А `'div(|.x)'` законен: варианты `div` и `div.x`.

**Селектор после медиа законен.** `c00F(@sm|.active)<.parent` — так задумано: группа
варьирует, где действует правило — в медиа или по классу. Бракуется только пустое
имя медиа (`p10@:h`).

**Как писать функцию — экранировать скобки:**

```
crUrl\(a\.png\)                             → cursor:url(a.png)   (точка — тоже: иначе граница класса)
gtcRepeat\(auto-fit,minmax\(240px,1fr\)\)    → grid-template-columns:repeat(auto-fit,minmax(240px,1fr))
mn.assign({ 'button:not(.plain)': 'p10' })    → button:not(.plain){padding:10px}   (аргумент, D-077)
```

Для сетки короче обойтись без скобок вовсе — `gtcAF240` (раздел **Grid** ниже).

**Скобки ПОСЛЕ контекстного символа не задеты** — там они часть scope-грамматики,
а не группа (кроме аргумента функционального псевдокласса, см. выше): `p10:h(.x)` даёт `:hover.x` (содержимое дописывается к тому же селектору),
а `cF00:not[.a]` — `:not(.a)` (квадратные оборачиваются в круглые). Проверка смотрит
только на значение — часть токена до первого контекстного символа.

**`[...]` после состояния работает и в селекторах `mn.assign`** (с 2026-09-25):
`'button:not[.plain]'` → `button:not(.plain)`, `'li:nth-child[2n]'` → `li:nth-child(2n)`.
Раньше такая запись уезжала в CSS как есть и была невалидной.

⚠️ Но квадратные скобки — **не** общая замена круглым: вне позиции состояния `[`
начинает контекстную часть (атрибутное условие), и заменять его нельзя. `cF00[checked]`
и `'input[checked]'` — это атрибуты и остаются ими; `crUrl[a.png]` даёт `cursor:url`
плюс мусор `[a.png]` в селекторе. Для значений остаётся экранирование.

---

## Составные значения по слотам

Порядок слотов фиксирован — грамматика CSS его не задаёт (везде `||`), но одно
значение не должно записываться по-разному. Тот же размен, что у `tn` и теней.

| Тег | Слоты | Примеры |
|-----|-------|---------|
| `fx` | `рост сжатие база` | `fx1`, `fx_1_1`, `fx1_1_A`, `fx_1_1_0%`, `fxN`, `fxA`, `fxC` |
| `col` | `число-колонок ширина` | `col3`, `col_3_30em`, `colA` |
| `tem` | `стиль цвет` | `temF`, `temF_D`, `temN` |
| `coi`, `cor` | пары `имя значение` | `coi_n_2`, `cor_n_0`, `coiNone` |

До 2026-09-27 все пять были permissive pass-through — значение кебабилось и
уходило в CSS как есть:

```
fxN     →  flex:n                  fx10zz  →  flex:10zz
colA    →  columns:a               col10zz →  columns:10zz
temF00  →  text-emphasis:f00       tem10   →  text-emphasis:10
coi10   →  counter-increment:10
```

Ни одно из этих правил браузер не применяет. Теперь они бракуются, а порядок
проверяется: `col_30em_3` (ширина перед числом колонок) и `coi_2_n` (значение
перед именем) — ошибки.

Подстановка проходит в любом слоте: `fx--g_1_A`, `coi_--name_2`. Слова — буквами в каждой части (D-113).

## Grid

### `g` и `gt` — форма сетки

| Токен | CSS |
|-------|-----|
| `gN` | `grid:none` |
| `g_1fr_/_1fr` | `grid:1fr / 1fr` — строки / столбцы |
| `g_"a"_1fr` | `grid:"a" 1fr` — область и размер |
| `gt"a_b"_1fr_/_A` | `grid-template:"a b" 1fr / auto` |
| `gAF_1fr_/_1fr` | `grid:auto-flow 1fr / 1fr` — `AF` auto-flow, `D` dense |

**`g_1fr_1fr` бракуется** — работало, но по грамматике невалидно: `grid` это
либо `none`, либо области в кавычках, либо «строки / столбцы». Один список
дорожек задаётся через `gtc`/`gtr`.

Мусор тоже закрыт: `g10zz` давало `grid:10zz`, `gZzz` — `grid:zzz`.

### Дорожки: `gtc`, `gtr`, `gac`, `gar`

Часть дорожки — размер (длина, процент, `fr`), ключевое слово, функция или имя
линии:

| Токен | CSS |
|-------|-----|
| `gtc1fr_1fr` | `grid-template-columns:1fr 1fr` |
| `gtc50%` | `grid-template-columns:50%` |
| `gtcN`, `gtcA`, `gtcMinContent`, `gtcS` | `none`, `auto`, `min-content` (буквы пока нет — RESEARCH/22, Q1), `subgrid` |
| `gtc_repeat\(3,1fr\)` | `repeat(3,1fr)` |
| `gtr_minmax\(100px,1fr\)` | `minmax(100px,1fr)` |
| `gtc_\[a\]_1fr` | `[a] 1fr` — имя линии, скобки экранируются |

**Размер дорожки без единицы невалиден**, в отличие от голого числа в остальной
нотации: `gtc10` бракуется, нужно `gtc10px` или `gtc10fr`. До 2026-09-27
проходило как есть — вместе с `gtcZzz` → `zzz` и `gtc10zz` → `10zz`.

### Позиции: `gr`, `gc`

| Токен | CSS |
|-------|-----|
| `gr1` | `grid-row:1` |
| `gr1/3` | `grid-row:1/3` |
| `gc1/-1` | `grid-column:1/-1` |
| `grA` | `grid-row:auto` |

Здесь проверяется немногое: по грамматике `<grid-line>` допускает почти любой
идентификатор, так что `grSpan2` и `grZzz` — законные имена линий. Бракуется
только длина: `gr10px`. `A` — `auto` (2026-10-26, группа C): раньше `gcA` давало `grid-column:a`, линию с именем
`a`; `grAuto` теперь отвечает «Write it shorter: "grA"». Одна линия — `grs`/`gre`/`gcs`/`gce`, см. «Сетка и выравнивание».


| Токен | CSS |
|-------|-----|
| `gtc1fr_A` | `grid-template-columns:1fr auto` |
| `gtcN` / `gtcA` / `gtcS` | `grid-template-columns:none` / `auto` / `subgrid` |
| `gtcAF240` | `grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))` |
| `gtcAF240_300` | `grid-template-columns:repeat(auto-fit, minmax(240px, 300px))` |
| `gtcAF15em` | `grid-template-columns:repeat(auto-fit, minmax(15em, 1fr))` |
| `gtcAFL240` | `grid-template-columns:repeat(auto-fill, minmax(240px, 1fr))` |
| `gtrAF100` | `grid-template-rows:repeat(auto-fit, minmax(100px, 1fr))` |

**`AF` — `auto-fit`, `AFL` — `auto-fill`.** Обе аббревиатуры претендуют на `AF`
(первые буквы слов), поэтому короткую получает более ходовой `auto-fit` — тот же
принцип, что у `us` (`A` остался за `auto`, `all` получил `AL`).

Второй аргумент `minmax` необязателен, по умолчанию `1fr`. Голое число получает `px`
по сквозному правилу нотации; `fr`, `%`, `em` и прочие явные единицы идут как написаны.

`gtcAF` и `gtcAFL` без размера **бракуются**: до появления сокращения они молча давали
`grid-template-columns:a-f`.

Сокращение не отменяет полную форму — `minmax()` без auto-repeat, именованные линии
и прочее по-прежнему пишутся экранированными скобками:
`gtcRepeat\(auto-fit,minmax\(240px,1fr\)\)`.

---

## Прокрутка (группа B, D-097)

**Отступы прокрутки** `sm` (`scroll-margin`) и `sp` (`scroll-padding`) берут те же стороны, что `p`/`m`: физические
`t`/`b`/`l`/`r`, оси `x`/`y` по `axisMode` (D-101), логические `s`/`e`/`bs`/`be` (A2). У `sm` — только длина, со знаком
(`sm-8`), процентов нет; у `sp` — длина, процент или `A` (auto), без знака.

| Токен | CSS |
|-------|-----|
| `smt80` | `scroll-margin-top:80px` |
| `sm-8` | `scroll-margin:-8px` |
| `smx8` | `scroll-margin-inline:8px` |
| `sms8` | `scroll-margin-inline-start:8px` |
| `smbe8` | `scroll-margin-block-end:8px` |
| `spy16` | `scroll-padding-block:16px` |
| `spA` | `scroll-padding:auto` |
| `sp10%` | `scroll-padding:10%` |
| `spe4` | `scroll-padding-inline-end:4px` |

**Привязка и полоса прокрутки** — закрытые словари; пара значений пишется через `_` и тоже входит в словарь, поэтому
длинная запись (`sst_x_mandatory`) отвечает «Write it shorter: "sstX_M"».

| Тег | Свойство | Значения |
|-----|----------|----------|
| `sst` | `scroll-snap-type` | `N` none; ось `X`, `Y`, `B` block, `I` inline, `BH` both; ось + `_M` mandatory / `_P` proximity — `sstX_M` → `x mandatory` |
| `ssa` | `scroll-snap-align` | `N`, `S` start, `E` end, `C` center; пара «блок_строка» из разных — `ssaC_S` → `center start` |
| `sss` | `scroll-snap-stop` | `N` normal, `A` always |
| `sbw` | `scrollbar-width` | `A` auto, `T` thin, `N` none |
| `sbg` | `scrollbar-gutter` | `A` auto, `S` stable, `SB` stable both-edges |

**`sbc` — `scrollbar-color`:** `A` (auto) или ровно два цвета через `_` — ползунок и дорожка. Каждый цвет — как у `c`:
код, код с альфой, синоним (`CT`, `T`…), переменная (с альфой тоже). Одна переменная — значение целиком.

| Токен | CSS |
|-------|-----|
| `sbcA` | `scrollbar-color:auto` |
| `sbcF00_0` | `scrollbar-color:#f00 #000` |
| `sbcCT_T` | `scrollbar-color:currentColor transparent` |
| `sbcF00.5_0` | `scrollbar-color:rgba(255,0,0,.5) #000` |
| `sbc--thumb_--track` | `scrollbar-color:var(--thumb) var(--track)` |
| `sbc--bar` | `scrollbar-color:var(--bar)` |

Бракуются: один цвет (`sbcF00`), три (`sbcF00_0_0`), неукороченный код с подсказкой на весь токен (`sbcF00_0000` →
«"sbcF00_0.0"»), длинное слово (`sbcCurrentColor_0` → «"sbcCT_0"»). С `altColor` у кода с альфой свойство пишется
дважды: сначала запасная пара, потом основная.

## Сетка и выравнивание (группа C, D-097)

**Одна линия сетки:** `grs` (`grid-row-start`), `gre` (`grid-row-end`), `gcs` (`grid-column-start`), `gce`
(`grid-column-end`). Значение — одна `<grid-line>`: `A` (auto), номер (целый, не 0), имя, `Span` с номером и/или
именем — по одному каждого.

| Токен | CSS |
|-------|-----|
| `gcs2` | `grid-column-start:2` |
| `gce-1` | `grid-column-end:-1` |
| `greA` | `grid-row-end:auto` |
| `grsS_2` | `grid-row-start:span 2` — `S` span |
| `gcs2_Header` | `grid-column-start:2 header` |
| `gceS_2_Header` | `grid-column-end:span 2 header` |

Бракуются: пара через `/` (`gcs1/3` → «both ends are written with "gc1/3"»), `0`, дробь, два номера (`grs2_3`),
`S` без номера и имени, `S` с отрицательным номером, длинные `gcsAuto` и `gcsSpan_2` (→ «Write it shorter: "gcsA"»,
«"gcsS_2"»).

**Пары выравнивания:** `plc` (`place-content`), `pli` (`place-items`), `pls` (`place-self`). Первая часть — `align-*`,
вторая через `_` — `justify-*`; буквы те же, что у одиночных хендлеров: `plc` = `ac` + `jc`, `pli` = `ai` + `ji`,
`pls` = `as` + `js` (таблица букв в «Flex»). Одна часть задаёт обе оси, поэтому в ней только буквы `align-*`:
`plcL` — ошибка, как и `place-content: left`.

| Токен | CSS |
|-------|-----|
| `pliC` | `place-items:center` |
| `pliC_S` | `place-items:center start` |
| `plcSB_C` | `place-content:space-between center` |
| `plcC_L` | `place-content:center left` |
| `plsA_E` | `place-self:auto end` |
| `plc--a_C` | `place-content:var(--a) center` |

Ошибка называет часть и её свойство со списком вариантов целыми токенами (`pliC_Q` → «the second part is
justify-items. Available: pliC_N (normal), …»); длинное слово — «Write it shorter: "pliC_S" instead of "pliC_Start"».

---
## Позиция и трансформация (группа D, D-097)

**Позиция** — один разбор у `op` (`object-position`), `pspo` (`perspective-origin`) и `tfo` (`transform-origin`).
Части через `_`: буквы `L`/`C`/`R`/`T`/`B`, длина или процент (голое число — `px`), переменная, функция. Угол
`TL`/`TR`/`BL`/`BR` — первой частью, разворачивается в два слова. Слова CSS — только буквами (D-113): `op_left_top`
бракуется с подсказкой «Write it shorter: "opL_T"», `op_right_10px_top_20px` — «"opR_10px_T_20px"».

| Токен | CSS |
|-------|-----|
| `opL_T` | `object-position:left top` |
| `opTL` | `object-position:top left` |
| `op50%_0` | `object-position:50% 0` |
| `opL_10` | `object-position:left 10px` |
| `opR_10_B_20` | `object-position:right 10px bottom 20px` |
| `pspoC` | `perspective-origin:center` |
| `tfoTL` | `transform-origin:top left` |
| `tfoC_C_10` | `transform-origin:center center 10px` |

Сочетания — по грамматике: два слова в любом порядке, но не на одной оси (`opL_R` — «both parts are on one axis»); с
длиной порядок x, затем y (`opT_10` — ошибка, пишите `op10_T`); четыре части — сторона и отступ дважды, стороны на
разных осях, без `C`. У `tfo` четырёх частей нет, третья — z, длина без процента (`tfoL_T_50%` — ошибка). Длинное
слово — «Write it shorter: "opC" instead of "opCenter"».

**Остальное:**

| Токен | CSS |
|-------|-----|
| `psp500` | `perspective:500px` — длина без процента и знака |
| `pspN` | `perspective:none` |
| `tfbCB` / `BB` / `FB` / `SB` / `VB` | `transform-box:content-box` / `border-box` / `fill-box` / `stroke-box` / `view-box` |
| `bfvV` / `bfvH` | `backface-visibility:visible` / `hidden` |

---
## Одиночные свойства (группа F, D-097)

| Токен | CSS | Буквы и правила |
|-------|-----|-----------------|
| `accF00`, `accAuto` | `accent-color:#f00`, `auto` | цвет как у `c`; `auto` — словом: `A` — это код `#aaa` |
| `ccF00`, `ccAuto` | `caret-color:#f00`, `auto` | то же |
| `cschL_D` | `color-scheme:light dark` | `N` normal, `L` light, `D` dark; `O` (only) — только второй частью: `cschD_O` |
| `wcT` | `will-change:transform` | `A` auto, `SP` scroll-position, `C` contents, `T` transform, `O` opacity; другое свойство — словом (`wcBackgroundColor`), список — через запятую: `wc_transform,opacity`; число, `none`, `all` — ошибка |
| `cpthBB`, `cpthCircle\(50%\)` | `clip-path:border-box`, `circle(50%)` | `N` none, рамки `BB`/`PB`/`CB`/`MB`/`FB`/`SB`/`VB`; фигура — функцией |
| `fcaN` | `forced-color-adjust:none` | `A` auto, `N` none, `PPC` preserve-parent-color |
| `hyA` | `hyphens:auto` | `N` none, `M` manual, `A` auto |
| `owrA` | `overflow-wrap:anywhere` | `N` normal, `BW` break-word (как у `wb`), `A` anywhere; старое имя `word-wrap` — опцией `overflowWrapMode` (ниже) |
| `tbs4`, `tbs2em` | `tab-size:4`, `2em` | целое число пробелов без `px` или длина; не отрицательное, без `%` |
| `fvnTN_SZ` | `font-variant-numeric:tabular-nums slashed-zero` | `N`, `LN`/`ON`, `PN`/`TN`, `DF`/`SF`, `O`, `SZ`; по одной из группы, в порядке спецификации: `fvnLN_TN_SZ`; `fvnSZ_TN` → «Write "fvnTN_SZ"», `fvnLN_ON` и `fvnN_TN` бракуются |
| `bdbC` | `-webkit-box-decoration-break:clone; box-decoration-break:clone` | `S` slice, `C` clone; префикс нужен Safari |
| `lcl3` | `overflow:hidden; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3` | целое от 1 или переменная; `lclN` снимает обрезку |
| `fszC` | `field-sizing:content` | `F` fixed, `C` content |
| `tnbAD` | `transition-behavior:allow-discrete` | `N` normal, `AD` allow-discrete |
| `atfL`, `atfSteps\(4\)` | `animation-timing-function:linear`, `steps(4)` | `L`, `E`, `EI`, `EO`, `EIO`, `SS` step-start, `SE` step-end; функции как есть |
| `bgbmM` | `background-blend-mode:multiply` | `N`, `M`, `S` screen, `O` overlay, `D`, `L`, `CD`, `CB`, `HL`, `SL`, `DF` difference, `E` exclusion, `H` hue, `ST` saturation, `C` color, `LM` luminosity |
| `ttfEI`, `ttfSteps\(4\)` | `transition-timing-function:ease-in`, `steps(4)` | буквы `atf` (D-106) |
| `mbmM` | `mix-blend-mode:multiply` | буквы `bgbm` и `PD` plus-darker, `PL` plus-lighter (D-106) |

Длинное слово при наличии буквы — «Write it shorter: "hyA" instead of "hyAuto"».

`jump-start`/`jump-end`/`jump-none`/`jump-both` у `ttf`/`atf` — аргументы `steps()`, а не значения свойства;
пишутся функцией: `ttfSteps\(4,jump-end\)`.

**`word-wrap` — старое имя `overflow-wrap`** (D-106). `ww…` даёт ошибку «"wwBW" was renamed: write "owrBW"»
(`wwB` → `owrBW`, `wwNM` → `owrN`) и убирается через выпуск. Для браузеров, что знают только старое имя (IE, Edge
до перехода на Chromium, Firefox до 49), — опция ядра `overflowWrapMode`:

```ts
const mn = minotationProvider({ presets: [presetStandard], overflowWrapMode: 'both' });
// owrBW → word-wrap:break-word;overflow-wrap:break-word — старый браузер берёт первое, новый — второе
// 'legacy' → word-wrap:break-word; 'standard' (по умолчанию) → overflow-wrap:break-word
mn.setOptions({ overflowWrapMode: 'standard' }); mn.recompile(); // живой инстанс
```

---

## Misc

| Токен | CSS |
|-------|-----|
| `ov` | `overflow:hidden` |
| `ovyA` | `-webkit-overflow-scrolling:touch;overflow-y:auto` |
| `irOC` | `image-rendering:optimize-contrast;image-rendering:-webkit-optimize-contrast` (бывший `contrast`, D-094) |
| `ratio3x2` | `padding-top:66.67%` + `>*{position:absolute;top:0;right:0;bottom:0;left:0}` (было `66.66%` до фикса `toFixed`, RESEARCH/05, 2026-09-23) |

---

## Свойства с закрытым перечнем значений

У части свойств набор значений закрыт спецификацией. Такие хендлеры принимают
только слова из своего списка; всё остальное бракуется с предупреждением —
`irZzz`, `apF00`, `gafZzz` в CSS не попадают. До 2026-09-26 проходило
любое слово: `irF00` давал `image-rendering:f00`.

Значения пишутся буквами (D-113); полное слово (`irPixelated`, `ir_pixelated`) бракуется с подсказкой «Write it
shorter: "irP"».

| Тег | Свойство | Буквы |
|-----|----------|-------|
| `ir` | `image-rendering` | `A` auto, `CE` crisp-edges, `P` pixelated, `S` smooth, `OC` optimize-contrast, `OS` optimizeSpeed, `OQ` optimizeQuality; вендорные `MCE` -moz-crisp-edges, `OCE` -o-crisp-edges, `WOC` -webkit-optimize-contrast |
| `ap` | `appearance` | `N` none, `A` auto, `B` button, `MB` menulist-button, `C` checkbox, `R` radio, `L` listbox, `PB` progress-bar, `S` searchfield; `textfield`, `textarea`, `menulist`, `meter` — пока словами (RESEARCH/22, Q3) |
| `gaf` | `grid-auto-flow` | `R` row, `C` column, `D` dense |
| `tds` | `text-decoration-skip` | `N` none, `O` objects, `S` spaces, `LS` leading-spaces, `TS` trailing-spaces, `E` edges, `BD` box-decoration |
| `tdsi` | `text-decoration-skip-ink` | `A` auto, `AL` all, `N` none |
| `tdst` | `text-decoration-style` | `S` solid, `D` double, `DT` dotted, `DS` dashed, `W` wavy |
| `tup` | `text-underline-position` | `A` auto, `FF` from-font, `U` under, `L` left, `R` right |
| `ts` | `transform-style` | `F` flat, `P` preserve-3d |
| `tems` | `text-emphasis-style` | `N` none, `F` filled, `O` open, `D` dot, `C` circle, `DC` double-circle, `T` triangle, `S` sesame |
| `temp` | `text-emphasis-position` | `A` auto, `O` over, `U` under, `R` right, `L` left |

**Несколько слов** берут `tems`, `temp`, `tds`, `tup`, `gaf` — через `_`, буква в каждой части: `temsF_D`, `gafR_D`,
`tempO_R`. Остальные принимают ровно одно, `irA_P` бракуется.

**Слова, которые camelCase ломает** (`preserve-3d` — цифра не даёт дефиса, `-moz-crisp-edges` — ведущий дефис
теряется, `optimizeSpeed` — в спецификации оно camelCase, legacy из SVG), буква пишет точно: `tsP`, `irMCE`, `irOS`.
Длинную запись разбор всё равно узнаёт — `tsPreserve3d`, `tsPreserve3D`, `irMozCrispEdges`, `irOptimizeSpeed` отвечают
подсказкой с буквой.

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
ни в один пресет и не подходит под шаблон диапазона, поэтому остаётся как есть). Такое имя
неизвестно — что с ним делать, решает `unknownMediaMode` (D-058): `'warn'` (по умолчанию) —
как написано и предупреждение, `'silent'` — как написано молча, `'strict'` — брак сборки.
Типы медиа CSS `print`, `screen`, `all` известны без описания.

```typescript
mn.media.dark = { query: '(prefers-color-scheme: dark)' };
```

Таблица ниже (и следующая) показывает только само CSS-объявление внутри правила — реальный
вывод оборачивает его в `@media {...}` и класс-селектор целиком (`@media x{.p10\@x{padding:10px}}`).

| Токен | CSS |
|-------|-----|
| `p10@x` | `padding:10px` (нераспознанное имя `x` — используется как `@media x` буквально, предупреждение `unknown-media`) |

`presetMedias` регистрирует **точки по ширине** (D-054): `m` 992, `m2` 768, `m3` 640, `m4` 480,
`m5` 360, `m6` 320, `m7` 312, `m8` 272; `d` 992, `d2` 1200, `d3` 1600, `d4` 1920, `d5` 2300,
`d6` 2560 — и условия `mouse` (`(pointer: fine) and (hover: hover)`), `hover` (`(hover: hover)` —
им обёрнут синоним `:h`, D-069) и `dark`. Запрос у точки строится по записи в токене:

| Токен | CSS |
|-------|-----|
| `p10@m4` | `@media (width < 480px){.p10\@m4{padding:10px}}` — до точки |
| `p10@d-` | `@media (width >= 992px){.p10\@d-{padding:10px}}` — от точки |
| `p10@m4-d` | `@media (width >= 480px) and (width < 992px){.p10\@m4-d{padding:10px}}` — между точками |
| `p10@480-d` | `@media (width >= 480px) and (width < 992px){.p10\@480-d{padding:10px}}` — число и точка |

Своя точка — `mn.media.tablet = { width: 834 }` (или `height`); `query` вместе с точкой —
предупреждение. Точка может быть и строкой с единицей — `{ width: '48rem' }` (D-069): `@md` →
`(width < 48rem)` (без поправки −0.02px — она только для px), `@md-` → `(width >= 48rem)`. До 2026-10-13 `@d` значило «от 992px», а диапазоны были готовыми именами
(`m4-`, `-d2`) — теперь «от» пишется `@d-`, диапазон — `@m4-m`, `@d-d2`.

Признаки устройства и предпочтения в `presetMedias` (D-057; имена — как у вариантов Tailwind):
`dark`, `light`, `mouse`, `hover`, `print`, `screen`, `portrait`, `landscape`, `motion-safe`,
`motion-reduce`, `contrast-more`, `contrast-less`, `forced-colors`, `inverted-colors`,
`pointer-fine`, `pointer-coarse`, `any-pointer-fine`, `any-pointer-coarse`, `noscript`
(`(scripting: none)`).

#### `@supports` и `@container` (D-057)

Вместо `query` у описания может быть `supports` или `container` — ядро выведет это at-правило.
Через `&` правила вкладываются друг в друга, через `,` — отдельные правила:

```typescript
mn.media.grid = { supports: '(display: grid)' };
mn.media.side = { container: 'sidebar (width >= 448px)' };  // имя контейнера — по желанию
```

| Токен | CSS |
|-------|-----|
| `m1@grid` | `@supports (display: grid){.m1\@grid{margin:1px}}` |
| `m1@side` | `@container sidebar (width >= 448px){.m1\@side{margin:1px}}` |
| `m1@dark&grid` | `@media (prefers-color-scheme: dark){@supports (display: grid){.m1\@dark\&grid{margin:1px}}}` |
| `m1@grid,dark` | `@supports (display: grid){.m1\@grid\,dark{margin:1px}}` и отдельно `@media (prefers-color-scheme: dark){…}` |

### 2. Диапазон прямо в токене — `@{ширина}/{высота}:{контейнер}^{приоритет}` (D-054, D-087, D-088)

Если имя НЕ найдено в `options.media`, оно разбирается как диапазон: ширина, через `/` высота, через `:` —
контейнер. Граница — число (без единицы — px; `rem`, `em`) или имя точки медиа:

```
a      →  до a          (число — включительно: width <= a; точка — нет: width < a)
a-     →  от a          (width >= a)
a-b    →  от a до b
```

Точка в слоте ширины даёт свою сторону (ширину, а без неё — высоту); в слоте высоты — свою высоту: точки без
`height` там нет — предупреждение, CSS нет. Хвостовой `^N` задаёт приоритет; без него он выводится из верхней
границы (шире диапазон — ниже приоритет).

| Токен | Получившееся правило |
|-------|----------------------|
| `f20@768` | `@media (width <= 768px)` |
| `f30@992-` | `@media (width >= 992px)` |
| `f50@1000-1200` | `@media (width >= 1000px) and (width <= 1200px)` |
| `f20@10rem-30rem` | `@media (width >= 10rem) and (width <= 30rem)` |
| `f40@/600` | `@media (height <= 600px)` |
| `f3@/10-60` | `@media (height >= 10px) and (height <= 60px)` |
| `w100@360-1024/100-200:side` | `@container side (width >= 360px) and (width <= 1024px) and (height >= 100px) and (height <= 200px)` |
| `w100@m4-:side` | `@container side (width >= 480px)` |
| `w100@:side` | `@container side` — только по имени: правило действует внутри контейнера `side` |

Запросы к контейнерам — всегда в форме диапазона. Имя контейнера пишется как есть — и в маркере, и в запросе
(D-091): `cn_main-nav` и `@…:main-nav`; имя со строчной буквы — через `_`. Маркер контейнера на родителе — `cn…`
(`container-name`) и,
если запрос по размеру, `ct…` (`container-type`); запросу только по имени `container-type` не нужен:

| Токен | CSS |
|-------|-----|
| `cn_sidebar` | `container-name:sidebar` |
| `cn_main-nav` | `container-name:main-nav` |
| `cnMainNav` | `container-name:MainNav` |
| `cn_side_main` | `container-name:side main` |
| `ctIS` | `container-type:inline-size` |
| `ctS` | `container-type:size` |
| `ctN` | `container-type:normal` |

```html
<aside class="cn_sidebar.active ctIS active">  <!-- контейнер — только у активной панели -->
  <div class="w100@:sidebar">…</div>            <!-- @container sidebar{…} -->
  <div class="dF@360-:sidebar">…</div>          <!-- @container sidebar (width >= 360px){…} -->
</aside>
```

**Бракуется** (предупреждение, CSS нет): ведущий дефис (`@-768`), лишний хвост (`@768-992-1200`), прежний
разделитель высоты `x` (`@768x300`), имя контейнера — не идентификатор CSS (`@:2col`).

**После медиа — ничего, кроме медиа** (D-088): селекторы, состояния и цепочки пишутся до `@`. Медиа кончается
вместе с токеном или с альтернативой группы, в которой стоит `@` (`c00F(@sm|.active)<.parent` — законно):

```
p10<.parent@600      → .parent .селектор { … } внутри @media (width <= 600px)
p10:hover@600        → @media (width <= 600px) { .селектор:hover{padding:10px} }
(p10|m5)@600-900     → @media (width >= 600px) and (width <= 900px) { оба тела в одном блоке }
p10@600<.parent      → брак: «"@600<" — a selector after the media part…»
p10@600:hover        → брак: состояние после медиа (`:hover` — не контейнер)
```

Полный пример — ширина и высота диапазоном одновременно, плюс явный приоритет:

```
f20@768-992/300-600^2
→ @media (width >= 768px) and (width <= 992px) and (height >= 300px) and (height <= 600px){font-size:20px}
```

Опция `mediaSyntax: 'classic'` (D-087) — те же условия через `min-`/`max-` для старых браузеров:
`f20@768` → `(max-width: 768px)`, `p10@m4` → `(max-width: 479.98px)`.

---

## Состояния и контекст

```
bgF.1:h              → background on :hover
cF.38.paused         → color when element has class "paused"
bgcF.12.active       → background-color when element has class "active"
```

| Токен | CSS |
|-------|-----|
| `bgF.1:h` | `.bgF\.1\:h:hover{background:rgba(255,255,255,.1)}` внутри `@media (hover: hover)`: `:h` = `:hover@hover` — на тачскринах hover после тапа не «залипает» (D-069); hover на любом устройстве — `bgF.1:hover` |
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

## Часть имени класса или id: `.*` и `#*`, `#^`, `#$`

`.*текст` — элемент, в классе которого **есть** `текст` (`[class*=текст]`); `#*текст` — то же
для `id`. Удобно для чужих компонентов с генерируемыми именами (`MuiSlider-root`,
`css-1x2y3z-active`). Работает везде, где селектор: на самом элементе, у предка `<`, у
потомка `>`.

| Токен | CSS |
|-------|-----|
| `cF00.*-active` | `.cF00\.\*-active[class*=-active]{color:#f00}` — сам элемент |
| `cF00<.*-active` | `[class*=-active] .cF00\<\.\*-active{color:#f00}` — предок |
| `cF00>.*MuiSlider` | `.cF00\>\.\*MuiSlider [class*=MuiSlider]{color:#f00}` — потомок |
| `cF00#*-disabled` | `.cF00\#\*-disabled[id*=-disabled]{color:#f00}` — по `id` |
| `cF00.*-active:h` | `.cF00\.\*-active\:h[class*=-active]:hover{color:#f00}` — с состоянием |
| `cF00<.*-active>.*-item` | `[class*=-active] .cF00\<\.\*-active\>\.\*-item [class*=-item]{color:#f00}` |

| `cF00#^main` | `.cF00\#\^main[id^=main]{color:#f00}` — `id` **начинается** с `main` |
| `cF00#$-x` | `.cF00\#\$-x[id$=-x]{color:#f00}` — `id` **заканчивается** на `-x` |
| `cF00>.*1x` | `.cF00\>\.\*1x [class*="1x"]{color:#f00}` — кавычки, только если без них значение не идентификатор |

`*=` — «содержит» в любом месте значения атрибута: `.*-active` подходит и к `btn-active`,
и к `is-active-now`. «Начинается с» и «заканчивается на» есть только у `id` (`#^`, `#$`): у
`class` CSS проверял бы начало и конец **всей строки** атрибута, а не каждого класса
(`class="card btn-x"` не начинается с `btn-`), поэтому `.^`/`.$` — брак с предупреждением.

Висячая `*` в конце (`.*a*`) — брак с предупреждением: в CSS ушла бы лишняя `*`.

## Соседи: `+` и `~`

`+` (следующий сосед) и `~` (любой следующий сосед) — обычные CSS-комбинаторы внутри
контекста `<`/`>`. Работают в обе стороны.

**Сосед перед элементом** — комбинатор в конце сегмента предка. Элемент стилизуется, когда
перед ним стоит сосед с селектором — аналог `peer-*` из Tailwind:

```html
<input class="peer" type="email" />
<p class="dN cF00<.peer:invalid~">Неверный адрес</p>
```

| Токен | CSS |
|-------|-----|
| `cF00<.peer+` | `.peer+ .cF00\<\.peer\+{color:#f00}` — элемент сразу после `.peer` |
| `c00F<.peer~` | `.peer~ .c00F\<\.peer\~{color:#00f}` — любой элемент после `.peer` |
| `cF00<.peer:f~` | `.peer:focus~ .cF00\<\.peer\:f\~{color:#f00}` — после соседа в фокусе |
| `cF00<.peer~@md` | то же внутри `@media` |
| `p10<.a~<.b` | `.b .a~ .p10\<\.a\~\<\.b{padding:10px}` — сосед `.a` внутри `.b` |

Пробел после комбинатора в CSS незначим: `.peer~ .x` — то же, что `.peer ~ .x`.

**Сосед после элемента** — комбинатор после класса: стилизуется сосед.

| Токен | CSS |
|-------|-----|
| `c0F0+.peer` | `.c0F0\+\.peer+.peer{color:#0f0}` — `.peer` сразу после элемента |
| `cF00~*` | `.cF00\~\*~*{color:#f00}` — все следующие соседи |
| `cF00>1+.b` | `.cF00\>1\+\.b>*+.b{color:#f00}` — `.b` сразу после любого прямого ребёнка |

Висячий комбинатор без предка (`p10~`, `p10+`, `p10>1~`) — брак с предупреждением: соседа
не задано, в CSS ушёл бы мусор.

История: в v1 оба направления работали. С 2026-09-24 проверка висячих сепараторов ошибочно
отбраковывала и `cF00<.peer~`; исправлено 2026-10-12. `cF00>1+.b` давал битый `>+.b` (и в
v1) — исправлено тогда же.

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
apN → .apN{-webkit-appearance:none;appearance:none}   (без -moz-appearance)
ov     → .ov{overflow:hidden}   (вне списка — без префиксов)
```

Список префиксуемых свойств расширяется через `propertiesStringify.prefixedAttrs` (см.
`src/presets/prefixes/index.ts`) — не входит в объём этого документа, читать исходник при
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
  presets: [presetStandard, presetSynonyms, presetMedias, presetNormalize8_0_1, presetMain],
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
| `m0_A` | `margin:0 auto` |
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

**Значение проверяет сам хендлер** — там, где оно формируется, и где список
допустимого известен точно. В ядре осталась одна универсальная эвристика
(`REGEXP_INVALID_CSS_VALUE`) на узнаваемый мусор: `undefined`, `NaN`, `Rpx`.

До 2026-09-27 в ядре жила ещё и таблица «CSS-свойство → валидатор»
(`cssGrammar.ts`). Она проверяла ~40 свойств по грамматике, но жила отдельно
от хендлеров и ничего о них не знала: хендлер учился отдавать новую форму
значения — таблица не в курсе, и **корректный** CSS молча отбраковывался.
Так было четыре раза: `var()`, многозначные shorthand'ы, градиенты в
`background`, `gap: normal`. Каждый раз это находил человек, наткнувшись на
неработающий стиль.

Что проверяется теперь — по классам:

| Класс | Примеры отбраковки |
|-------|--------------------|
| Единица измерения | `w10zz`, `ti10s`, `rx10px` (поворот — только угол) |
| Знак | `p-5`, `w-5`, `r-5` — эти свойства отрицательных не принимают |
| Процент | `b10%`, `olw10%`, `wos10%` |
| Количество значений | `olw10_20`, `ti10_20`, `gr10_20` |
| Слово из списка свойства | `irZzz`, `apF00`, `fwZzz`, `pA` |
| Число там, где перечень закрыт | `pos10`, `ov1.5`, `d10px` |
| Форма составного значения | `fx_1_1_1_1`, `col_30em_3`, `g_1fr_1fr` |

Подстановки `var()`/`env()` валидны у любого свойства и не проверяются: по
спецификации грамматика к ним не применяется, это делает браузер уже после
подстановки.

**Сторожем со стороны спецификации служит тест**, а не рантайм: он прогоняет
весь реестр пресета через `css-tree` с `mdn-data` и сверяет каждый вывод с
официальной грамматикой. Вес там не важен — эта библиотека в рантайм не
попадает.

---

## Почему чего-то нет

Раздел на случай, если привычное CSS-свойство или запись не нашлись. Причин
три, и все они — следствие одного правила: **один способ на одно значение**.

### Свойства нет, потому что оно есть под другим именем

Сначала проверьте по таблицам выше и через `pnpm try`:

```bash
pnpm try 'hmin100dvh' 'gtcAF240' 'bxsh19x5y5r3c43F'
```

Много раз «отсутствующая» возможность оказывалась просто названной иначе или
требующей экранирования. Тег строится из первых букв слов свойства:
`background-position-x` → `bgpx`, `text-underline-offset` → `tuo`,
`overscroll-behavior` → `ovb`.

## Справочник: теги, не описанные выше

Сверка 2026-10-02: из 278 зарегистрированных тегов 122 не упоминались в этом
документе. Большинство — порождённые варианты сторон (`bclb` это `bc` плюс угол),
они покрыты правилом сторон. Остальные 55 собраны здесь: каждая строка проверена
компиляцией, и тест разбирает эти таблицы автоматически — расхождение документа
с поведением станет падением, а не тихим дрейфом.

### Размеры и пропорции

| Токен | CSS |
|-------|-----|
| `wmax10` | `max-width:10px` |
| `hmax10` | `max-height:10px` |
| `sqmin40` | `min-width:40px;min-height:40px` |
| `sqmax10` | `max-width:10px;max-height:10px` |
| `ar16/9` | `aspect-ratio:16/9` |
| `zm2` | `zoom:2` |

`sqmin`/`sqmax` задают квадрат одним токеном — обе оси сразу. У `wmax`/`hmax`
своя грамматика: `none` — их initial value, а `auto` наоборот невалиден (см.
раздел про размерные свойства выше).

### Типографика — остальные свойства

| Токен | CSS |
|-------|-----|
| `fsI` | `font-style:italic` |
| `fstC` | `font-stretch:condensed` |
| `fsa10` | `font-size-adjust:10` |
| `fsmN` | `font-smooth:never` |
| `fefN` | `font-effect:none` |
| `tjN` | `text-justify:none` |
| `twB` | `text-wrap:balance` |
| `tsa10` | `text-size-adjust:10%` |
| `wsP` | `white-space:pre` |
| `wscP` | `white-space-collapse:preserve` |
| `owrN` | `overflow-wrap:normal` (бывший `wwN`, D-106) |
| `tov` | `text-overflow:ellipsis` |

`tov` без аргумента даёт `ellipsis` — самый частый случай обрезки текста.

### Прокрутка и изменение размера

| Токен | CSS |
|-------|-----|
| `ovsM` | `overflow-style:move` |
| `ovscA` | `-webkit-overflow-scrolling:auto` |
| `rszB` | `resize:both` |

### Печать и разрывы страниц

| Токен | CSS |
|-------|-----|
| `pgbbA` | `page-break-before:auto;break-before:auto` |
| `pgbiA` | `page-break-inside:auto;break-inside:auto` |
| `orp3` | `orphans:3` |

Разрывы пишутся парой: устаревшее `page-break-*` для старых движков и
современное `break-*` — браузер берёт то, что понимает.

### Таблицы

| Токен | CSS |
|-------|-----|
| `bdclC` | `border-collapse:collapse` |
| `ecH` | `empty-cells:hide` |
| `cpsT` | `caption-side:top` |

### Взаимодействие

| Токен | CSS |
|-------|-----|
| `peN` | `pointer-events:none` |
| `peA` | `pointer-events:auto` |
| `peAL` | `pointer-events:all` |
| `apN` | `appearance:none` |

### Фон и маска

| Токен | CSS |
|-------|-----|
| `bgcpT` | `background-clip:text` |
| `bgbkC` | `background-break:continuous` |
| `bgoPB` | `background-origin:padding-box` |

#### Маски — семейство `mk…` (E2, D-097)

Зеркало `bg…`: `mk` — градиент (как `bg`), `mki` — url (как `bgi`), остальные — как `bgs`/`bgr`/`bgo`/`bgcp`.

| Токен | CSS | Буквы |
|-------|-----|-------|
| `mkF00-00F` | `mask-image:linear-gradient(180deg,#f00 0%,#00f 100%)` | цвета не принимает: `mkF00` — ошибка |
| `mki_a\.png`, `mkiN` | `mask-image:url("a.png")`, `none` | как `bgi` |
| `mksCV`, `mks50%_A`, `mks10` | `mask-size:cover`, `50% auto`, `10px` | `A`, `CT` contain, `CV` cover; голое число — `px` |
| `mkpTL`, `mkpR_10_B_20` | `mask-position:top left`, `right 10px bottom 20px` | разбор позиции как у `op` |
| `mkrN` | `mask-repeat:no-repeat` | `R`, `N`, `X`, `Y`, `SP` space, `RD` round; пусто — `repeat` |
| `mkoCB` | `mask-origin:content-box` | `BB`, `PB`, `CB`, `FB`, `SB`, `VB` |
| `mkcpNC` | `mask-clip:no-clip` | рамки `mko` и `NC` no-clip |
| `mkcI` | `mask-composite:intersect` | `A` add, `S` subtract, `I` intersect, `E` exclude |
| `mktA` | `mask-type:alpha` | `L` luminance, `A` alpha |
| `mkmMS` | `mask-mode:match-source` | `L`, `A`, `MS` match-source |

Старых имён `maskbg`, `maski`, `maskt`, `maskm` больше нет — убраны сразу, без ответа «переименовано»: в прошлой
версии ими почти не пользовались (D-104).

### `border-image` и его стороны

| Токен | CSS |
|-------|-----|
| `bi10` | `border-image:10` |
| `bil5` | `border-left-image:5` |

Суффиксы сторон работают как у остальных рамочных свойств: `bil`, `bir`, `bit`,
`bib`, плюс углы (`bilt`, `birb`, …).

### Остальное

| Токен | CSS |
|-------|-----|
| `cpA` | `clip:auto` |
| `dirRTL` | `direction:rtl` |
| `lispI` | `list-style-position:inside` |
| `fxfR` | `flex-flow:row` — `R` row, `RR` row-reverse, `C` column, `CR` column-reverse, `NW` nowrap, `W` wrap, `WR` wrap-reverse |
| `fxfR_W` | `flex-flow:row wrap` |
| `olo3` | `outline-offset:3px` |
| `stroke2` | `stroke:#222` |
| `spnr1` | `animation:spinner-animate 1ms infinite linear` |

### `float` — три тега без аргумента

| Токен | CSS |
|-------|-----|
| `flL` | `float:left` (бывший `lt`, D-094) |
| `flN` | `float:none` (бывший `jt`) |
| `flR` | `float:right` (бывший `rt`) |

Имена короткие и аргумента не принимают: `jtN`, `jtLeft` и подобное правила не
дают вовсе. Неочевидно здесь другое: `lt` и `rt` совпадают с суффиксами углов
(`blt` — это `b` плюс угол `lt`). Конфликта нет, потому что тег выбирается по
самому длинному совпадению, но помнить об этом стоит.

### Общий шорткат убран, потому что есть атомарные теги

| Убрано | Писать так | Когда |
|--------|-----------|-------|
| `ol3px_solid_red` | `olw3 olsS olcF00` | 2026-09-26 |
| `font16px/1.55_--font` | `f16 lh1.55 ff--font` | 2026-09-27 |
| `bgp`, `bgpx`/`bgpy` в одном | `bgpx` и `bgpy` раздельно | 2026-09-24 |

Довод не в длине записи, а в том, что два способа задать один стиль плодят
зоопарк: с ростом числа стилей побеждает атомарная форма — и по числу правил
в CSS тоже.

**Шорткаты, которые остались**, — те, у которых атомарного аналога нет:

- `tn` — разные параметры для разных свойств в одном значении
  (`tn_color_0.2s_E,transform_0.4s_L`);
- `bxsh`/`tsh` — тень это одно значение из пяти частей, отдельных свойств для
  них в CSS не существует;
- `fx` — `flex: 1 1 auto` задаёт три свойства сразу, и браузер трактует
  сокращённую форму иначе, чем три отдельных;
- `font` — только `fontInherit` и системные шрифты: они задают весь набор
  шрифтовых свойств разом, а `font-variant` и `font-stretch` отдельных тегов
  не имеют;
- `g`/`gt` — области сетки в кавычках.

### Значение пишется аббревиатурой, а не полным словом

`dB` вместо `dBlock`, `aiC` вместо `aiCenter`, `jcSB` вместо
`jcSpaceBetween`. Полная форма у этих значений **бракуется** — иначе одно и
то же попадало бы в CSS двумя правилами.

Слово CSS пишется буквой везде, в любой части значения и в любом режиме (D-113): `irP`, `apMB`, `temsDC`,
`dI_FR`; `irPixelated`, `ir_pixelated` и `d_inline_flow-root` бракуются с подсказкой. Полностью пишутся только
имена (анимации, шрифта, линии сетки, счётчика), функции и числа. Слова, буква которых ждёт решения (совпадение
букв, `min-content`/`max-content`, ключевые слова `an`), перечислены в RESEARCH/22 и в тесте
`abbreviation-sweep.test.ts` (`PENDING`): до решения они пишутся словом.

Цвет задаётся кодом, а не именем: `cF00`, не `cRed`. По той же причине —
`red` и `#f00` дали бы два правила для одного цвета.

### Чего действительно нет

- **Именованные цвета** (`red`, `tomato`) — см. выше.
- **Свой порядок частей** в составных значениях. `tn_0.2s_A` бракуется,
  хотя CSS такую запись принимает: грамматика там свободная (`||`), а нотация
  фиксирует один порядок, чтобы ошибка называлась словами.
- **Проприетарные значения**, которых нет в стандарте: `bsW` → `wave`,
  `bsDTDS` → `dot-dash` убраны 2026-09-26 — это набор старой Mozilla,
  работавший только под `-moz-border-*-style`.

Если нужного действительно нет — значение пишется свободной формой через
ведущий `_` (`cnt_attr\(href\)`) или через CSS-переменную.

---

## `warningMode` — что делать с предупреждением

Предупреждение (`MnWarning`) — битый аргумент хендлера, невалидное CSS-значение:
токен не даёт CSS-правила, остальная компиляция идёт дальше. Что с ним делать,
решает одна опция (D-035). Превышение `maxDepth`, `*N` и `-i` ей не подчиняются —
у них свои режимы (следующий раздел).

| `warningMode` | Что происходит |
|---|---|
| `'log'` (по умолчанию) | печать: ядро — в `console.warn`, плагины сборщиков — в лог сборки |
| `'silent'` | молчать; предупреждение остаётся в `mn.warnings$` |
| `'error'` | после `compile()` — `MnWarningError` со всеми предупреждениями; сборка падает |

Колбэк `onWarning` вызывается на каждое предупреждение при любом режиме —
для своей обработки (метрики, отчёт), не вместо режима.

```typescript
// По умолчанию — 'log'.
const mn = minotationProvider({ presets: [presetStandard] });

// Своя сборка, где состав токенов под контролем: опечатка роняет сборку.
const mn = minotationProvider({ presets: [presetStandard], warningMode: 'error' });
mn.getCompiler('class')('w10zz');
mn.compile();
// → throw MnWarningError: "MN: 1 warning(s) during compile (warningMode: 'error'): ..."

// Колбэк — дополнительно к режиму.
minotationProvider({ warningMode: 'silent', onWarning: (w) => report.push(w) });
```

Бросок происходит после того, как вся работа `compile()` сделана: `styles$` успевает
обновиться, колбэк `onWarning` к этому моменту вызван для каждого предупреждения.

**Почему по умолчанию не `'error'`.** Чужие классы без хендлера (`container`,
`btn`, `sr-only`) предупреждений не дают вовсе, но токены минотации по форме — обычные
классы, и на реальной разметке ложные срабатывания всё же случаются. `'error'` уместен
там, где состав токенов контролируется полностью — свой сайт на минотации: реальная
опечатка в токене стоит того, чтобы уронить сборку, а не тихо потерять правило.

**Плагины сборщиков** не оборачивают компиляцию в try/catch: `MnWarningError`
доходит до сборщика как обычная ошибка плагина и роняет сборку штатно. Опция — на
верхнем уровне, как все опции ядра (D-034):

```javascript
// astro.config.mjs / vite.config.ts
mnAstro({ attrs: 'class', warningMode: 'error' })
```

---

## `maxDepthMode`, `specificityMode`, `importantMode`, `childSelectorMode` — свои режимы (D-039, D-041)

Четыре случая, когда токен формально верен, но говорит о проблеме в вёрстке:

| Опция | Токен | Почему подозрительно |
|---|---|---|
| `maxDepthMode` (при заданном `maxDepth`) | `p10<5.card` | длинная цепочка предков ломается при правке промежуточной разметки |
| `specificityMode` | `f10*2` | стили компонента перебивают весом селектора — компоненты воюют между собой |
| `importantMode` | `f10-i` | `!important` перебивает всё, включая то, чем управляет сам компонент |
| `childSelectorMode` | `cF00>1`, `cF00>.child` | стилизует элементы, которыми компонент не владеет |

У всех четырёх одни режимы, по умолчанию `'warn'`; `warningMode` на них не влияет:

| Режим | Что происходит |
|---|---|
| `'warn'` (по умолчанию) | CSS есть, предупреждение с подсказкой — в `console.warn` и `onWarning`; сборку не роняет даже при `warningMode: 'error'` |
| `'silent'` | CSS есть, ни слова — даже при `warningMode: 'log'` |
| `'strict'` | токен не даёт CSS; после `compile()` — `MnForbiddenTokenError` со списком токенов; сборка падает |

```ts
mnAstro({ specificityMode: 'strict', importantMode: 'silent' });
```

**Предел `*N` — `maxSpecificity`, `maxSpecificityMode` (D-089).** Множитель не больше `maxSpecificity` (1…16, по
умолчанию 16; выше 16 опцию не задать). Сверх предела — `max-specificity`:

| Режим | `p10*5` при `maxSpecificity: 3` | `p10*200` |
|---|---|---|
| `'warn'` (по умолчанию) | предупреждение, CSS есть | предупреждение, CSS нет — выше потолка 16 |
| `'strict'` | CSS нет, `MnForbiddenTokenError` | CSS нет, `MnForbiddenTokenError` |

`specificityMode` (выше) решает, допустим ли `*N` вообще; `maxSpecificity` — насколько.

```
[minotation] f10*2: Specificity is raised ("*2") — this may mean that component styles override
  each other. To hide this warning: specificityMode: 'silent'; to forbid such tokens: specificityMode: 'strict'.

MnForbiddenTokenError: MN: 1 forbidden token(s):
  f10*2: Raising specificity ("*2") is forbidden (specificityMode: 'strict'), the token gives
  no CSS. To allow it: specificityMode: 'warn'.
```

Тон сообщений нейтральный: такая запись может быть осознанным решением. Как
переопределять токены компонента без накрутки — раздел про `mne`/`mnClass` выше.

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
