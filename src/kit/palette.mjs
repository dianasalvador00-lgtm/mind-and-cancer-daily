// The daily colour pair. Each issue picks one palette id; the layout turns it into CSS variables.
// Every palette is checked at validate time (checkPalettes):
//   1. both accents reach WCAG AA contrast (4.5:1) as text on the paper, in light and dark mode;
//   2. the two accents stay distinguishable under simulated deuteranopia and protanopia
//      (CIE76 delta E of at least 20 after simulation).
// Issues can only reference ids, never raw colours.

export const PAPER = { light: '#fbf8f3', dark: '#0f1114' };
export const INK = { light: '#15171b', dark: '#eff1f4' };
export const CARD = { light: '#ffffff', dark: '#16191e' };

export const PALETTES = [
  { id: 'teal-amber', name: 'Teal and amber', light: ['#0b6e6e', '#9a5208'], dark: ['#4fc3c3', '#f0a24b'] },
  { id: 'indigo-coral', name: 'Indigo and coral', light: ['#3a47b5', '#b03d2b'], dark: ['#8f9cff', '#ff8f7a'] },
  { id: 'slate-gold', name: 'Slate and gold', light: ['#334e68', '#8a5a00'], dark: ['#9fb3c8', '#e6b84a'] },
  { id: 'pine-copper', name: 'Pine and copper', light: ['#1f5f4a', '#a0461f'], dark: ['#5fc7a4', '#f29a6b'] },
  { id: 'ocean-ember', name: 'Ocean and ember', light: ['#0a5c99', '#ae4519'], dark: ['#5eb3f0', '#ff9a66'] },
  { id: 'cobalt-saffron', name: 'Cobalt and saffron', light: ['#1d4ed8', '#8f5a00'], dark: ['#7ea2ff', '#e8b04a'] },
  { id: 'denim-ochre', name: 'Denim and ochre', light: ['#264d86', '#865a07'], dark: ['#8fb0ea', '#e2b456'] },
  { id: 'brick-azure', name: 'Brick and azure', light: ['#9a3412', '#0369a1'], dark: ['#ff9a6b', '#5cb8f0'] },
  { id: 'navy-orange', name: 'Navy and orange', light: ['#1e3a8a', '#b4501a'], dark: ['#8fa8f5', '#ff9b57'] },
  { id: 'berry-green', name: 'Berry and green', light: ['#8f2c78', '#2f6a2a'], dark: ['#e58bcd', '#7fd07a'] },
  { id: 'steel-brick', name: 'Steel and brick', light: ['#2c5f7c', '#9c3d22'], dark: ['#7fc0e0', '#ff9a7a'] },
];

export const paletteIds = () => PALETTES.map((p) => p.id);
export const getPalette = (id) => PALETTES.find((p) => p.id === id);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);

export function contrast(a, b) {
  const [l1, l2] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Machado et al. 2009 matrices (severity 1.0), applied in linear RGB.
const SIM = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const clamp = (x) => Math.min(1, Math.max(0, x));
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function simulate(rgb, kind) {
  const l = rgb.map((c) => lin(c));
  const m = SIM[kind];
  return m.map((row) => clamp(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])).map((c) => toSrgb(c) * 255);
}

function lab(rgb) {
  const [r, g, b] = rgb.map((c) => lin(c));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Returns a list of problems; empty means every palette passes. */
export function checkPalettes() {
  const problems = [];
  const ids = new Set();
  for (const p of PALETTES) {
    if (ids.has(p.id)) problems.push(`palette ${p.id}: duplicate id`);
    ids.add(p.id);
    for (const mode of ['light', 'dark']) {
      for (const [surfaceName, paper] of [['paper', PAPER[mode]], ['card', CARD[mode]]]) {
        p[mode].forEach((c, i) => {
          const r = contrast(c, paper);
          if (r < 4.5) problems.push(`palette ${p.id} ${mode} accent ${i + 1} ${c}: contrast ${r.toFixed(2)} on ${surfaceName} ${paper} (needs 4.5)`);
        });
      }
      for (const kind of Object.keys(SIM)) {
        const d = deltaE(lab(simulate(hex(p[mode][0]), kind)), lab(simulate(hex(p[mode][1]), kind)));
        if (d < 20) problems.push(`palette ${p.id} ${mode}: accents too close under ${kind} (delta E ${d.toFixed(1)}, needs 20)`);
      }
    }
  }
  return problems;
}
