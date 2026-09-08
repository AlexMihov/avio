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

/**
 * Cloudflare in front of Bulgaria's CAA answers datacentre addresses with 403 no matter what
 * the request looks like, so the scheduled refresh cannot reach the page that carries the
 * current zip link while a laptop can. Jina's reader fetches the page from its own network and
 * returns it verbatim when asked for html, which is enough to get past that one block.
 *
 * It only runs after a real 403 and only for pages: the reader answers 422 for binary content,
 * which surfaces as an ordinary failed response.
 */
const READER = 'https://r.jina.ai/';

export async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en,*;q=0.5',
    ...init.headers,
  };
  const response = await fetch(url, { ...init, headers });
  if (response.status !== 403) return response;
  return fetch(READER + url, { ...init, headers: { ...headers, 'x-respond-with': 'html' } });
}
