/** `#rrggbb` → [r, g, b] in 0–255; null for anything else. */
function rgbOf(hex: string | null | undefined): [number, number, number] | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : null;
}

/** `#rrggbb` as the `H S% L%` triple the theme variables hold (`--primary: 222.2 47.4% 11.2%`); null if invalid. */
export function hslTokenOf(hex: string | null | undefined): string | null {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0 && max === r) h = 60 * (((g - b) / d) % 6);
  else if (d !== 0 && max === g) h = 60 * ((b - r) / d + 2);
  else if (d !== 0) h = 60 * ((r - g) / d + 4);
  const round = (v: number) => Math.round(v * 10) / 10;
  return `${round(h < 0 ? h + 360 : h)} ${round(s * 100)}% ${round(l * 100)}%`;
}

/** WCAG 2.1 relative luminance of `#rrggbb` (0 black … 1 white); null if invalid. */
export function luminanceOf(hex: string | null | undefined): number | null {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours (1–21); null if either is invalid. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminanceOf(a);
  const lb = luminanceOf(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white, whichever reads better on `background` (text on a brand-coloured surface). */
export function readableTextOn(background: string | null | undefined): '#ffffff' | '#0f172a' {
  const white = contrastRatio(background ?? '', '#ffffff') ?? 21;
  const dark = contrastRatio(background ?? '', '#0f172a') ?? 0;
  return white >= dark ? '#ffffff' : '#0f172a';
}
