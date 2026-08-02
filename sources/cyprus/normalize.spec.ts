import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, noticeDaysFrom } from './normalize';
import { publishedAtFrom } from './fetch';

/** One complete release; at 156 KB the whole thing fits, so nothing is sampled away. */
const raw = readFileSync(
  new URL('./__fixtures__/cyp_zones_20250506.json', import.meta.url),
  'utf8',
);
const { zones, warnings } = normalize(raw);

describe('cyprus normalize', () => {
  it('returns every feature', () => {
    expect(zones).toHaveLength(141);
  });

  it('maps the published restrictions', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    expect(counts).toEqual({ PROHIBITED: 29, REQ_AUTHORISATION: 112 });
  });

  it('keeps circles and polygons apart, with exact radii', () => {
    expect(zones.filter((z) => z.geometry.kind === 'circle')).toHaveLength(79);
    expect(zones.filter((z) => z.geometry.kind === 'polygon')).toHaveLength(62);
  });

  it('reads the single published band', () => {
    expect(zones.every((z) => z.altitude.lower === 0 && z.altitude.upper === 120)).toBe(true);
    expect(zones.every((z) => z.altitude.reference === 'AGL')).toBe(true);
  });

  it('keeps the greek text and attaches a curated english translation to every message', () => {
    const withText = zones.filter((z) => z.text.source !== null);
    expect(withText).toHaveLength(141);
    expect(withText.every((z) => !!z.text.translations['en'])).toBe(true);
    const prohibited = zones.find((z) => z.restriction === 'PROHIBITED')!;
    expect(prohibited.text.translations['en']).toMatch(/prohibited in this area/i);
  });

  it('reads the notice period stated in weeks', () => {
    const twoWeeks = zones.find((z) => (z.text.source ?? '').includes('2 βδομάδες'))!;
    expect(twoWeeks.authority.noticeDays).toBe(14);
    const oneWeek = zones.find((z) => (z.text.source ?? '').includes('1 βδομάδα'))!;
    expect(oneWeek.authority.noticeDays).toBe(7);
  });

  it('carries the authority and its contact', () => {
    const z = zones[0];
    expect(z.authority.email).toBe('info@drones.gov.cy');
    expect(z.authority.name).toMatch(/Πολιτικής Αεροπορίας/);
  });

  it('treats every zone as permanent, as published', () => {
    expect(zones.every((z) => z.applicability.permanent)).toBe(true);
  });

  it('produces no warnings for the known-good fixture', () => {
    expect(warnings).toEqual([]);
  });
});

describe('noticeDaysFrom', () => {
  it('converts weeks to days', () => {
    expect(noticeDaysFrom('… τουλάχιστον 2 βδομάδες πριν …')).toBe(14);
    expect(noticeDaysFrom('… τουλάχιστον 1 βδομάδα πριν …')).toBe(7);
  });

  it('returns undefined when no period is stated', () => {
    expect(noticeDaysFrom('Απαγορεύονται οι πτήσεις')).toBeUndefined();
    expect(noticeDaysFrom(null)).toBeUndefined();
  });
});

describe('publishedAtFrom', () => {
  it('reads the DD-MM-YYYY title stamp', () => {
    expect(publishedAtFrom('CYPZoneVersion 06-05-2025')).toBe('2025-05-06');
  });

  it('throws rather than publishing an undated mirror', () => {
    expect(() => publishedAtFrom('CYPZoneVersion')).toThrow(/no release date/);
  });
});
