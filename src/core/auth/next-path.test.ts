import { describe, expect, it } from 'vitest';
import { loginPath, resumePath, safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it('keeps paths on this site, with query and hash', () => {
    expect(safeNextPath('/b/akij-cement/sales?page=2#top')).toBe('/b/akij-cement/sales?page=2#top');
    expect(safeNextPath('/')).toBe('/');
  });

  it.each([
    [null],
    [''],
    ['https://evil.example/'],
    ['//evil.example/x'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['b/relative'],
    ['/login'],
    ['/login?next=/x'],
    ['/api/v1/auth/resume'],
  ])('rejects %s → /', (value) => {
    expect(safeNextPath(value)).toBe('/');
  });
});

describe('loginPath / resumePath', () => {
  it('adds an encoded next, but not for the home page', () => {
    expect(loginPath('/b/x/sales?page=2')).toBe('/login?next=%2Fb%2Fx%2Fsales%3Fpage%3D2');
    expect(resumePath('/b/x')).toBe('/api/v1/auth/resume?next=%2Fb%2Fx');
    expect(loginPath('/')).toBe('/login');
    expect(loginPath('https://evil.example')).toBe('/login');
  });
});
