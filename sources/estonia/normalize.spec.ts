import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, textOf } from './normalize';
import { publishedAtFrom } from './fetch';

/**
 * A verbatim subset. The one zone EANS marks hidden is a 15,883-point polygon, too large to
 * commit, so the skip is covered by a synthetic case below instead.
 */
const raw = readFileSync(
  new URL('./__fixtures__/est_zones_20260507.json', import.meta.url),
  'utf8',
);
const { zones, warnings } = normalize(raw);

describe('estonia normalize', () => {
  it('returns every visible feature', () => {
    expect(zones).toHaveLength(13);
  });

  it('maps restrictions, including the informational majority', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    expect(counts).toEqual({ REQ_AUTHORISATION: 5, NO_RESTRICTION: 8 });
  });

  it('skips a zone EANS marks hidden', () => {
    const one = JSON.parse(raw);
    one.features = [structuredClone(one.features[0])];
    expect(normalize(JSON.stringify(one)).zones).toHaveLength(1);
    one.features[0].properties.hidden = true;
    expect(normalize(JSON.stringify(one)).zones).toHaveLength(0);
  });

  it('drops a zone that spans the whole globe', () => {
    const one = JSON.parse(raw);
    one.features = [structuredClone(one.features[0])];
    one.features[0].geometry.coordinates = [
      [
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90],
      ],
    ];
    const out = normalize(JSON.stringify(one));
    expect(out.zones).toHaveLength(0);
    expect(out.warnings[0]).toMatch(/whole globe/);
  });

  it('takes the vertical band from the metre values EANS resolves for us', () => {
    const withFloor = zones.filter((z) => z.altitude.lower > 0);
    expect(withFloor.length).toBeGreaterThan(0);
    expect(withFloor.every((z) => z.altitude.unit === 'm')).toBe(true);
    expect(zones.every((z) => z.altitude.reference === 'AGL')).toBe(true);
  });

  it('maps the prose reason onto the reason codes the UI knows', () => {
    const reasons = new Set(zones.flatMap((z) => z.reasons));
    expect([...reasons].every((r) => /^[A-Z_]+$/.test(r))).toBe(true);
    expect(reasons.has('AIR_TRAFFIC') || reasons.has('SENSITIVE')).toBe(true);
  });

  it('keeps estonian as the source text and english as a published translation', () => {
    const bilingual = zones.find((z) => z.text.source && z.text.translations['en'])!;
    expect(bilingual.text.source).not.toBe(bilingual.text.translations['en']);
  });

  it('carries the authority', () => {
    expect(zones.every((z) => z.authority.name.length > 0)).toBe(true);
  });

  it('produces no warnings for the known-good fixture', () => {
    expect(warnings).toEqual([]);
  });
});

describe('textOf', () => {
  it('splits the localized list into source and translation', () => {
    expect(
      textOf({
        extendedProperties: {
          localizedMessages: [
            { language: 'en-GB', message: 'English text' },
            { language: 'et-EE', message: 'Eesti tekst' },
          ],
        },
      }),
    ).toEqual({ source: 'Eesti tekst', translations: { en: 'English text' } });
  });

  it('falls back to the plain message when there is no localized list', () => {
    expect(textOf({ message: 'Only this' })).toEqual({ source: 'Only this', translations: {} });
  });

  it('handles a feature with no text at all', () => {
    expect(textOf({})).toEqual({ source: null, translations: {} });
  });
});

describe('publishedAtFrom', () => {
  it('uses the newest per-feature update stamp', () => {
    expect(
      publishedAtFrom({
        features: [
          { properties: { metaData: { updateDateTime: '2026-01-01T00:00:00.000Z' } } },
          { properties: { metaData: { updateDateTime: '2026-05-07T11:38:12.622Z' } } },
        ],
      }),
    ).toBe('2026-05-07');
  });

  it('throws when no feature carries one', () => {
    expect(() => publishedAtFrom({ features: [{ properties: {} }] })).toThrow(/updateDateTime/);
  });
});
