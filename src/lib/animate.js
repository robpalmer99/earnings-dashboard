export const lerp = (a, b, t) => a + (b - a) * t;

export function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function prefersReduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Animate an element's text from 0 → value, formatting each frame.
export function countUp(el, to, { duration = 900, format = (n) => String(Math.round(n)) } = {}) {
  if (prefersReduced()) { el.textContent = format(to); return; }
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(lerp(0, to, easeOutExpo(t)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Draw an SVG path in left→right via stroke-dashoffset.
export function drawPath(pathEl, { duration = 1000 } = {}) {
  const len = pathEl.getTotalLength();
  pathEl.style.strokeDasharray = String(len);
  if (prefersReduced()) { pathEl.style.strokeDashoffset = '0'; return; }
  pathEl.style.strokeDashoffset = String(len);
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    pathEl.style.strokeDashoffset = String(len * (1 - easeOutExpo(t)));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
