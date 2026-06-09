// Parses #rgb or #rrggbb into [r, g, b].
function rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Expands #rrggbb into an rgba() string at a given alpha.
function tint(hex, alpha) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Picks black or white text for legibility on the given background,
// using perceived (sRGB-weighted) luminance.
function contrastInk(hex) {
  const [r, g, b] = rgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

export function applyTheme(config, target = document.documentElement) {
  const { accent, font, radius, base } = config.theme;
  target.style.setProperty('--accent', accent);
  target.style.setProperty('--accent-soft', tint(accent, 0.12));
  target.style.setProperty('--accent-contrast', contrastInk(accent));
  target.style.setProperty('--font', font);
  target.style.setProperty('--radius', radius + 'px');
  target.setAttribute('data-base', base);
}
