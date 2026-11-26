import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrast of the dashboard's own colour tokens (`.dash-scope`). The app-wide contrast test only
 * reads `:root` and `[data-theme]`, so the dashboard pairs are checked here, with the same formula.
 */
const css = readFileSync(resolve(process.cwd(), 'src/core/theme/tokens.css'), 'utf8');

/** Every block for `selector`, merged in source order: later blocks override earlier ones. */
function block(selector: string): Record<string, string> {
  const merged: Record<string, string> = {};
  let from = 0;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start < 0) break;
    const open = css.indexOf('{', start);
    const body = css.slice(open + 1, css.indexOf('}', open));
    for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
      merged[m[1] ?? ''] = (m[2] ?? '').trim();
    from = open + 1;
  }
  if (Object.keys(merged).length === 0) throw new Error(`selector not found: ${selector}`);
  return merged;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match?.[1]) throw new Error(`expected #rrggbb, got ${hex}`);
  const channels = [0, 2, 4].map((i) => parseInt(match[1]!.slice(i, i + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const HUES = ['blue', 'green', 'purple', 'orange'] as const;
const THEMES = {
  light: '.dash-scope',
  dark: "[data-theme='dark'] .dash-scope",
} as const;

describe.each(Object.entries(THEMES))('dashboard contrast (%s)', (_name, selector) => {
  const t = block(selector);
  const get = (key: string) => {
    const value = t[key];
    if (!value) throw new Error(`missing --${key} in ${selector}`);
    return value;
  };

  it.each(HUES)('%s: primary and muted text read on the soft card (≥ 4.5:1)', (hue) => {
    const card = get(`dash-${hue}-card-bg`);
    expect(contrast(get('dash-fg'), card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(get('dash-fg-muted'), card)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(HUES)('%s: the accent glyph reads on its icon disc (≥ 3:1, non-text)', (hue) => {
    expect(contrast(get(`dash-${hue}-accent`), get(`dash-${hue}-icon-bg`))).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('growth text (success, danger) reads on the card and the surface (≥ 4.5:1)', () => {
    for (const hue of HUES) {
      const card = get(`dash-${hue}-card-bg`);
      expect(contrast(get('dash-success'), card)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(get('dash-danger'), card)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(get('dash-success'), get('dash-surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(get('dash-danger'), get('dash-surface'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the selected-pill text reads on the filled primary (≥ 4.5:1)', () => {
    expect(contrast(get('dash-icon-fg'), get('dash-primary-fill'))).toBeGreaterThanOrEqual(4.5);
  });

  it('the primary text colour reads on the surface (≥ 4.5:1)', () => {
    expect(contrast(get('dash-primary'), get('dash-surface'))).toBeGreaterThanOrEqual(4.5);
  });
});
