// Expands #rrggbb into an rgba() string at a given alpha.
function tint(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applyTheme(config, target = document.documentElement) {
  const { accent, font, radius, base } = config.theme;
  target.style.setProperty('--accent', accent);
  target.style.setProperty('--accent-soft', tint(accent, 0.12));
  target.style.setProperty('--accent-contrast', '#ffffff');
  target.style.setProperty('--font', font);
  target.style.setProperty('--radius', radius + 'px');
  target.setAttribute('data-base', base);
}
