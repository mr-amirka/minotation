# Minotation Default Presets


**The MN library includes this default presets if other is not seated.**


* [Auto prefixes](#auto-prefixes)   
* [Media queries](#media-queries)   
* [Other default settings](#other-default-settings)  
* [States](#states)  
* [Side names](#side-names)  
* [Essences of styles](#essences-of-styles)  
* [Normalize](#normalize)  




#### Auto prefixes

See source:  
[minimalist-notation/presets/prefixes.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/prefixes.js)  
[minimalist-notation/presets/runtime-prefixes.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/runtime-prefixes.js)  



#### Media queries

See source:  
[minimalist-notation/presets/medias.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/medias.js)


Точки по ширине (D-054) — запрос строится по записи в токене: `@имя` — до точки,
`@имя-` — от точки, `@a-b` — между точками.

```ts
// src/presets/medias.ts (сокращённо)
forIn({
  m: 992, m2: 768, m3: 640, m4: 480, m5: 360, m6: 320, m7: 312, m8: 272,
  d: 992, d2: 1200, d3: 1600, d4: 1920, d5: 2300, d6: 2560,
}, (width, name) => {
  media[name] = { width };
});
media.mouse = { query: '(pointer: fine) and (hover: hover)' };
media.dark = { query: '(prefers-color-scheme: dark)' };
// user agents — media[name] = { selector: '.' + name }
```

**Examples:**

```html
<div class="ph15 ph10@m w1100@d2- w900@m4-d">...</div>
```
```css
.ph15 { padding-left: 15px; padding-right: 15px; }
@media (max-width: 991.98px) { .ph10\@m { padding-left: 10px; padding-right: 10px; } }
@media (min-width: 1200px) { .w1100\@d2- { width: 1100px; } }
@media (min-width: 480px) and (max-width: 991.98px) { .w900\@m4-d { width: 900px; } }
```

-------------------------
```html
<div class="bgE bgF@safari dB@ie">...</div>
```
```css
.bgE {
  background: #eee;
}
.safari .bgF\@safari {
  background: #fff;
}
.ie .dB\@ie {
  display: block;
}
```


#### States

See source:  
[minimalist-notation/presets/states.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/states.js)


| State name | Selectors                                        |
| ---------- | ------------------------------------------------ |
| a          | :active                                          |
| с          | :checked                                         |
| f          | :focus                                           |
| h          | :hover                                           |
| i          | ::-webkit-input-placeholder, ::-moz-placeholder, :-ms-input-placeholder, ::placeholder  |
| even       | :nth-child(2n)                                   |
| odd        | :nth-child(2n+1)                                 |
| n          | :nth-child                                       |
| first      | :first-child                                     |
| last       | :last-child                                      |


**Examples:**  

```html
<a class="o70:h">link</a>
```
```css
.o70\:h:hover {
  opacity: .7;
}
```

-------------------------
```html
<div class="bg01:odd">...</div>
```
```css
.bg01\:odd:nth-child(2n+1) {
  background: #000;
  background: rgba(0,0,0,.07);
}
```

-------------------------
```html
<div class="bg01:n[3n+1]">...</div>
```
```css
.bg01\:n\[3n\+1\]:nth-child(3n+1) {
  background: #000;
  background: rgba(0,0,0,.07);
}
```

-------------------------
```html
<div class="bg01:not[.anyClass]">...</div>
```
```css
.bg01\:not\[\.anyClass\]:not(.anyClass) {
  background: #000;
  background: rgba(0,0,0,.07);
}
```

-------------------------
```html
<div class="bg01:not[[class*=any]\:hover]">...</div>
```
```css
.bg01\:not\[\[class\*\=any\]\\\:hover\]:not([class*=any]:hover) {
  background: #000;
  background: rgba(0,0,0,.07);
}
```


#### Other default settings

See source:  
[minimalist-notation/presets/main.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/main.js)


```js
module.exports = (mn) => {;
  mn.assign({
    '*, *:before, *:after': 'bxzBorderBox',
    html: 'ovxHidden tsa',
    body: 'm0 ovxHidden',
    a: 'crPointer@mouse',
    img: 'wmax dBlock mhAuto b0',
    iframe: 'dBlock b0',
    'aside, article, main, section, header, footer, nav, video, canvas, input, textarea':
      'dBlock',
  });
};
```


#### Side names


**How sides named in the names of the essences, if such clarification may take place for the attribute in question**


Base format: ``` {baseName}{sideName}{value} ```

| Side suffix | Sides               | Description           |
| ----------- | ------------------- | --------------------- |
| t           | top                 |                       |
| b           | bottom              |                       |
| l           | left                |                       |
| r           | right               |                       |
| v           | top, bottom         | vertical              |
| vl          | top, bottom, left   | vertical and left     |
| vr          | top, bottom, right  | vertical and right    |
| h           | left, right         | horizontal            |
| ht          | top, left, right    | horizontal and top    |
| hb          | bottom, left, right | horizontal and bottom |
| lt          | left, top           |                       |
| rt          | right, bottom       |                       |
| lb          | left, bottom        |                       |
| rb          | right, bottom       |                       |


```js

const defaultSides = reduce({
  '': [ '' ],
  t: [ 'top' ],
  b: [ 'bottom' ],
  l: [ 'left' ],
  r: [ 'right' ],

  v: [ 'top', 'bottom' ],
  vl: [ 'top', 'bottom', 'left' ],
  vr: [ 'top', 'bottom', 'right' ],

  h: [ 'left', 'right' ],
  ht: [ 'left', 'right', 'top' ],
  hb: [ 'left', 'right', 'bottom' ],

  lt: [ 'top', 'left' ],
  rt: [ 'top', 'right' ],
  lb: [ 'bottom', 'left' ],
  rb: [ 'bottom', 'right' ]
}, (dst, sides, sideKey) => {
  dst[sideKey] = reduce(sides, sidesIteratee, {});
  return dst;
}, {});

```



**Examples:**  

```html
<div m="p5"></div>
```
```css
[m~="p5"]{
  padding: 5px;
}
```
-------------------------


```html
<div m="pl10"></div>
```
```css
[m~="pl10"]{
  padding-left: 10px;
}
```
-------------------------



```html
<div m="pv15"></div>
```
```css
[m~="pv15"]{
  padding-top: 15px;
  padding-bottom: 15px;
}
```
-------------------------



```html
<div m="prb15"></div>
```
```css
[m~="prb15"]{
  padding-right: 15px;
  padding-bottom: 15px;
}
```





#### Essences of styles

See source:  
[minimalist-notation/presets/styles.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/styles.js)


See docs:  
[styles.minimalist-notation.org](https://styles.minimalist-notation.org)



#### Normalize

This is a fork of the [normalize.css v8.0.1](https://github.com/necolas/normalize.css)

See source:  
[minimalist-notation/presets/normalize.js](https://github.com/mr-amirka/minimalist-notation/presets/blob/master/normalize.js)
