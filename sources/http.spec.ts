import { describe, it, expect, vi, afterEach } from 'vitest';
import { request } from './http';

afterEach(() => vi.unstubAllGlobals());

describe('request', () => {
  it('returns the direct response when the site answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request('https://example.test/page');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 403 through the reader', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('no', { status: 403 }))
      .mockResolvedValueOnce(new Response('<html></html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await request('https://example.test/page');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[1][0]).toBe('https://r.jina.ai/https://example.test/page');
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'x-respond-with': 'html' });
  });

  it('does not retry other failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('gone', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    expect((await request('https://example.test/page')).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
