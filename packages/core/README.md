# minotation

Minotation — компактная нотация для генерации CSS.
Наследник [minimalist-notation](https://github.com/mr-amirka/minimalist-notation) (1.x).

```bash
npm install minotation
```

## Быстрый старт

```ts
import { minotationProvider, presetStandard, presetSynonyms, presetMedias } from 'minotation';

const mn = minotationProvider();
mn.setPresets([presetStandard, presetSynonyms, presetMedias]);

// Скармливаем токены (компилятор по атрибуту: 'class' / 'className')
mn.getCompiler('class')('p10 cF00 fx bgFFF fwBold:h');

// Компилируем
mn.compile();

// Получаем CSS
for (const block of mn.styles$.getValue()) {
  console.log(block.content);
}
// → .p10{padding:10px}.cF00{color:#F00}.fx{display:flex}...
```

## CSS-переменные в значениях

Любой хендлер значения принимает `--name` и отдаёт `var(--name)`; тройной дефис — `env()`.

```
w--sidebar     → width: var(--sidebar)
c--ink         → color: var(--ink)
bg--panel      → background: var(--panel)
bc--line       → border-color: var(--line)
ff--mono       → font-family: var(--mono)
w--gap,10px    → width: var(--gap,10px)
pt---safe-top  → padding-top: env(--safe-top)
```

`_` разделяет части значения, и каждая часть проверяется отдельно — поэтому переменные
работают и внутри шорткатов:

```
ol3px_solid_--marker  → outline: 3px solid var(--marker)
tnA_0.2s_--ease       → transition: all 0.2s var(--ease)
```

Если `_` нужен в самом имени переменной — имя закрывают `;`:

```
w--my_width;                   → width: var(--my_width)
ol--border_size;_solid_--marker → outline: var(--border_size) solid var(--marker)
```

Это рабочий способ темизации (светлая/тёмная тема на переменных) без дублирования классов.

## Токены

```
p10           → padding: 10px
w50p          → width: 50%
f1_5em        → font-size: 1.5em  (_ = .)
m-5           → margin: -5px
cF00          → color: #F00
bgTransparent → background: transparent
fx            → display: flex
p10-i         → padding: 10px !important  (-i = !important)
```

## Контекст

```
cF00:h        → .cF00:hover          (состояние; внутри @media (hover: hover), D-069)
cF00<.parent  → .parent .cF00        (родитель)
cF00@m        → @media (...) {...}   (медиа)
cF00<.p>.c    → .p .cF00 .c          (смешанная цепочка)
```

## Варианты и состояния без JS

**Принцип.** Все токены в `className` — статические строки. Вариант или состояние — это обычный
класс (или атрибут) на элементе, а токены, которые от него зависят, уточнены им прямо в записи.
Классы в JS не выбираются.

Каждый пример ниже проверяется тестом `src/__tests__/docs-variants.test.ts`.

Почему так: сборщик берёт токены из **литералов** атрибута `class`/`className` — сканирует
исходники, а не исполняет их. Литералы, которые могут стать значением, он берёт: ветви
`cond ? 'a' : 'b'`, правую часть `cond && 'a'`, обе части `a || 'b'` и `a ?? 'b'`. Аргументы
`clsx(...)` и склейку имён (`'bg' + color`) он не видит: сборка зелёная, а токенов в CSS нет —
элемент просто не стилизуется. Но и там, где `?:` сработает, запись с уточнением лучше: она одна
на N вариантов, а состояние видно в разметке и в CSS (`.x.splash`).

### Два варианта по классу

```tsx
// variant: 'splash' | 'transition'
<div className={`dF aiC jcC (fx1|o0.5).transition (bg1D2A4D|cF).splash ${variant}`} />
```
```css
.\(fx1\|o0\.5\)\.transition.transition{flex:1}
.\(fx1\|o0\.5\)\.transition.transition{opacity:.5}
.\(bg1D2A4D\|cF\)\.splash.splash{background:#1d2a4d}
.\(bg1D2A4D\|cF\)\.splash.splash{color:#fff}
```
`${variant}` ставит на элемент класс `splash` или `transition`, а уточнённые им токены
срабатывают только при нём. Статические части шаблонной строки сканер берёт — подстановка ему
не мешает.

### Два способа: «все, кроме» и «каждому своё»

```tsx
// А — через отрицание: всё, что не splash
`(fx1|o0.5):not[.splash] (bg1D2A4D|cF).splash ${variant}`

// Б — каждый вариант уточняет свои токены своим классом
`(fx1|o0.5).transition (bg1D2A4D|cF).splash ${variant}`
```
Оба дают одно и то же для двух вариантов. **Б масштабируется**: добавили третий вариант
`'error'` — при А он молча получит `fx1 o0.5` (он ведь «не splash»), при Б — только то, что
уточнено классом `.error`. Предпочтительна **Б**; А — когда «все остальные» действительно
должны выглядеть одинаково.

### Логическое состояние: вкладка, переключатель, выключенная кнопка

```tsx
<button className={`c9 (c3|bb2|bsS|bc0A7).active ${isActive ? 'active' : ''}`}>Вкладка</button>
<button className="o0.5.disabled" disabled={off} />   // класс disabled ставит компонент
```
```css
.c9{color:#999}
.\(c3\|bb2\|bsS\|bc0A7\)\.active.active{color:#333}
… border-style:solid; border-color:#0a7; border-bottom-width:2px — так же
.o0\.5\.disabled.disabled{opacity:.5}
```
Выбирается только **имя состояния** (`'active'`), а не токены: `isActive ? 'active' : ''` —
обычная строка-класс, к нотации она не относится.

### Состояние через атрибут: data-* и ARIA

```tsx
<span className="cF00[data-variant=error] c0A0[data-variant=success]" data-variant={variant} />
<button className="fwB[aria-pressed=true]" aria-pressed={pressed} />
<a className="cF00(.active|[aria-current=page])" aria-current={current ? 'page' : undefined} />
```
```css
.cF00\[data-variant\=error\][data-variant=error]{color:#f00}
.c0A0\[data-variant\=success\][data-variant=success]{color:#0a0}
.fwB\[aria-pressed\=true\][aria-pressed=true]{font-weight:bold}
.cF00\(\.active\|\[aria-current\=page\]\).active,
.cF00\(\.active\|\[aria-current\=page\]\)[aria-current=page]{color:#f00}
```
Атрибут удобнее класса, когда он и так нужен (ARIA для доступности): одно состояние — один
источник.

### Три варианта и больше

```tsx
// size: 'small' | 'medium' | 'large'
<span className={`f14 f12.small f18.large ${size}`} />
```
```css
.f14{font-size:14px}
.f12\.small.small{font-size:12px}
.f18\.large.large{font-size:18px}
```
`f14` — значение по умолчанию (`medium`), варианты его перебивают: `.f12.small` специфичнее
`.f14` (два класса против одного), поэтому порядок правил в CSS не важен.

### Состояние родителя меняет детей

```tsx
<div className="card">
  <h3 className="c3 c0A7<.card:h tdU<.card:h">Заголовок</h3>
</div>
```
```css
.c3{color:#333}
@media (hover: hover){
  .card:hover .c0A7\<\.card\:h{color:#0a7}
  .card:hover .tdU\<\.card\:h{text-decoration:underline}
}
```
`<.card:h` — «внутри наведённой `.card`». Так же — открытый родитель (`<.open`), выбранная
строка таблицы (`<tr.selected`).

### Группировка, медиа и наведение

- `(a|b).active` — один уточнитель на несколько токенов вместо `a.active b.active`.
- Специфичность: уточнённый токен — два класса (`.x.active`), без уточнения — один (`.x`).
  Поэтому «база + вариант» не зависит от порядка правил.
- С медиа и наведением: `bgE.active:h@m2` →
  `@media (width < 768px) and (hover: hover){.bgE\.active\:h\@m2.active:hover{background:#eee}}`.

### Не делайте так

| Как | Что будет |
|---|---|
| `className={clsx({ fwB: active })}`, `classnames(...)` | ни одного из этих токенов в CSS: аргументы чужих функций не сканируются; сборка зелёная |
| `className={'bg' + color}`, `` `c${tone}` `` | имя токена собирается в рантайме — сканер его не видит |
| `className={'p10 ' + (on ? 'cF' : 'c0')}` | склейка: значение вычисляется, токенов нет ни из одной части |

`className={cond ? 'bgE c3' : 'cF'}`, `cond && 'fwB'`, `x || 'c3'`, `` `p10 ${on ? 'cF' : 'c0'}` `` (и то же в переменной
`const thClass = isOpen ? 'dB' : 'dN'`) сканер читает — это не ошибка, но для вариантов
предпочтительна запись с уточнением.

Вместо этого — статические токены, уточнённые классом или атрибутом состояния (всё выше).
Это про **сборку** (плагины, CLI): они сканируют исходники. Рантайм (`minotation-runtime`)
компилирует классы из DOM, и там сработает любая запись — но запись с уточнением всё равно
лучше: она одинакова для сборки и рантайма, а состояние видно в самой разметке.
`classVarSuffixes` (`const thClass = '…'`) и `mnClass` — для **повторно используемых наборов**
токенов, а не для вариантов.

## Пресеты

Пресеты подключаются только явно (D-110): набора по умолчанию нет ни у плагинов и CLI, ни у
`<MnIframe>` — без `presets` они сообщают об ошибке, а не собирают пустой CSS. Ядро тянет в
сборку только те пресеты, что импортированы: `import { minotationProvider }` не приносит кода
ни одного из них.

| Пресет | Описание |
|--------|----------|
| `presetStandard` | 40+ обработчиков: размеры, отступы, цвета, flex, transform |
| `presetSynonyms` | Синонимы: `h`→`:hover`, `f`→`:focus`, `a`→`:active` |
| `presetMedias` | Точки по ширине `m…`/`d…` (`@m4` — до 480px, `@d-` — от 992px, `@m4-d` — между), `mouse`, `dark`, `light`, `print`, `portrait`, `landscape`, `motion-safe`/`motion-reduce`, `contrast-more`/`contrast-less`, `forced-colors`, `pointer-fine`/`pointer-coarse`, `noscript` и другие (D-054, D-057) |
| `presetNormalize3_0_3` … `presetNormalize8_0_1`, `presetModernNormalize1_1_0` … `presetModernNormalize3_0_1` | Сброс — эталон normalize.css / modern-normalize один в один, версия — в имени (D-108). Требований нет — работает и один. См. «Сброс: пресеты normalize» ниже |
| `presetMain` | Полный CSS-сброс (аналог normalize.css) |
| `presetHints` | Подсказки вместо молчания: `t0` → «did you mean `st0`?», `mh100vh` → «did you mean `hmin100vh`?» (D-093), `flex` → «в minotation это `dF`», `text-center` → `taC`. Подключать первым — пресет ниже перекрывает его хендлеры. Точечно — фабрикой: `presetHints({ excludeGroups: ['bootstrap'], excludeHandlers: ['flex'] })`; группы — `typos`, `tailwind`, `bootstrap` (D-024, D-042) |
| `presetPrefixes` | Опциональные `-webkit-`/`-moz-` дубли для заданного списка свойств (`transform`, `flexDirection`, `appearance`, …) |
| `presetTw4` | Клон Tailwind 4 (подмножество) — **вместо** `presetStandard`, запись `'tw4-compatible'`, тема Tailwind 4.3.3 (D-068). См. «Клон Tailwind 4» ниже |

### Сброс: пресеты normalize (D-108)

У каждого эталона — свой пресет, версия — в имени: пресет воспроизводит CSS эталона из npm один в один
(селекторы, объявления, их порядок). Приложение выбирает версию под свои браузеры и перечисляет её в
`presets`, как любой пресет (D-110).

| Пресет | Эталон | Браузеры эталона |
|--------|--------|------------------|
| `presetNormalize3_0_3` | normalize.css 3.0.3 | Chrome, Firefox, Opera (последние), Firefox ESR, Safari 6+, IE 8+ |
| `presetNormalize4_2_0` | normalize.css 4.2.0 | Chrome, Edge, Firefox, Opera (две последние), Firefox ESR, Safari 6+, IE 8+ |
| `presetNormalize5_0_0` | normalize.css 5.0.0 | то же, что 4.2.0 |
| `presetNormalize6_0_0` | normalize.css 6.0.0 | то же + iOS Safari (две последние) |
| `presetNormalize7_0_0` | normalize.css 7.0.0 | то же, что 6.0.0 |
| `presetNormalize8_0_1` | normalize.css 8.0.1 | Chrome, Edge, Opera, Firefox ESR+, Safari 8+, IE 10+ |
| `presetModernNormalize1_1_0` | modern-normalize 1.1.0 | последние Chrome, Firefox, Safari |
| `presetModernNormalize2_0_0` | modern-normalize 2.0.0 | последние Chrome, Firefox, Safari |
| `presetModernNormalize3_0_1` | modern-normalize 3.0.1 | последние Chrome, Firefox, Safari |

```ts
import { presetHints, presetStandard, presetSynonyms, presetMedias, presetNormalize8_0_1 } from 'minotation';

mnVite({ presets: [presetHints, presetStandard, presetSynonyms, presetMedias, presetNormalize8_0_1] });
```

Лицензии эталонов (MIT) — в `THIRD_PARTY_NOTICES.md` пакета и в шапке каждого файла пресета; в CSS
результата баннер не пишется.

### Режим синтаксиса `notationMode` (D-045, D-046)

`'context-qualified'` (по умолчанию) — запись minotation: `cF00:h<.group@md` (медиа — в конце, D-088).
`'tw4-compatible'` — варианты перед классом, как в Tailwind: `md:hover:group-hover:cF00`.

```ts
const mn = minotationProvider({ notationMode: 'tw4-compatible' });
mn.synonyms({ hover: ':hover', invalid: ':invalid' });   // приставки — синонимы и имена mn.media
mn.variantPrefixedSynonyms({ group: '.group', peer: '.peer~' });  // метки: предок и сосед
```

| Класс | CSS |
|---|---|
| `hover:cF00` | `.hover\:cF00:hover{color:#f00}` |
| `md:cF00` | `@media (width >= 768px){.md\:cF00{…}}` |
| `group-hover:cF00` | `.group:hover .group-hover\:cF00{…}` — `{метка}-{синоним\|медиа}`: метка из `variantPrefixedSynonyms` |
| `group-hover/item:cF00` | `.group\/item:hover .group-hover\/item\:cF00{…}` — именованная метка (класс `group/item`) |
| `peer-invalid:cF00` | `.peer:invalid~.peer-invalid\:cF00{…}` — сосед через `variantPrefixedSynonyms` |
| `!p10` / `p10!` | `!important` — в начале (Tailwind v3) или в конце (v4) |
| `[mask-type:luminance]` | `{mask-type:luminance}` — произвольное свойство, сырая декларация без хендлера, только в этом режиме (D-055); `_` — пробел, `\_` — подчёркивание |
| `w-[37px]` | хендлер `w` получает суффикс `-[37px]` целиком — разбирать его дело пресета-клона |
| `[&>li]:cF00` / `[.dark_&]:cF00` | `…>li{…}` / `.dark .…{…}` — произвольный вариант: `&` — сам элемент |
| `data-[state=open]:` / `data-active:` | `[data-state=open]` / `[data-active]` |
| `aria-[sort=ascending]:` / `aria-checked:` | `[aria-sort=ascending]` / `[aria-checked="true"]` |
| `has-[img]:` / `not-[.x]:` / `nth-[3n+1]:` / `nth-last-[2]:` | `:has(img)` / `:not(.x)` / `:nth-child(3n+1)` / `:nth-last-child(2)` |
| `in-[.card]:` / `group-[.open]:` / `peer-[.open]:` | `:where(.card) …` / `.group.open …` / `.peer.open~…` |
| `min-[600px]:` / `max-[600px]:` | `@media (width >= 600px)` / `(width < 600px)` |
| `d:` / `d:max-d2:` | голая точка — «от точки», как в Tailwind (D-060): `(width >= 992px)` / `… and (width < 1200px)`; в записи minotation `@d` по-прежнему «до точки» |
| `min-d:` / `max-m4:` | сравнение с шириной точки медиа (`width`, D-054) |
| `*:` / `**:` | дети `>*` / потомки ` *` |
| `supports-[display:grid]:` | `@supports (display:grid){…}` |
| `[@media(any-hover:hover)]:` / `[@supports(…)]:` / `[@container_(…)]:` | соответствующее at-правило |
| `@min-[400px]:` / `@max-[400px]:` / `@d:` / `@d/sidebar:` | `@container (width >= 400px)` / `(width < 400px)` / `(width >= 992px)` / контейнер `sidebar` |
| `@md:` / `@min-md:` / `@max-md:` | размер — из шкалы контейнеров `mn.containers` (D-086; `presetTw4`: `@md` — 28rem, как у Tailwind), без записи — ширина точки медиа; `@max-` — `(width < …)` |

Другие at-правила (`[@layer …]:`, `[@starting-style]:`) — предупреждение (D-057).
Стили детей (`*:`, `**:`, `[&>li]:`, `[&_li]:`) проходят через `childSelectorMode`, как в других режимах.

`'breakpoint-prefixed'` — брейкпоинт перед классом, как в quantum-css: `SM_px15` →
`@media sm {.SM_px15{…}}`. Брейкпоинт — заглавными с `_`, ищется в `mn.media` как записан,
затем строчными; неизвестный — предупреждение.

`'property-value'` — запись Master CSS: `свойство:значение`, затем в любом порядке `!`,
состояния, селекторы и в конце медиа. Имя свойства — хендлер (ядро получает пару «имя,
значение», без разбора регуляркой); режим работает с любыми хендлерами — стандартными или
клона (D-051).

| Класс | CSS |
|---|---|
| `p:10` | `.p\:10{padding:10px}` |
| `c:F00:hover@md` | `@media (width >= 1024px){.c\:F00\:hover\@md:hover{color:#f00}}` |
| `p:10>li:hover` / `p:10_h1` | `…>li:hover{…}` / `… h1{…}` — ребёнок / потомок |
| `c:F00:checked+span` / `p:10~div` | соседи |
| `p:10[open]` / `c:F00.active` | атрибут / класс самого элемента |
| `c:F00:first` / `:nth(2)` / `:after` | `:first-child` / `:nth-child(2)` / `::after` |
| `p:10!` | `!important` |
| `{p:10;m:5}>li:hover@md` | группа объявлений с общим контекстом |
| `p:10@<md` / `@>=768` / `@768&<1024` | `(width < 1024px)` / `(width >= 768px)` / диапазон |
| `p:10@dark` / `@print` / `@landscape` / `@media(any-hover:hover)` | слова медиа и произвольный запрос |

Сравнение с именем (`@<md`) берёт ширину из запроса брейкпоинта (`(width >= 1024px)`).

В режимах, кроме `'context-qualified'`, действует только грамматика оригинала: конструкции
minotation (`<`, `>`, `@`, `:`, группы) не применяются (D-049).

Имя есть и среди синонимов, и среди медиа — берётся синоним. Метки — только
зарегистрированные, как в Tailwind (`group`, `peer`); `grop-hover:` или своё имя — неизвестная
приставка: предупреждение, CSS нет (своя метка пишется нотацией minotation: `cF00<.vasya:h`). Строки пресета (`assign`, `exts`) разбираются в режиме пресета
(`notationMode` пресет-объекта, по умолчанию `'context-qualified'`), классы разметки — в
режиме проекта.

### Пресет-объект и зависимости (D-045)

Пресет — функция `(mn) => {…}` или объект с метаданными. Зависимости можно перечислять в
`setPresets` в любом порядке: ядро подключит их раньше зависящего.

```ts
const presetApp = {
  name: 'presetApp',
  requires: ['presetStandard', 'presetMedias'],
  setup(mn) {
    mn.assign({ '.card': 'p16 bgF r8 sh2@md' });
  },
};

mn.setPresets([presetApp, presetMedias, presetStandard]);   // порядок — любой
mn.setPresets([presetApp]);
// Error: [minotation] presetApp requires "presetStandard", which is not connected. Connected presets: presetApp
```

Стандартные пресеты — объекты с именами; `presetMain` требует `presetStandard` и `presetMedias`,
пресеты normalize (D-108) не требуют ничего. `presetHints({ … })` возвращает объект
с именем `presetHints`.

### Как ядро находит хендлер: домены (D-063)

Имя записи (хендлера или статики) делится на **домен** — первые строчные буквы — и **префикс** —
остаток: `min-w` → домен `min`, префикс `-w`; `mA` → `m` + `A`; `p` → `p` + `''`. Записи домена
хранятся списком `[префикс, функция]`, самый длинный префикс первым; статика — тоже функция.

```ts
mn('min-w', minWHandler);                          // домен min: ['-w', minWHandler]
mn('min-w-full', { style: { minWidth: '100%' } }); // домен min: ['-w-full', статика]
```

| Класс | Что происходит |
|---|---|
| `min-w-full` | префикс `-w-full`, хвоста нет → статика |
| `min-w-4` | префикс `-w` → `minWHandler` с `-4` |
| `min-w-hm` | префикс `-w` → `minWHandler` с `-hm`; не разобрал — предупреждение «нужно значение» |
| `min-w-fullx` | у статики `-w-full` есть хвост → уступает более короткому префиксу `-w` |
| `min-wide` | префикс на букве не режет слово: `-w` не подходит, записи `''` нет — класс не токен, молча |
| `btn-primary` | домена `btn` нет — класс не токен, молча |

Префикс, кончающийся дефисом (`text-`), подходит и перед буквой: `text-muted` → остаток `muted`.

### Клон Tailwind 4 — `presetTw4` (D-043, D-068)

Подключается **вместо** `presetStandard`, разметка — в записи Tailwind (`notationMode: 'tw4-compatible'`).
Значения — как у Tailwind 4: через переменные темы, сама тема — блоком `:root`.

```ts
import { minotationProvider, presetMedias, presetTw4 } from 'minotation';

const mn = minotationProvider({ notationMode: 'tw4-compatible' });
mn.setPresets([presetMedias, presetTw4]);
// class="mt-4 md:flex hover:bg-blue-500/50 text-sm font-bold rounded-lg"
```

| Класс | CSS |
|---|---|
| `mt-4` / `-mt-4` / `mx-auto` | `margin-top:calc(var(--spacing) * 4)` / `* -4` / `margin-inline:auto` |
| `w-1/2` / `w-md` / `size-8` | `calc(1/2 * 100%)` / `var(--container-md)` / ширина и высота |
| `grid-cols-3` / `col-span-2` | `repeat(3, minmax(0, 1fr))` / `span 2 / span 2` |
| `text-sm` / `text-sm/6` | `font-size:var(--text-sm);line-height:var(--text-sm--line-height)` / `calc(var(--spacing) * 6)` |
| `bg-blue-500/50` | `color-mix(in oklab, var(--color-blue-500) 50%, transparent)` |
| `border-t-4` / `rounded-t-lg` | `border-style:solid;border-top-width:4px` / оба верхних угла `var(--radius-lg)` |
| `md:flex` / `max-md:hidden` | `@media (width >= 48rem)` / `(width < 48rem)` |
| `hover:` `first:` `odd:` `open:` `before:` `group-hover:` `peer-invalid:` | варианты |
| `@container` / `@md:flex` / `@max-md:flex` | `container-type:inline-size` / `@container (width >= 28rem)` / `(width < 28rem)` (D-086) |
| `shadow-lg/50` / `rotate-45` / `bg-linear-to-r from-red-500` / `blur-sm` / `animate-spin` | тени, трансформации, градиенты, фильтры, анимации (с `@keyframes` по требованию) |

**Все утилиты Tailwind 4.3.3**: сверка по всему списку классов Tailwind (23 286) — совпадают все, объявление
в объявление, вместе с `@supports` и `@media` (`node src/presets/tw4/scripts/tw4-conformance.mjs` после
`pnpm build`); произвольные значения, модификаторы и края — тест `src/presets/tw4/__tests__/golden.test.ts`
против настоящего Tailwind. Статические утилиты и тема — генерируются из `tailwindcss@4.3.3`.

**Совпадение с Tailwind 4** (D-069):
- в `:root` — только использованные переменные темы: хендлер вернул `var(--color-blue-500)` —
  переменная один раз уходит в `:root` через `mn.assign`; каждая — своим правилом `:root{…}`;
- брейкпоинты в rem — `(width >= 48rem)`, как у Tailwind;
- `hover:` — внутри `@media (hover: hover)`; с медиа-вариантом условия по умолчанию соединяются
  через `and` (`md:hover:` → `(width >= 48rem) and (hover: hover)`); с опцией `mediaNesting: true` —
  вложенными `@media`, как у Tailwind (D-070). Для браузера одно и то же;
- `space-x-4` — `:where(.space-x-4>:not(:last-child))`, нулевая специфичность, с
  `--tw-space-x-reverse` и `space-x-reverse`;
- `border` — `border-style: var(--tw-border-style)`, `border-dashed` ставит переменную, поэтому
  `border border-dashed` — пунктир при любом порядке правил. Начальные значения помощников
  `--tw-*` — правилом `*, ::before, ::after, ::backdrop`, как запасной вариант у Tailwind вместо
  `@property`.

Тема снята с `tailwindcss@4.3.3`: копия `theme.css` (MIT) лежит в `reference/tailwindcss-4.3.3/`,
модуль `src/presets/tw4/theme.ts` генерирует `node src/presets/tw4/scripts/tw4-theme.mjs`; тест сверяет SHA-256.

### Конфликты пресетов — `handlerConflictMode`, `presetConflictMode` (D-067)

**Одно имя от двух пресетов.** Если одну и ту же запись (домен и префикс) регистрируют два
пресета, побеждает последний, и при подключении выдаётся предупреждение `handler-conflict`:

```ts
mn.setPresets([presetHints, presetStandard, presetFlex]);
// "flex" is registered by presetHints and presetFlex — presetFlex wins.
//   To hide this warning: handlerConflictMode: 'silent'.
```

Имена из кода приложения (`mn(…)` вне пресета) не сравниваются. `'strict'` — ошибка `setPresets`.

**Экосистемы.** Пресет может указать, с какими экосистемами пресетов он совместим, — поле
`ecosystems`. Два подключённых пресета без общей экосистемы — предупреждение `preset-conflict`.
Пресет без поля нейтрален; поле не связано с `notationMode`.

```ts
const presetTw4 = { name: 'presetTw4', ecosystems: ['tw4'], setup(mn) { … } };

mn.setPresets([presetStandard, presetTw4]);
// presetStandard (minotation) and presetTw4 (tw4) belong to different preset ecosystems.
//   To hide this warning: presetConflictMode: 'silent'.

mn.setPresets([presetMedias, presetTw4]);   // presetMedias: ['minotation', 'tw4'] — без предупреждения
```

Маркеры стандартных пресетов: `presetStandard`, `presetSynonyms` — `minotation`; `presetMedias` —
`minotation`, `tw4`; остальные нейтральны.

### Классы других CSS-систем — `suspectClassMode` (D-065, D-066)

Хендлер вызывается всегда, когда для имени есть запись, и решает сам. Хендлеры `presetStandard`
распознают значение вида `-слово` — так пишут классы Bootstrap и Tailwind, в записи minotation
таких значений нет — и сообщают об этом отчётом `suspect-class`:

| Класс | Отчёт |
|---|---|
| `fw-bold` (Bootstrap) | `suspect-class`: `"-bold" is not a value of "fw" — this looks like a class of another CSS framework` |
| `sr-only`, `z-n1`, `mt-auto` | то же |
| `w10zz` | `parse-error`: настоящая ошибка в токене, как раньше |

`suspectClassMode: 'warn'` (по умолчанию) — предупреждение, CSS нет, `warningMode: 'error'` сборку
из-за таких классов не роняет; `'silent'` — молча; `'strict'` — брак сборки.

### Шкала для пресетов-клонов — `defineScale` (D-059)

Одним вызовом — хендлеры на все сочетания «свойство × сторона» и статики на слова. Для
клонов Tailwind, Bootstrap, Vuetify, Primer, Basscss: шкалу и имена задаёт пресет.

```ts
import { defineScale } from 'minotation';

const presetTailwindSpacing = (mn) => {
  defineScale(mn, {
    properties: { m: 'margin', 'min-w': 'min-width' },
    sides: { '': [''], t: ['top'], x: ['left', 'right'] /* … */ },
    scale: (step) => step * 0.25 + 'rem',  // или карта { 0: '0', 1: '.25rem', … }
    keywords: { auto: 'auto', px: '1px' },
    negative: true,                         // -mt-4 в записи Tailwind
    arbitrary: true,                        // mt-[37px]
  });
  defineScale(mn, { properties: { p: 'padding' }, /* … без negative */ });
};
```

| Класс | CSS |
|---|---|
| `mt-4` / `mx-2.5` | `margin-top:1rem` / `margin-left:0.625rem;margin-right:0.625rem` |
| `mx-auto` / `mt-px` | слова — статикой |
| `-mt-4` / `-mt-px` / `-mt-[var(--g)]` | `margin-top:-1rem` / `-1px` / `calc(var(--g) * -1)` — в режиме `'tw4-compatible'` при `negative: true` |
| `-p-4` без `negative` | CSS нет, молча — как в Tailwind |
| `mt-[37px]` | `margin-top:37px` — в режиме `'tw4-compatible'` (в записи minotation `[…]` — атрибут) |
| `pt-7` при карте `0…5` | предупреждение: `step "7" is not in the scale (0, 1, 2, 3, 4, 5)` |

Имена с дефисом (`'min-w'`, `'gap-x'`, `'translate-x'`) ядро находит само — это домен и префикс.
`separator: ''` — запись без дефиса (`p2`, Basscss). Шаги карты регистрируются статикой, как и
слова. Опции проверяются: неизвестный ключ — ошибка с подсказкой.

### Отрицательные значения в записи Tailwind (D-064)

В режиме `'tw4-compatible'` ведущий `-` (`-mt-4`) разборщик снимает, а хендлер получает
`p.sign = '-'` и решает сам: принял — отрицательный CSS, ничего не вернул — CSS нет, молча.
Флагов у хендлера нет. В записи minotation `-mt-4` — не токен (минус там пишется в значении:
`mt-10` → `margin-top:-10px`).

### Разбор остатка в записи Tailwind — `tw()` (D-061)

Обёртка без флагов: собирает остаток класса после имени и отдаёт хендлеру готовую структуру.

```ts
import { tw } from 'minotation';

mn('gap', tw(({ parts, arbitrary, negative }) => {
  const property = parts[0] === 'x' ? 'columnGap' : parts[0] === 'y' ? 'rowGap' : 'gap';
  const step = property === 'gap' ? parts[0] : parts[1];
  const value = arbitrary || (step && step * 0.25 + 'rem');
  return value && !negative ? { style: { [property]: value } } : undefined;
}), '', 1);
```

| Остаток класса | Что получает хендлер |
|---|---|
| `gap-x-2` | `{ parts: ['x', '2'] }` |
| `bg-blue-500/50` | `{ parts: ['blue', '500'], modifier: '50' }` |
| `w-1/2` | `{ parts: ['1'], modifier: '2' }` — дробь или прозрачность, решает хендлер |
| `w-[37px]` / `m-[1px_2px]` | `{ arbitrary: '37px' }` / `'1px 2px'` |
| `text-[length:1rem]` | `{ type: 'length', arbitrary: '1rem' }` |
| `fill-(--brand)` | `{ arbitrary: 'var(--brand)' }` |
| `-translate-x-2` | `{ parts: ['x', '2'], negative: true }` |

## API

### `minotationProvider(options?)`

Создаёт экземпляр MN.

```ts
const mn = minotationProvider({
  presets: [presetStandard, presetSynonyms, presetMedias],
  isolateMode: 'none',             // 'none' | 'class' | 'where' — правила привязаны к классу области (D-075)
  isolateClass: '_l',              // класс области: .p10._l{…} или .p10:where(._l){…}
  media: { m: { query: '(width <= 767px)' } }, // p10@m; ещё width/height, supports, container
  altColor: false,                 // запасное непрозрачное объявление рядом с rgba
  warningMode: 'log',              // 'log' | 'silent' | 'error' — что делать с предупреждением
  onWarning: (warning) => {},      // колбэк на каждое предупреждение, дополнительно к режиму
  onError: (error) => {},          // ошибки ядра
  maxDepth: 10,                    // предел глубины контекстных селекторов (<N, >N)
  maxDepthMode: 'warn',            // 'warn' | 'silent' | 'strict' — что делать при превышении
  maxSpecificity: 16,              // предел *N: 1…16, выше 16 задать нельзя (D-089)
  maxSpecificityMode: 'warn',      // 'warn' — сообщение, CSS до *16; 'strict' — без CSS, ошибка
  mediaSyntax: 'range',            // (width >= 48rem); 'classic' — (min-width: 48rem) для старых браузеров (D-087)
  axisMode: 'logical',             // px16 → padding-inline:16px; 'physical' — padding-left + padding-right (D-101)
  overflowWrapMode: 'standard',    // owrBW → overflow-wrap; 'legacy' — word-wrap, 'both' — оба (старые браузеры, D-106)
  mediaConflictMode: 'warn',       // имя из media совпало с медиа пресета: остаётся своё, 'warn' | 'silent' | 'strict' (D-092)
  specificityMode: 'warn',         // 'warn' | 'silent' | 'strict' — токены f10*2 (накрутка специфичности)
  importantMode: 'warn',           // 'warn' | 'silent' | 'strict' — токены f10-i (!important)
  childSelectorMode: 'warn',       // 'warn' | 'silent' | 'strict' — токены cF00>1 (дочерний селектор)
  unknownMediaMode: 'warn',        // 'warn' | 'silent' | 'strict' — неизвестное имя медиа p10@zz
  suspectClassMode: 'warn',        // 'warn' | 'silent' | 'strict' — класс другой системы fw-bold
  groupSuspectMode: 'warn',        // 'warn' | 'silent' | 'strict' — группа даёт битый CSS: cF:is(.a|.b), cF:h(2n)
  groupMode: 'groups',             // 'groups' | 'css' — 'css': скобки это CSS, групп (a|b) нет (D-077)
  handlerConflictMode: 'warn',     // 'warn' | 'silent' | 'strict' — одно имя от двух пресетов
  presetConflictMode: 'warn',      // 'warn' | 'silent' | 'strict' — пресеты несовместимых экосистем
  mediaNesting: false,             // true — вложенные @media вместо and (как у Tailwind 4)
  notationMode: 'context-qualified', // или 'tw4-compatible' — запись как в Tailwind: md:hover:p10
  contextWhere: false,             // true — контекст в :where(): .p10…:is(:where(.card:hover) *)
});
```

Вендорные префиксы подключаются пресетом `presetPrefixes`.

Опции проверяются при создании и в `mn.setOptions` (D-038): неизвестный ключ и
значение не того типа — ошибка с подсказкой.

```ts
minotationProvider({ altColor: 'off' });
// Error: [minotation] minotationProvider: option "altColor" expects a boolean, got string "off"

minotationProvider({ isolateMod: 'class' });
// Error: [minotation] minotationProvider: unknown option "isolateMod". Did you mean "isolateMode"?
```

Тот же проверяльщик экспортируется для своих точек входа: `checkOptions(options,
schema, 'myPlugin')` и проверки `isBoolean`, `isString`, `isStringArray`,
`oneOf(...)`, `optionsOf(schema)` и др.

### `mn.setPresets(presets)`

Загружает пресеты (наборы обработчиков).

```ts
mn.setPresets([presetStandard, presetSynonyms]);
```

### `mn.getCompiler(attr)(tokens)`

Возвращает компилятор для атрибута (`'class'`, `'className'`) и принимает строку токенов.

```ts
const compile = mn.getCompiler('class');
compile('p10 cF00 fx:h');
```

### `mn.compile()`

Компилирует все накопленные токены в CSS.

### `mn.styles$.getValue()`

Возвращает массив `StyleBlock[]` — скомпилированные CSS-блоки.

### `mn(tag, handler)`

Регистрирует обработчик стиля. Экземпляр вызывается как функция; аргумент хендлера —
объект разбора токена, имя которого лежит в **`suffix`** (не `arg`).

```ts
mn('cool', (p) => ({
  style: { color: '#' + p.suffix },
}));
// coolF00 → color:#F00
```

### `mn.assign(selectors)`

Назначает MN-токены на CSS-селекторы.

```ts
mn.assign({
  '*, *:before, *:after': 'bxzBorderBox',
  'body': 'm',
  '.menu(:h|.active)@d': 'cF00',   // селектор — в записи классов (D-071)
});
```

Селектор — обычный CSS-селектор, а в каждом его составном — запись классов: состояния и
синонимы, группы, предки `<`. Комбинаторы CSS (пробел, `>`, `+`, `~`) остаются CSS: **`>` в
селекторе — ребёнок**, как в CSS (в записи классов `>` — потомок). Медиа и приоритет `^N` можно
писать где угодно — они относятся ко всему селектору; медиа селектора и медиа токена
соединяются через `and`:

| Селектор + токен | CSS |
|---|---|
| `'.x:h@d'` + `cF00` | `@media (width < 992px) and (hover: hover){.x:hover{color:#f00}}` |
| `'.btn@dark'` + `cF00@m4` | `@media (width < 480px) and (prefers-color-scheme: dark){.btn{…}}` |
| `'html:has[dialog[open]]'` | `html:has(dialog[open])` — скобки псевдокласса пишутся `[ ]`, как в классах |
| `'[type=(button\|reset)]'` | `[type=button],[type=reset]` |
| `'h1, h2@d'` | запятая — независимые селекторы: `@d` только у `h2`; общий контекст — группой `'(h1\|h2)@d'` |
| `'.a(:h\|.active)@m .child'` | `@media … and (hover: hover){.a:hover .child{…}}` и `@media …{.a.active .child{…}}` |
| `'.a@m^3>.b'` | `@media (width < 992px){.a>.b{…}}` с приоритетом 3 |

Предупреждений, которые нужны только классам (полное имя псевдокласса, дочерний селектор),
в селекторе нет: это обычный CSS.

### `mn.css(selector, declarations)` — только то, что классом не выразить (D-071)

Правило CSS для любого селектора. **Не замена нотации:** всё, что можно написать классами,
пишется классами — так стили видны в разметке и схлопываются по одинаковым объявлениям. `mn.css` —
для двух случаев:

- **глобальные переменные** — тема в `:root`, переменные по требованию из хендлеров пресета;
- **элементы, до которых класс не дотянуться** — `html`, `::selection`, чужая разметка.

```ts
mn.css(':root@^-3000', { '--brand': '#f00', '--radius': '4px' });   // тема — блоком раньше утилит
mn.css(':root@dark^-3000', { '--brand': '#f66' });
mn.css('html', { scrollbarGutter: 'stable' });
mn.css({ '::selection': { background: 'yellow' } });
```

- селектор — та же запись, что у `mn.assign` (элемент и контекст);
- значения — как есть, без записи нотации (`'oklch(62.3% 0.214 259.815)'`);
- объявления одного селектора копятся в **одно** правило, в том числе при вызове из хендлера во
  время компиляции;
- значение-массив — то же свойство несколько раз подряд, в его порядке (D-108 F1):
  `mn.css('button', { cursor: ['pointer', 'hand'] })` → `button{cursor:pointer;cursor:hand}`;
- список `mn.css([[селектор, объявления], …])` — каждая запись своим правилом, без слияния с правилами
  того же селектора (D-108 F3): так пресет повторяет таблицу стилей, где один селектор встречается дважды;
- приоритет и блок — `^N`: правила одного медиа и приоритета — один блок (`:root@^-3000` — раньше
  утилит с их −2000).

Не годится: `mn.css('.card', { padding: '16px' })` вместо класса `p16` у карточки — пишите класс.

### `mn.setSynonyms(map)`

Синонимы состояний.

```ts
mn.setSynonyms({ h: ':hover', f: ':focus' });
```

### `mn.setKeyframes(name, body)`

Регистрирует @keyframes.

```ts
mn.setKeyframes('fadeIn', {
  '0%': { opacity: '0' },
  '100%': { opacity: '1' },
});
```

## Сканер: текстовый и синтаксический

Токены из исходников собирает `createScanner(options)` — её зовут все плагины
сборщиков и CLI. Способ разбора выбирается **по расширению файла**, отдельно
включать ничего не нужно:

```js
import { createScanner } from 'minotation';

const scan = createScanner({ attr: 'class' });
scan(source, '/src/App.tsx');    // парсером
scan(source, '/src/App.vue');    // скрипт парсером, шаблон текстом
scan(source, '/index.html');     // текстом
```

| Что за файл | Как разбирается |
|---|---|
| `.js .jsx .mjs .cjs .ts .tsx .mts .cts` | целиком парсером |
| `.vue .svelte .astro` | `<script>` и фронтматтер `---` парсером, разметка текстом |
| всё остальное | текстом |

Парсер — TypeScript compiler API. `typescript` объявлен **необязательной**
peer-зависимостью и загружается лениво, при первом подходящем файле; сам
`import 'minotation'` его не тянет. Если парсера в проекте нет — работает
текстовый разбор, молча: точность это приятный бонус, а не условие работы.

**Зачем это нужно.** Текстовый сканер не отличает код от того, что на код
похоже. Комментарии он вырезает, но текстом, и на таком файле ошибается:

```tsx
const re = /"/;
/** Пример: <div class="p99 w999">…</div> */
export const App = () => <div class="p10 m20" />;
```

Кавычка внутри регулярного литерала открывает для него строку, JSDoc перестаёт
считаться комментарием — и `p99 w999` уезжают в CSS правилами, которые не к
чему применить. Парсеру это безразлично.

**Цена** — замерено на одном образце, 300 файлов × 20 прогонов
(`src/__benchmarks__/syntaxScan.bench.ts`):

| | текстовый | с разбором |
|---|---|---|
| JS/TS-файл | 13,3 мкс | 82,0 мкс (6,2×) |
| однофайловый компонент | 8,0 мкс | 45,5 мкс (5,7×) |

На тысячу файлов это меньше десятой доли секунды на полную пересборку.

Управлять этим всё же можно: `syntax: false` — всегда текстом, `syntax: true` —
как обычно, но отсутствие парсера становится предупреждением, а не тишиной.

Оба сканера на корректном файле дают один и тот же набор токенов — это
проверяется тестом-сторожем, а не подразумевается. Файл с синтаксической
ошибкой откатывается к текстовому разбору: недописанная скобка не повод
срывать сборку.

## Форматы сборки

Пакет публикуется в трёх сборках, выбор — по полю `exports`:

| Подключение | Файлы |
|---|---|
| `browser` (Vite в браузере, webpack `target: 'web'`, esbuild `--platform=browser`, Rollup с `browser: true`) | `dist/browser/*.mjs`; через `require` (jest с jsdom) — `dist/*.js` |
| `import` (Node ESM, Vite SSR, прочие бандлеры) | `dist/esm/*.mjs` |
| `require` | `dist/*.js` (CommonJS) |

Точки входа одинаковые: `minotation`, `minotation/mne`, `minotation/syntax` (последней в браузерной
сборке нет — это и есть парсер).

Браузерная сборка — тот же код, кроме одного: синтаксический сканер в ней не грузится, и `typescript` в
бандл не попадает. Бандл `minotationProvider` + `presetStandard` — около 45 КБ gzip (с `typescript` было
1 081 КБ; проверяет `pnpm test:dist`). `createScanner` там разбирает файлы текстом, а с `syntax: true`
предупреждает: «the syntax scanner runs in Node only».

ESM грузится и Node напрямую, и Vite как исходник workspace-пакета — обходы
вроде `ssr.external: ['minotation']` не нужны. Если в процессе оказались обе
копии (например, ESM-плагин и CJS-накопитель), они совместимы: ошибка разбора
из пресета одной копии распознаётся другой.

## Интеграции

Разбор работает во всех интеграциях одинаково, опция `syntax` — тоже.

| Пакет | Статус |
|-------|--------|
| `minotation-cli` | Команда `mn` для сборки без сборщика |
| `minotation-vite` | Vite-плагин (прототип) |
| `minotation-webpack` | Webpack loader + plugin (прототип) |
| `minotation-next` | Next.js `withMn()` (прототип, webpack-only) |
| `minotation-rollup` | Rollup-плагин (прототип) |
| `minotation-astro` | Astro-интеграция (прототип, обёртка над `minotation-vite`) |
| `minotation-esbuild` | esbuild-плагин (прототип) |

## Миграция с 1.x

| 1.x (`minimalist-notation`) | v2 (`minotation`) |
|---|---|
| `mnProvider()` | `minotationProvider()` |
| `mn('tag', handler, ...)` | `mn('tag', handler)` (без изменений) |
| `mn.presets([...])` | `mn.setPresets([...])` |
| `mn.getCompiler('class')(tokens)` | `mn.getCompiler('class')(tokens)` (без изменений) |
| `mn.styles$.getValue()` | `mn.styles$.getValue()` ✅ |
| `require('.../presets/styles')` | `import { presetStandard }` |
| `require('.../presets/main')` | `import { presetMain }` |
