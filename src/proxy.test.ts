// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

describe('proxy (page gate)', () => {
  it('without the access cookie, sends the browser to resume with the current path', () => {
    const response = proxy(new NextRequest('http://localhost:3000/b/akij-cement/sales?page=2'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/api/v1/auth/resume?next=%2Fb%2Fakij-cement%2Fsales%3Fpage%3D2',
    );
  });

  it('with the access cookie, lets the request through and passes the path to layouts', () => {
    const response = proxy(
      new NextRequest('http://localhost:3000/b/akij-cement?x=1', {
        headers: { cookie: 'jesan_at=abc' },
      }),
    );
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-jesan-pathname')).toBe(
      '/b/akij-cement?x=1',
    );
  });

  it('does not run for the API proxy, login, Next internals or files', () => {
    const [pattern] = config.matcher;
    const regex = new RegExp(`^${pattern!}$`);
    for (const path of ['/', '/b/akij-cement', '/account/password', '/dev/ui']) {
      expect(regex.test(path), path).toBe(true);
    }
    for (const path of [
      '/api/v1/auth/me',
      '/api/v1/auth/resume',
      '/login',
      '/_next/static/a.js',
      '/favicon.ico',
      '/logo.png',
    ]) {
      expect(regex.test(path), path).toBe(false);
    }
  });
});
