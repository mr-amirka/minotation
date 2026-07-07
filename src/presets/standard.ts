/* eslint-disable */
// @ts-nocheck
/* eslint-disable */
import type {
  MnFn, 
} from '../core';

// H=hidden, A=auto, V=visible, S=scroll, C=clip — иначе kwVal; без аргумента → hidden
// Модульный скоуп: инициализируется один раз, не пересоздаётся при каждом вызове presetStandard
const _OV_MAP: Record<string, string> = {
  H: 'hidden',
  A: 'auto',
  V: 'visible',
  S: 'scroll',
  C: 'clip', 
};
function ovVal(arg: string): string {
  if (!arg) {
    return 'hidden';
  }
  return _OV_MAP[arg] ?? arg.replace(/[A-Z]/g, (ch, i) => (i === 0 ? '' : '-') + ch.toLowerCase());
}

/**
 * Стандартный пресет Minimalist Notation.
 * Все имена тегов — канонические из MN 1.x (верифицированы по mn-docs).
 */
export function presetStandard(mn: MnFn): void {
  const {
    val, kwVal, colorVal, numVal, spacedVal, alignVal,
    dirVal, weightVal, textDecoVal, shadowVal, filterVal, transformVal, multiVal,
  } = mn.utils;

  // ================================================================
  // Width / Height
  // ================================================================
  mn('w', (c) => ({
    style: {
      width: c.arg ? val(c.arg) : '100%',
    },
  }));
  mn('h', (c) => {
    if (!c.arg) {
      return {
        style: {
          height: '100%', 
        }, 
      };
    }
    return {
      style: {
        height: val(c.arg), 
      }, 
    };
  });
  mn('wmin', (c) => ({
    style: {
      minWidth: val(c.arg),
    },
  }));
  mn('wmax', (c) => ({
    style: {
      maxWidth: val(c.arg),
    },
  }));
  mn('hmin', (c) => ({
    style: {
      minHeight: val(c.arg || '0'),
    },
  }));
  mn('hmax', (c) => ({
    style: {
      maxHeight: val(c.arg),
    },
  }));

  // Square
  mn('sq', (c) => {
    const v = c.arg ? val(c.arg) : '100%';
    return {
      style: {
        width: v,
        height: v,
      },
    };
  });
  mn('sqmin', (c) => {
    const v = c.arg ? val(c.arg) : '100%';
    return {
      style: {
        minWidth: v,
        minHeight: v,
      },
    };
  });
  mn('sqmax', (c) => {
    const v = c.arg ? val(c.arg) : '100%';
    return {
      style: {
        maxWidth: v,
        maxHeight: v,
      },
    };
  });

  // ================================================================
  // Padding / Margin
  // ================================================================
  mn('p', (c) => ({
    style: {
      padding: val(c.arg),
    },
  }));
  mn('pt', (c) => ({
    style: {
      paddingTop: val(c.arg),
    },
  }));
  mn('pb', (c) => ({
    style: {
      paddingBottom: val(c.arg),
    },
  }));
  mn('pl', (c) => ({
    style: {
      paddingLeft: val(c.arg),
    },
  }));
  mn('pr', (c) => ({
    style: {
      paddingRight: val(c.arg),
    },
  }));
  mn('px', (c) => {
    const v = val(c.arg);
    return {
      style: {
        paddingLeft: v,
        paddingRight: v,
      },
    };
  });
  mn('py', (c) => {
    const v = val(c.arg);
    return {
      style: {
        paddingTop: v,
        paddingBottom: v,
      },
    };
  });

  mn('m', (c) => ({
    style: {
      margin: val(c.arg),
    },
  }));
  mn('mt', (c) => ({
    style: {
      marginTop: val(c.arg),
    },
  }));
  mn('mb', (c) => ({
    style: {
      marginBottom: val(c.arg),
    },
  }));
  mn('ml', (c) => ({
    style: {
      marginLeft: val(c.arg),
    },
  }));
  mn('mr', (c) => ({
    style: {
      marginRight: val(c.arg),
    },
  }));
  mn('mx', (c) => {
    const v = val(c.arg);
    return {
      style: {
        marginLeft: v,
        marginRight: v,
      },
    };
  });
  mn('my', (c) => {
    const v = val(c.arg);
    return {
      style: {
        marginTop: v,
        marginBottom: v,
      },
    };
  });

  // ================================================================
  // Font
  // ================================================================
  mn('f', (c) => ({
    style: {
      fontSize: val(c.arg),
    },
  }));
  mn('fw', (c) => ({
    style: {
      fontWeight: weightVal(c.arg),
    },
  }));
  mn('lh', (c) => ({
    style: {
      lineHeight: val(c.arg, ''),
    },
  }));
  mn('ff', (c) => ({
    style: {
      fontFamily: spacedVal(c.arg),
    },
  }));
  mn('fs', (c) => {
    const m: Record<string, string> = {
      I: 'italic',
      N: 'normal',
      O: 'oblique',
    };
    return {
      style: {
        fontStyle: m[c.arg] || kwVal(c.arg),
      },
    };
  });
  mn('fv', (c) => ({
    style: {
      fontVariant: kwVal(c.arg),
    },
  }));
  mn('fst', (c) => ({
    style: {
      fontStretch: kwVal(c.arg),
    },
  }));
  mn('fsm', (c) => ({
    style: {
      fontSmooth: kwVal(c.arg),
    },
  }));
  mn('fef', (c) => ({
    style: {
      fontEffect: kwVal(c.arg),
    },
  }));
  mn('font', (c) => ({
    style: {
      font: spacedVal(c.arg || 'Caption'),
    },
  }));

  // ================================================================
  // Color
  // ================================================================
  mn('c', (c) => ({
    style: {
      color: colorVal(c.arg),
    },
  }));
  mn('bg', (c) => ({
    style: {
      background: colorVal(c.arg),
    },
  }));
  mn('bc', (c) => ({
    style: {
      borderColor: colorVal(c.arg),
    },
  }));
  mn('bgc', (c) => ({
    style: {
      backgroundColor: colorVal(c.arg),
    },
  }));
  mn('olc', (c) => ({
    style: {
      outlineColor: colorVal(c.arg),
    },
  }));
  mn('tdc', (c) => ({
    style: {
      textDecorationColor: colorVal(c.arg),
    },
  }));
  mn('temc', (c) => ({
    style: {
      textEmphasisColor: colorVal(c.arg),
    },
  }));
  mn('stroke', (c) => ({
    style: {
      stroke: colorVal(c.arg),
    },
  }));
  mn('fill', (c) => ({
    style: {
      fill: colorVal(c.arg),
    },
  }));

  // ================================================================
  // Display / Position / Float / Clear
  // ================================================================
  mn('d', (c) => ({
    style: {
      display: kwVal(c.arg),
    },
  }));
  mn('pos', (c) => ({
    style: {
      position: kwVal(c.arg),
    },
  }));
  mn('rlv', () => ({
    style: {
      position: 'relative',
    },
  }));
  mn('abs', () => ({
    style: {
      position: 'absolute',
    },
  }));
  mn('fixed', () => ({
    style: {
      position: 'fixed',
    },
  }));
  mn('sticky', () => ({
    style: {
      position: 'sticky',
    },
  }));
  mn('lt', () => ({
    style: {
      float: 'left',
    },
  }));
  mn('rt', () => ({
    style: {
      float: 'right',
    },
  }));
  mn('jt', () => ({
    style: {
      float: 'none',
    },
  }));
  mn('cl', (c) => ({
    style: {
      clear: kwVal(c.arg || 'Both'),
    },
  }));
  mn('tbl', () => ({
    style: {
      display: 'table',
      width: '100%',
      height: '100%',
    },
  }));
  mn('layout', (c) => ({
    style: {
      display: kwVal(c.arg || 'Flex'),
    },
  }));
  mn('v', (c) => ({
    style: {
      visibility: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Text align
  // ================================================================
  mn('tl', () => ({
    style: {
      textAlign: 'left',
    },
  }));
  mn('tr', () => ({
    style: {
      textAlign: 'right',
    },
  }));
  mn('tc', () => ({
    style: {
      textAlign: 'center',
    },
  }));
  mn('tj', () => ({
    style: {
      textAlign: 'justify',
    },
  }));
  mn('tal', (c) => ({
    style: {
      textAlignLast: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Text
  // ================================================================
  mn('td', (c) => ({
    style: {
      textDecoration: textDecoVal(c.arg),
    },
  }));
  mn('tdl', (c) => ({
    style: {
      textDecorationLine: kwVal(c.arg),
    },
  }));
  mn('tds', (c) => ({
    style: {
      textDecorationSkip: kwVal(c.arg),
    },
  }));
  mn('tdsi', (c) => ({
    style: {
      textDecorationSkipInk: kwVal(c.arg),
    },
  }));
  mn('tdt', (c) => ({
    style: {
      textDecorationThickness: val(c.arg),
    },
  }));
  mn('tt', (c) => ({
    style: {
      textTransform: kwVal(c.arg),
    },
  }));
  mn('va', (c) => ({
    style: {
      verticalAlign: kwVal(c.arg),
    },
  }));
  mn('ws', (c) => ({
    style: {
      whiteSpace: kwVal(c.arg),
    },
  }));
  mn('wb', (c) => ({
    style: {
      wordBreak: kwVal(c.arg),
    },
  }));
  mn('ww', (c) => ({
    style: {
      wordWrap: kwVal(c.arg),
    },
  }));
  mn('tw', (c) => ({
    style: {
      textWrap: kwVal(c.arg),
    },
  }));
  mn('wsc', (c) => ({
    style: {
      whiteSpaceCollapse: kwVal(c.arg),
    },
  }));
  mn('wos', (c) => ({
    style: {
      wordSpacing: val(c.arg),
    },
  }));
  mn('lts', (c) => ({
    style: {
      letterSpacing: val(c.arg),
    },
  }));
  mn('ti', (c) => ({
    style: {
      textIndent: val(c.arg),
    },
  }));
  mn('tov', (c) => ({
    style: {
      textOverflow: kwVal(c.arg),
    },
  }));
  mn('tsa', (c) => ({
    style: {
      textSizeAdjust: c.arg ? kwVal(c.arg) : '100%',
    },
  }));
  mn('break', () => ({
    style: {
      wordBreak: 'break-word',
      whiteSpace: 'normal',
    },
  }));
  mn('wm', (c) => ({
    style: {
      writingMode: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Border
  // ================================================================
  mn('r', (c) => ({
    style: {
      borderRadius: val(c.arg || '10000'),
    },
  }));
  mn('rlt', (c) => ({
    style: {
      borderTopLeftRadius: val(c.arg),
    },
  }));
  mn('rrt', (c) => ({
    style: {
      borderTopRightRadius: val(c.arg),
    },
  }));
  mn('rlb', (c) => ({
    style: {
      borderBottomLeftRadius: val(c.arg),
    },
  }));
  mn('rrb', (c) => ({
    style: {
      borderBottomRightRadius: val(c.arg),
    },
  }));
  // border-width (b = all sides, b[lrtb] = individual)
  mn('b', (c) => ({
    style: {
      borderWidth: val(c.arg),
    },
  }));
  mn('bl', (c) => ({
    style: {
      borderLeftWidth: val(c.arg),
    },
  }));
  mn('br', (c) => ({
    style: {
      borderRightWidth: val(c.arg),
    },
  }));
  mn('bt', (c) => ({
    style: {
      borderTopWidth: val(c.arg),
    },
  }));
  mn('bb', (c) => ({
    style: {
      borderBottomWidth: val(c.arg),
    },
  }));
  // border-style (bs = all sides, bs[lrtb] = individual)
  mn('bs', (c) => ({
    style: {
      borderStyle: kwVal(c.arg),
    },
  }));
  mn('bsl', (c) => ({
    style: {
      borderLeftStyle: kwVal(c.arg),
    },
  }));
  mn('bsr', (c) => ({
    style: {
      borderRightStyle: kwVal(c.arg),
    },
  }));
  mn('bst', (c) => ({
    style: {
      borderTopStyle: kwVal(c.arg),
    },
  }));
  mn('bsb', (c) => ({
    style: {
      borderBottomStyle: kwVal(c.arg),
    },
  }));
  // border-color (bc = all sides, bc[lrtb] = individual)
  mn('bcl', (c) => ({
    style: {
      borderLeftColor: colorVal(c.arg),
    },
  }));
  mn('bcr', (c) => ({
    style: {
      borderRightColor: colorVal(c.arg),
    },
  }));
  mn('bct', (c) => ({
    style: {
      borderTopColor: colorVal(c.arg),
    },
  }));
  mn('bcb', (c) => ({
    style: {
      borderBottomColor: colorVal(c.arg),
    },
  }));
  mn('bxz', (c) => ({
    style: {
      boxSizing: kwVal(c.arg),
    },
  }));
  mn('bi', (c) => ({
    style: {
      borderImage: spacedVal(c.arg),
    },
  }));
  mn('bdcl', (c) => ({
    style: {
      borderCollapse: kwVal(c.arg),
    },
  }));
  mn('bsp', (c) => ({
    style: {
      borderSpacing: val(c.arg),
    },
  }));

  // ================================================================
  // Shadow
  // ================================================================
  mn('bxsh', (c) => ({
    style: {
      boxShadow: shadowVal(c.arg || '0'),
    },
  }));
  mn('tsh', (c) => ({
    style: {
      textShadow: shadowVal(c.arg || '0'),
    },
  }));

  // ================================================================
  // Opacity / Object
  // ================================================================
  mn('o', (c) => {
    const num = parseInt(c.arg, 10);
    return {
      style: {
        opacity: isNaN(num) ? c.arg : String(num / 100),
      },
    };
  });
  mn('op', (c) => ({
    style: {
      objectPosition: spacedVal(c.arg),
    },
  }));

  // ================================================================
  // Overflow
  // ================================================================
  mn('ov', (c) => ({
    style: {
      overflow: ovVal(c.arg),
    },
  }));
  mn('ovx', (c) => ({
    style: {
      overflowX: ovVal(c.arg),
    },
  }));
  mn('ovy', (c) => ({
    style: {
      overflowY: ovVal(c.arg),
    },
  }));
  mn('ovs', (c) => ({
    style: {
      overflowStyle: kwVal(c.arg),
    },
  }));
  mn('ovsc', (c) => ({
    style: {
      overflowScrolling: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Z-index / Cursor / Events / Select / Resize / Clip
  // ================================================================
  mn('z', (c) => ({
    style: {
      zIndex: numVal(c.arg),
    },
  }));
  mn('cr', (c) => ({
    style: {
      cursor: kwVal(c.arg),
    },
  }));
  mn('e', (c) => ({
    style: {
      pointerEvents: kwVal(c.arg),
    },
  }));
  mn('us', (c) => ({
    style: {
      userSelect: kwVal(c.arg),
    },
  }));
  mn('rsz', (c) => ({
    style: {
      resize: kwVal(c.arg),
    },
  }));
  mn('cp', (c) => ({
    style: {
      clip: kwVal(c.arg),
    },
  }));
  mn('ta', (c) => ({
    style: {
      touchAction: kwVal(c.arg),
    },
  }));
  mn('inset', (c) => ({
    style: {
      inset: c.arg ? multiVal(c.arg) : '0',
    },
  }));

  // ================================================================
  // Flex
  // ================================================================
  mn('fx', (c) => ({
    style: {
      flex: spacedVal(c.arg || '1'), 
    } as Record<string, string>,
  }));
  mn('fxd', (c) => ({
    style: {
      flexDirection: dirVal(c.arg),
    },
  }));
  mn('fxb', (c) => ({
    style: {
      flexBasis: val(c.arg),
    },
  }));
  mn('fxw', (c) => ({
    style: {
      flexWrap: kwVal(c.arg || 'W'),
    },
  }));
  mn('fxf', (c) => ({
    style: {
      flexFlow: kwVal(c.arg),
    },
  }));
  mn('fxg', (c) => ({
    style: {
      flexGrow: numVal(c.arg),
    },
  }));
  mn('fxs', (c) => ({
    style: {
      flexShrink: numVal(c.arg),
    },
  }));
  mn('fxa', (c) => ({
    style: {
      justifyContent: alignVal(c.arg),
    },
  }));
  mn('fya', (c) => {
    const v = alignVal(c.arg);
    return {
      style: {
        alignItems: v,
        alignContent: v,
      },
    };
  });
  mn('jc', (c) => ({
    style: {
      justifyContent: alignVal(c.arg),
    },
  }));
  mn('ai', (c) => ({
    style: {
      alignItems: alignVal(c.arg),
    },
  }));
  mn('as', (c) => ({
    style: {
      alignSelf: alignVal(c.arg),
    },
  }));
  mn('ac', (c) => ({
    style: {
      alignContent: alignVal(c.arg),
    },
  }));
  mn('or', (c) => ({
    style: {
      order: numVal(c.arg),
    },
  }));

  // ================================================================
  // Grid
  // ================================================================
  mn('g', (c) => ({
    style: {
      grid: spacedVal(c.arg),
    },
  }));
  mn('gt', (c) => ({
    style: {
      gridTemplate: spacedVal(c.arg),
    },
  }));
  mn('gtc', (c) => ({
    style: {
      gridTemplateColumns: spacedVal(c.arg),
    },
  }));
  mn('gtr', (c) => ({
    style: {
      gridTemplateRows: spacedVal(c.arg),
    },
  }));
  mn('gac', (c) => ({
    style: {
      gridAutoColumns: spacedVal(c.arg),
    },
  }));
  mn('gar', (c) => ({
    style: {
      gridAutoRows: spacedVal(c.arg),
    },
  }));
  mn('gaf', (c) => ({
    style: {
      gridAutoFlow: kwVal(c.arg),
    },
  }));
  mn('gap', (c) => ({
    style: {
      gap: val(c.arg),
    },
  }));
  mn('gapc', (c) => ({
    style: {
      columnGap: val(c.arg),
    },
  }));
  mn('gapr', (c) => ({
    style: {
      rowGap: val(c.arg),
    },
  }));
  mn('gg', (c) => ({
    style: {
      gridGap: val(c.arg),
    },
  }));
  mn('ggc', (c) => ({
    style: {
      gridColumnGap: val(c.arg),
    },
  }));
  mn('ggr', (c) => ({
    style: {
      gridRowGap: val(c.arg),
    },
  }));
  mn('gc', (c) => ({
    style: {
      gridColumn: spacedVal(c.arg),
    },
  }));
  mn('gr', (c) => ({
    style: {
      gridRow: spacedVal(c.arg),
    },
  }));

  // ================================================================
  // Transform
  // ================================================================
  mn('x', (c) => ({
    style: {
      transform: transformVal(c.arg),
    },
  }));
  mn('ts', (c) => ({
    style: {
      transformStyle: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Transition / Animation
  // ================================================================
  mn('dn', (c) => ({
    style: {
      transitionDuration: (parseInt(c.arg) || 250) + 'ms',
    },
  }));
  mn('delay', (c) => ({
    style: {
      transitionDelay: (parseInt(c.arg) || 0) + 'ms',
    },
  }));
  mn('ttf', (c) => ({
    style: {
      transitionTimingFunction: kwVal(c.arg || 'Ease'),
    },
  }));
  mn('tn', (c) => ({
    style: {
      transition: spacedVal(c.arg),
    },
  }));
  mn('tp', (c) => ({
    style: {
      transitionProperty: spacedVal(c.arg),
    },
  }));
  mn('spnr', (c) => {
    const ms = parseInt(c.arg) || 1000;
    return {
      style: {
        animation: `spnr ${ms}ms linear infinite`,
        transform: `rotate(${ms}deg)`,
      },
    };
  });

  // ================================================================
  // Background
  // ================================================================
  mn('bgi', (c) => ({
    style: {
      backgroundImage: c.arg,
    },
  }));
  mn('bgp', (c) => ({
    style: {
      backgroundPosition: spacedVal(c.arg),
    },
  }));
  mn('bgpx', (c) => ({
    style: {
      backgroundPositionX: spacedVal(c.arg),
    },
  }));
  mn('bgpy', (c) => ({
    style: {
      backgroundPositionY: spacedVal(c.arg),
    },
  }));
  mn('bgs', (c) => ({
    style: {
      backgroundSize: spacedVal(c.arg),
    },
  }));
  mn('bga', (c) => ({
    style: {
      backgroundAttachment: kwVal(c.arg),
    },
  }));
  mn('bgr', (c) => ({
    style: {
      backgroundRepeat: kwVal(c.arg),
    },
  }));
  mn('bgo', (c) => ({
    style: {
      backgroundOrigin: kwVal(c.arg),
    },
  }));
  mn('bgcp', (c) => ({
    style: {
      backgroundClip: kwVal(c.arg),
    },
  }));
  mn('bgbk', (c) => ({
    style: {
      backgroundBreak: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Outline
  // ================================================================
  mn('ol', (c) => {
    if (c.arg === 'N') {
      return {
        style: {
          outline: 'none', 
        }, 
      };
    }
    if (c.arg === '0') {
      return {
        style: {
          outline: '0', 
        }, 
      };
    }
    return {
      style: {
        outline: spacedVal(c.arg), 
      }, 
    };
  });
  mn('olo', (c) => ({
    style: {
      outlineOffset: val(c.arg),
    },
  }));
  mn('ols', (c) => ({
    style: {
      outlineStyle: kwVal(c.arg),
    },
  }));
  mn('olw', (c) => ({
    style: {
      outlineWidth: val(c.arg),
    },
  }));

  // ================================================================
  // Appearance
  // ================================================================
  mn('apc', (c) => ({
    style: {
      appearance: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Sides (top/right/bottom/left)
  // ================================================================
  mn('s', (c) => {
    const v = c.arg ? val(c.arg) : '0';
    return {
      style: {
        top: v,
        bottom: v,
        left: v,
        right: v,
      },
    };
  });
  mn('st', (c) => ({
    style: {
      top: val(c.arg),
    },
  }));
  mn('sb', (c) => ({
    style: {
      bottom: val(c.arg),
    },
  }));
  mn('sl', (c) => ({
    style: {
      left: val(c.arg),
    },
  }));
  mn('sr', (c) => ({
    style: {
      right: val(c.arg),
    },
  }));

  // ================================================================
  // Stroke / Fill
  // ================================================================
  mn('sw', (c) => ({
    style: {
      strokeWidth: val(c.arg),
    },
  }));

  // ================================================================
  // List style
  // ================================================================
  mn('lis', (c) => ({
    style: {
      listStyle: spacedVal(c.arg),
    },
  }));
  mn('lisp', (c) => ({
    style: {
      listStylePosition: kwVal(c.arg),
    },
  }));
  mn('list', (c) => ({
    style: {
      listStyleType: kwVal(c.arg),
    },
  }));
  mn('lisi', (c) => ({
    style: {
      listStyleImage: c.arg,
    },
  }));

  // ================================================================
  // Content / Quotes
  // ================================================================
  mn('cnt', (c) => ({
    style: {
      content: c.arg ? c.arg.replace(/_/g, ' ') : '""',
    },
  }));
  mn('q', (c) => ({
    style: {
      quotes: c.arg ? c.arg.replace(/_/g, ' ') : 'none',
    },
  }));

  // ================================================================
  // Page break
  // ================================================================
  mn('pgbb', (c) => ({
    style: {
      breakBefore: kwVal(c.arg),
    },
  }));
  mn('pgba', (c) => ({
    style: {
      breakAfter: kwVal(c.arg),
    },
  }));
  mn('pgbi', (c) => ({
    style: {
      breakInside: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Table
  // ================================================================
  mn('cps', (c) => ({
    style: {
      captionSide: kwVal(c.arg),
    },
  }));
  mn('ec', (c) => ({
    style: {
      emptyCells: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Filter / Blend
  // ================================================================
  mn('ft', (c) => ({
    style: {
      filter: filterVal(c.arg),
    },
  }));
  mn('ftb', (c) => ({
    style: {
      backdropFilter: filterVal(c.arg),
    },
  }));
  mn('mbm', (c) => ({
    style: {
      mixBlendMode: kwVal(c.arg),
    },
  }));

  // ================================================================
  // Image rendering
  // ================================================================
  mn('contrast', () => ({
    style: {
      imageRendering: 'pixelated',
    },
  }));

  // ================================================================
  // Aspect ratio
  // ================================================================
  mn('ar', (c) => ({
    style: {
      aspectRatio: c.arg ? c.arg.replace(/_/g, '/') : '1',
    },
  }));
  mn('ratio', (c) => {
    const arg = c.arg || '1x1';
    const m = arg.match(/^(\d+)x(\d+)$/);
    if (m) {
      const pct = (parseInt(m[2]) / parseInt(m[1]) * 100) + '%';
      return {
        style: {
          position: 'relative',
          height: '0',
          paddingTop: pct,
          overflow: 'hidden',
        },
      };
    }
    return {
      style: {
        position: 'relative',
        height: '0',
        paddingTop: '100%',
        overflow: 'hidden',
      },
    };
  });

  // ================================================================
  // Clearfix
  // ================================================================
  mn.css('.cfx:after', {
    content: '""',
    display: 'table',
    clear: 'both',
  });
}
