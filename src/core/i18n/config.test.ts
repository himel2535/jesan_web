import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import bn from '../../../messages/bn.json';
import { pickClientMessages } from './client-messages';
import { resolveLocale } from './config';

describe('resolveLocale', () => {
  it('prefers a valid cookie', () => {
    expect(resolveLocale('en', 'bn')).toBe('en');
    expect(resolveLocale('bn', 'en-US')).toBe('bn');
  });

  it('falls back to Accept-Language, respecting q values', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('fr', 'fr-FR, en;q=0.5, bn;q=0.8')).toBe('bn');
    expect(resolveLocale(null, 'en;q=0')).toBe('bn');
  });

  it('defaults to Bengali', () => {
    expect(resolveLocale(undefined, undefined)).toBe('bn');
    expect(resolveLocale('xx', 'de-DE')).toBe('bn');
  });
});

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation files', () => {
  it('en.json and bn.json have exactly the same keys', () => {
    expect(keyPaths(bn).sort()).toEqual(keyPaths(en).sort());
  });

  it('have no empty strings', () => {
    for (const messages of [en, bn]) {
      const empty = keyPaths(messages).filter((path) => {
        const leaf = path
          .split('.')
          .reduce<unknown>((obj, k) => (obj as Record<string, unknown>)[k], messages);
        return typeof leaf !== 'string' || leaf.trim() === '';
      });
      expect(empty).toEqual([]);
    }
  });
});

describe('pickClientMessages', () => {
  it('sends only client namespaces, plus demo outside production', () => {
    expect(Object.keys(pickClientMessages(en, true))).not.toContain('dashboard');
    expect(Object.keys(pickClientMessages(en, true))).not.toContain('dealership');
    expect(Object.keys(pickClientMessages(en, true))).toContain('auth');
    expect(Object.keys(pickClientMessages(en, true))).not.toContain('demo');
    expect(Object.keys(pickClientMessages(en, false))).toContain('demo');
    expect(pickClientMessages(en, true).common).toEqual(en.common);
  });
});
