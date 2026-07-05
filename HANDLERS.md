# Minotation — справочник хендлеров

Примеры проверены тестами (`presets.test.ts`) и верифицированы пользователем.

---

## Формат токена

```
{tag}{arg}           → base
{tag}{arg}:h         → hover
{tag}{arg}.cls       → when element has class .cls
{tag}{arg}@m         → media query
{tag}{arg}<.parent   → inside .parent
```

- **tag** — начальная последовательность строчных латинских букв (`splitStem` останавливается на первом не-строчном символе)
- **arg** — всё остальное (цифры, `-`, `_`, `.`, заглавные буквы, `%`, …)
- `-i` в конце аргумента → `!important`

---

## Цвет (`color()`)

Формат: `{hex}` или `{hex}.{alpha}`

| Токен | CSS |
|-------|-----|
| `cF` | `color: #FFF` |
| `cF.38` | `color: rgba(255,255,255,0.38)` |
| `cF.75` | `color: rgba(255,255,255,0.75)` |
| `c0` | `color: #000` |
| `c0.5` | `color: rgba(0,0,0,0.5)` |
| `cF00` | `color: #F00` |
| `c0A0A12` | `color: #0A0A12` |

Синонимы: `F` = `#FFF`, `D` = `#DDD`, `L` = `#EEE`, `T` = `transparent`, `CT` = `currentColor`.

`color()` ищет последнюю точку → всё после неё = alpha (0–1):
```
F.38      → hex=F → #FFF → rgba(255,255,255,0.38)
0A0A12.75 → hex=0A0A12 → rgb(10,10,18) → rgba(10,10,18,0.75)
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

---

## Отступы

Именование: **x** = горизонталь (left/right), **y** = вертикаль (top/bottom).

| Токен | CSS |
|-------|-----|
| `p10` | `padding: 10px` |
| `px8` | `padding-left: 8px; padding-right: 8px` |
| `py4` | `padding-top: 4px; padding-bottom: 4px` |
| `px1.5` | `padding-left: 1.5px; padding-right: 1.5px` |
| `pt4` | `padding-top: 4px` |
| `pb4` | `padding-bottom: 4px` |
| `pl4` | `padding-left: 4px` |
| `pr4` | `padding-right: 4px` |
| `m0` | `margin: 0` |
| `mx4` | `margin-left: 4px; margin-right: 4px` |
| `my12` | `margin-top: 12px; margin-bottom: 12px` |
| `mxA` | `margin-left: auto; margin-right: auto` |
| `mb8` | `margin-bottom: 8px` |
| `mt8` | `margin-top: 8px` |
| `mx0` | `margin-left: 0; margin-right: 0` |

---

## Размеры

| Токен | CSS |
|-------|-----|
| `w` | `width: 100%` |
| `w320` | `width: 320px` |
| `w50p` | `width: 50%` |
| `h75` | `height: 75px` |
| `sq32` | `width: 32px; height: 32px` |
| `sq44` | `width: 44px; height: 44px` |
| `wmin60` | `min-width: 60px` |

---

## Позиционирование

| Токен | CSS |
|-------|-----|
| `fixed` | `position: fixed` |
| `abs` | `position: absolute` |
| `rlv` | `position: relative` |
| `sticky` | `position: sticky` |
| `st16` | `top: 16px` |
| `sr16` | `right: 16px` |
| `sb24` | `bottom: 24px` |
| `sl50p` | `left: 50%` |
| `s0` | `top/right/bottom/left: 0` |
| `z1200` | `z-index: 1200` |

---

## Flex

| Токен | CSS |
|-------|-----|
| `fx` | `display: flex` |
| `fxdC` | `flex-direction: column` |
| `aiC` | `align-items: center` |
| `aiS` | `align-items: start` |
| `jcC` | `justify-content: center` |
| `jcB` | `justify-content: space-between` |
| `fxg1` | `flex-grow: 1` |
| `fxs0` | `flex-shrink: 0` |
| `asT` | `align-self: stretch` |
| `gap2` | `gap: 2px` |
| `fxwWrap` | `flex-wrap: wrap` |

Значения `alignVal`: `C`=center, `S`=start, `E`=end, `F`=flex-start, `L`=flex-end,
`B`=space-between, `A`=space-around, `V`=space-evenly, `T`=stretch.

---

## Типографика

| Токен | CSS |
|-------|-----|
| `f12` | `font-size: 12px` |
| `f14` | `font-size: 14px` |
| `f22` | `font-size: 22px` |
| `fw5` | `font-weight: 500` |
| `fwBold` | `font-weight: bold` |
| `lh1` | `line-height: 1` (без единиц) |
| `lh1.4` | `line-height: 1.4` |
| `lh20px` | `line-height: 20px` |
| `lts1.5` | `letter-spacing: 1.5px` |
| `ttU` | `text-transform: uppercase` |
| `tc` | `text-align: center` |
| `tr` | `text-align: right` |
| `tl` | `text-align: left` |
| `dB` | `display: block` |
| `dN` | `display: none` |
| `crP` | `cursor: pointer` |
| `usN` | `user-select: none` |

---

## Цвет фона / фон

| Токен | CSS |
|-------|-----|
| `bg0` | `background: #000` |
| `bgF` | `background: #FFF` |
| `bgF.1` | `background: rgba(255,255,255,0.1)` |
| `bg0A0A12.75` | `background: rgba(10,10,18,0.75)` |
| `bg0A0A12.88` | `background: rgba(10,10,18,0.88)` |
| `bgcF.12` | `background-color: rgba(255,255,255,0.12)` |
| `bgcF.15` | `background-color: rgba(255,255,255,0.15)` |
| `bgcF.28` | `background-color: rgba(255,255,255,0.28)` |

---

## Граница

Граница задаётся **тремя отдельными токенами**, не одним compound:

```
border: '1px solid rgba(255,255,255,0.1)'
→  b1  bsS  bcF.1
```

| Токен | CSS |
|-------|-----|
| `b1` | `border-width: 1px` |
| `bsS` | `border-style: solid` |
| `bcF.1` | `border-color: rgba(255,255,255,0.1)` |

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
| `r` | `border-radius: 9999px` (полный круг) |
| `r1` | `border-radius: 1px` |
| `r4` | `border-radius: 4px` |
| `r8` | `border-radius: 8px` |

---

## Box-sizing

| Токен | CSS |
|-------|-----|
| `bxzBB` | `box-sizing: border-box` |
| `bxzCB` | `box-sizing: content-box` |

(`BB` и `CB` — двухбуквенные сокращения `kwVal`)

---

## Box-shadow

Мини-DSL: `bxsh{offset}[r{blur}][x{x}][y{y}][c{color}][in]`

| Часть | Значение |
|-------|---------|
| `{число}` | базовый offset (x и y, если нет явных x/y) |
| `r{число}` | blur-radius в px |
| `x{число}` | x-offset в px |
| `y{число}` | y-offset в px |
| `c{hex[.alpha]}` | цвет в MN-нотации |
| `in` | `inset` |

| Токен | CSS |
|-------|-----|
| `bxsh0r18cF.25` | `box-shadow: 0 0 18px rgba(255,255,255,0.25)` |
| `bxsh5r7` | `box-shadow: 5px 5px 7px #000` |
| `bxsh5in` | `box-shadow: inset 5px 5px 0 #000` |
| `bxsh0r18cF.25:h` | то же, только on `:hover` |

Аналогично `tsh` для `text-shadow`.

---

## Переходы / анимация

| Токен | CSS |
|-------|-----|
| `dn` | `transition-duration: 250ms` |
| `dn150` | `transition-duration: 150ms` |
| `dn200` | `transition-duration: 200ms` |
| `dn300` | `transition-duration: 300ms` |

`transition-property` по умолчанию — `all` (CSS-умолчание). Для большинства кейсов достаточно просто `dn200` без уточнения отдельных свойств.

---

## Фильтры

Формат аргумента: `{CamelCase имя функции}{число}[единица]`

| Токен | CSS |
|-------|-----|
| `ftBlur10` | `filter: blur(10px)` |
| `ftBlur4` | `filter: blur(4px)` |
| `ftGrayscale100` | `filter: grayscale(100%)` |
| `ftBrightness150` | `filter: brightness(150%)` |

Тег `ftb` = `backdrop-filter`:

| Токен | CSS |
|-------|-----|
| `ftbBlur8` | `backdrop-filter: blur(8px)` |
| `ftbBlur10` | `backdrop-filter: blur(10px)` |
| `ftbBlur12` | `backdrop-filter: blur(12px)` |

Единицы по умолчанию: `blur` → `px`, `hue-rotate` → `deg`, остальное → `%`.
Несколько функций через `_`: `ftBlur3_Invert20` → `filter: blur(3px) invert(20%)`.

---

## Transform

Весь transform — через один хендлер `x` с мини-DSL в аргументе:

| Префикс аргумента | CSS | Пример |
|-------------------|-----|--------|
| `-?{число}[единица]` | `translateX(…)` | `x-50%` → `translateX(-50%)` |
| `Y-?{число}[единица]` | `translateY(…)` | `xY-50%` → `translateY(-50%)` |
| `S{десятичное}` | `scale(…)` | `xS1.5` → `scale(1.5)` |
| `Rz{число}` | `rotateZ(…deg)` | `xRz70` → `rotateZ(70deg)` |
| `Rx{число}` | `rotateX(…deg)` | `xRx-60` → `rotateX(-60deg)` |

Все трансформации — только через `x`-DSL. Отдельных хендлеров `rx/ry/rz/scale` нет.

---

## Misc

| Токен | CSS |
|-------|-----|
| `ov` | `overflow: hidden` |
| `ovyAuto` | `overflow-y: auto` |
| `contrast` | `image-rendering: pixelated` |
| `ratio3x2` | `position: relative; padding-top: 66.67%` |

---

## Состояния и контекст

```
bgF.1:h              → background on :hover
cF.38.paused         → color when element has class "paused"
bgcF.12.active       → background-color when element has class "active"
```

**Паттерн модификатора:** токен с `.cls` всегда статически присутствует в className,
а сам класс `cls` добавляется условно.

```tsx
// правильно: оба токена статически видны парсеру
className={`cF cF.38.paused ${musicPaused ? 'paused' : ''}`}

// неправильно: cF.38 может не попасть в сканирование
className={`${musicPaused ? 'cF.38' : 'cF'}`}
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
import type { MnFn } from 'minotation';

export function presetApp(mn: MnFn): void {
  mn.register('card', () => ({ style: { borderRadius: '8px' } }));
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

### Как `splitStem` разбивает токен

Тег — начальная последовательность строчных `a-z`. Останавливается на первом символе вне `a-z`.

```
ftBlur10    →  tag="ft",  arg="Blur10"
ftbBlur8    →  tag="ftb", arg="Blur8"
b1          →  tag="b",   arg="1"
x-50%       →  tag="x",   arg="-50%"
cF.38       →  tag="c",   arg="F.38"
```

### Контекстные маркеры `parseLexeme`

Только `< > : @`. Точка, запятая, скобки, цифры — НЕ маркеры.
Поэтому `cF.38.paused` — один стем, `cF00:h` разбивается на стем + `:h`.

### Ограничение mnVite-сканера

Сканер токенов работает только со статическими `className="..."` строками.
Template literals (`className={...}`) **не сканируются** — токены из них не попадут в CSS.

Правило: токены, нужные в нескольких состояниях, обязательно должны присутствовать
как статические строки хотя бы в одном месте.

---

*Примеры верифицированы в `presets.test.ts`.*
