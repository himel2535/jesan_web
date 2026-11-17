import { describe, expect, it } from 'vitest';
import { webOrigin } from './origin';

const h = (init: Record<string, string>) => new Headers(init);

describe('webOrigin', () => {
  it('uses APP_ORIGIN when set (trailing slash removed)', () => {
    expect(
      webOrigin(h({ host: 'internal:3000' }), 'http://internal:3000/x', 'https://app.example.com/'),
    ).toBe('https://app.example.com');
  });

  it('uses forwarded host and protocol behind a proxy', () => {
    expect(
      webOrigin(
        h({
          host: 'internal:3000',
          'x-forwarded-host': 'app.example.com',
          'x-forwarded-proto': 'https',
        }),
        'http://internal:3000/x',
        '',
      ),
    ).toBe('https://app.example.com');
  });

  it('falls back to the Host header and the request scheme (local dev)', () => {
    expect(
      webOrigin(h({ host: 'localhost:3000' }), 'http://localhost:3000/api/v1/auth/resume', ''),
    ).toBe('http://localhost:3000');
  });
});
