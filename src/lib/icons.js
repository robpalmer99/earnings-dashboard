import { el } from './dom.js';

const stroked = (size, ...kids) => el('svg', {
  class: 'icon', width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
  'stroke-linecap': 'round', 'stroke-linejoin': 'round',
}, ...kids);

const filled = (size, d) => el('svg', {
  class: 'icon', width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor',
}, el('path', { d }));

export const icons = {
  bank: (s = 16) => stroked(s, el('path', { d: 'M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M3 10l9-7 9 7' })),
  lock: (s = 14) => stroked(s, el('rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }), el('path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' })),
  bolt: (s = 14) => filled(s, 'M13 2 3 14h9l-1 8 10-12h-9l1-8z'),
  arrowUp: (s = 14) => stroked(s, el('path', { d: 'M12 19V5M5 12l7-7 7 7' })),
  check: (s = 14) => stroked(s, el('path', { d: 'M20 6 9 17l-5-5' })),
  caretUp: (s = 10) => filled(s, 'M12 6l8 12H4z'),
  caretDown: (s = 10) => filled(s, 'M12 18 4 6h16z'),
  bell: (s = 18) => stroked(s, el('path', { d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }), el('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })),
  home: (s = 20) => stroked(s, el('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }), el('path', { d: 'M9 22V12h6v10' })),
  chart: (s = 20) => stroked(s, el('line', { x1: 12, y1: 20, x2: 12, y2: 10 }), el('line', { x1: 18, y1: 20, x2: 18, y2: 4 }), el('line', { x1: 6, y1: 20, x2: 6, y2: 16 })),
  dollar: (s = 20) => stroked(s, el('line', { x1: 12, y1: 1, x2: 12, y2: 23 }), el('path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' })),
  gear: (s = 20) => stroked(s, el('circle', { cx: 12, cy: 12, r: 3 }), el('path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' })),
};
