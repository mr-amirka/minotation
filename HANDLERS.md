# Minotation — справочник хендлеров

Примеры проверены прямыми вызовами `minotationProvider` + `presetStandard` (и где
нужно — `presetSynonyms`/`presetMedias`) против собранного `dist/`, не по тестам —
`presets.test.ts`, на который ссылался этот файл раньше, удалён (заменён на
`css-validation.test.ts` + `preset-standard.test.ts`).

---

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

`fx` — только `flex`-shorthand (`fx1` → `flex:1`), **не** `display:flex` (для этого — `dF`,
см. Типографику/Display ниже). Без аргумента (`fx` без числа) хендлер не срабатывает —
**всегда указывайте значение** (`fx1`, `fx0_1_Auto`, …).

| Токен | CSS |
|-------|-----|
| `fx1` | `flex:1` |
| `fxdC` | `flex-direction:column` |
| `aiC` | `align-items:center` |
| `aiS` | `align-items:stretch` |
| `jcC` | `justify-content:center` |
| `jcSB` | `justify-content:space-between` |
| `fxg1` | `flex-grow:1` |
| `fxs0` | `flex-shrink:0` |
| `asST` | `align-self:stretch` |
| `acC` | `align-content:center` |
| `gap2` | `gap:2px` |
| `fxwWrap` | `flex-wrap:wrap` |

**У `jc`/`ai`/`as` — РАЗНЫЕ карты синонимов** (общей таблицы `alignVal` не существует):

| Токен | `jc` (justify-content) | `ai` (align-items) | `as` (align-self) |
|-------|------------------------|---------------------|---------------------|
| `C` | Center | Center | Center |
| `FE` | FlexEnd | FlexEnd | FlexEnd |
| `FS` | FlexStart | FlexStart | FlexStart |
| `SA` | SpaceAround | — | — |
| `SB` | SpaceBetween | — | — |
| `B` | — | Baseline | Baseline |
| `S` | — | Stretch | Start |
| `ST` | — | — | Stretch |
| `E` | — | — | End |
| `SS`/`SE` | — | — | SelfStart/SelfEnd |
| `A`/`N` | — | — | Auto/Normal |

Незнакомая буква не даёт ошибку — падает в буквальный `toKebabCase` (например `jcB` даёт
`justify-content:b`, а не `space-between`; нужно `jcSB`).

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
| `fwBold` | `font-weight:bold` |
| `lh1` | `line-height:1px` |
| `lh1.4` | `line-height:1.4px` |
| `lh20px` | `line-height:20px` |
| `lts1.5` | `letter-spacing:1.5` (без единицы!) |
| `ttU` | `text-transform:uppercase` |
| `taC` | `text-align:center` |
| `taR` | `text-align:right` |
| `taL` | `text-align:left` |
| `dB` | `display:block` |
| `dN` | `display:none` |
| `dF` | `display:flex` |
| `crP` | `cursor:pointer` |
| `usN` | `user-select:none` |

`line-height` **всегда получает `px`**, даже без явной единицы (`lh1` → `1px`, не
безразмерное `1`) — если нужен множитель без единиц, указывайте явно через CSS-переменную
или проверяйте фактический вывод. `letter-spacing`, наоборот, **не получает** `px`
автоматически.

Text-align — тег `ta` + буква (`taC`/`taR`/`taL`/`taJ`/`taE`/`taS`), а **не** отдельные
теги `tc`/`tr`/`tl` — их не существует, токен просто не даёт CSS без ошибки.

---

## Цвет фона / фон

По умолчанию `altColor` включён — background/color-хендлеры выводят **и** hex, **и**
`rgba(...)` (браузерный fallback), даже если запрошена только rgba-форма. Чтобы получить
только `rgba(...)`, нужно явно передать `altColor: 'off'` в опции `minotationProvider`.

| Токен | CSS (default, `altColor` не задан) |
|-------|-----|
| `bg0` | `background:#000` |
| `bgF` | `background:#fff` |
| `bgF.1` | `background:#fff;background:rgba(255,255,255,.1)` |
| `bg0A0A12.75` | `background:#0a0a12;background:rgba(10,10,18,.75)` |
| `bg0A0A12.88` | `background:#0a0a12;background:rgba(10,10,18,.88)` |
| `bgcF.12` | `background-color:#fff;background-color:rgba(255,255,255,.12)` |
| `bgcF.15` | `background-color:#fff;background-color:rgba(255,255,255,.15)` |
| `bgcF.28` | `background-color:#fff;background-color:rgba(255,255,255,.28)` |

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
| `bcF.1` | `border-color:#fff;border-color:rgba(255,255,255,.1)` (см. `altColor` выше) |

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

**Не поддерживается**: `In` (inset) не применяется ни в каком сочетании — этот модификатор
задокументирован в `SHADOW_PATTERNS`, но нигде не используется в сборке итоговой строки.
Изолированный `r`/`R`-модификатор БЕЗ ведущего числа (`bxshR3` — суффикс состоит только из
spread, без blur) даёт мусор в позиции blur (`box-shadow:0px 0px Rpx 3px #000`, где `Rpx`
— буквальная строка) — то же поведение унаследовано из оригинала (v1), не регрессия этого
порта. Всегда указывайте blur первым числом.

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
| `ovyAuto` | `-webkit-overflow-scrolling:touch;overflow-y:auto` |
| `contrast` | `image-rendering:optimize-contrast;image-rendering:-webkit-optimize-contrast` |
| `ratio3x2` | `padding-top:66.66%` + `>*{position:absolute;top:0;right:0;bottom:0;left:0}` |

---

## Состояния и контекст

```
bgF.1:h              → background on :hover
cF.38.paused         → color when element has class "paused"
bgcF.12.active       → background-color when element has class "active"
```

| Токен | CSS |
|-------|-----|
| `bgF.1:h` | `.bgF\.1\:h:hover{background:#fff;background:rgba(255,255,255,.1)}` |
| `cF.38.paused` | `.cF\.38\.paused.paused{color:#fff;color:rgba(255,255,255,.38)}` |
| `bgcF.12.active` | `.bgcF\.12\.active.active{background-color:#fff;background-color:rgba(255,255,255,.12)}` |

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
