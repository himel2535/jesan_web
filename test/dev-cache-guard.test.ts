import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain Node script without type declarations
import { fingerprint, shouldClear } from '../scripts/dev-cache-guard.mjs';

const base = {
  lockfile: '{"lockfileVersion":3}',
  nextVersion: '16.4.6',
  nodeVersion: 'v22.23.5',
  platform: 'darwin',
  arch: 'x64',
};

describe('dev cache guard', () => {
  it('fingerprint changes with the lockfile, Next, Node, platform or arch', () => {
    const a = fingerprint(base);
    expect(fingerprint({ ...base })).toBe(a);
    for (const change of [
      { lockfile: '{"lockfileVersion":3,"x":1}' },
      { nextVersion: '16.4.7' },
      { nodeVersion: 'v22.23.6' },
      { platform: 'linux' },
      { arch: 'arm64' },
    ]) {
      expect(fingerprint({ ...base, ...change })).not.toBe(a);
    }
  });

  it('clears only a dev cache built with other dependencies, or when forced', () => {
    expect(shouldClear({ force: false, devDirExists: true, previous: 'a', current: 'a' })).toBe(
      false,
    );
    expect(shouldClear({ force: false, devDirExists: true, previous: 'a', current: 'b' })).toBe(
      true,
    );
    // No stamp yet but an old cache exists (first run after this change): clear once.
    expect(shouldClear({ force: false, devDirExists: true, previous: '', current: 'b' })).toBe(
      true,
    );
    expect(shouldClear({ force: false, devDirExists: false, previous: '', current: 'b' })).toBe(
      false,
    );
    expect(shouldClear({ force: true, devDirExists: false, previous: 'a', current: 'a' })).toBe(
      true,
    );
  });
});
