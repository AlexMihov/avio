/**
 * Every outbound request the data build makes.
 *
 * Node's default client sends no User-Agent, which some authority sites treat as a bot worth
 * blocking: Bulgaria's CAA answered the scheduled refresh with 403 from a GitHub runner while
 * the same request succeeded from a laptop.
 *
 * The first attempt at a fix named the project — `AvioBot/1.0; +github.com/…` — which is the
 * courteous form and is exactly what Cyprus rejects: `drones.gov.cy` returns 403 for a
 * user-agent containing "bot" and 200 without one. Measured across both sites, a plain
 * browser string is the only value that works everywhere, so that is what this sends.
 */
export const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36';

export function request(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: '*/*',
      'Accept-Language': 'en,*;q=0.5',
      ...init.headers,
    },
  });
}
