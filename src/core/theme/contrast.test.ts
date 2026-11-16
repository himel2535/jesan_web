import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/core/theme/tokens.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const body = css.slice(open + 1, css.indexOf('}', open));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]),
  );
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

// [text, background] pairs the UI actually uses. WCAG AA for normal text: 4.5:1.
const pairs: [string, string][] = [
  ['fg', 'bg'],
  ['fg', 'surface'],
  ['fg', 'surface-muted'],
  ['fg-muted', 'bg'],
  ['fg-muted', 'surface'],
  ['primary-fg', 'primary'],
  ['danger-fg', 'danger'],
  ['success', 'surface'],
  ['warning', 'surface'],
  ['danger', 'surface'],
  ['success', 'bg'],
  ['warning', 'bg'],
  ['danger', 'bg'],
];

const themes = {
  light: block("[data-theme='light']"),
  dark: block("[data-theme='dark']"),
};

describe.each(Object.entries(themes))('%s theme contrast', (_name, tokens) => {
  it.each(pairs)('%s on %s meets WCAG AA (4.5:1)', (text, background) => {
    expect(contrast(tokens[text]!, tokens[background]!)).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring is visible against the background (3:1, non-text)', () => {
    expect(contrast(tokens.focus!, tokens.bg!)).toBeGreaterThanOrEqual(3);
  });
});

describe('system theme', () => {
  it('uses exactly the dark tokens when the OS prefers dark', () => {
    const mediaStart = css.indexOf('@media (prefers-color-scheme: dark)');
    const system = block("[data-theme='system']");
    expect(mediaStart).toBeGreaterThan(-1);
    expect(system).toEqual(themes.dark);
  });
});
