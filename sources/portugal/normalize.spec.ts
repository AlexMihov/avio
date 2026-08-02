import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, splitBilingual } from './normalize';
import { publishedAtFrom } from './fetch';

/**
 * A verbatim subset of one real release, chosen to carry every shape the normalizer has to
 * survive: circles alongside polygons, multi-part zones, all four restriction levels
 * including NO_RESTRICTION, an AMSL band, temporary windows and a message with no English half.
 */
const raw = readFileSync(
  new URL('./__fixtures__/prt_zones_20260422.json', import.meta.url),
  'utf8',
);

const { zones, warnings } = normalize(raw);
const helipad = zones.find((z) => z.id === 'PRT-1001UA')!;

describe('portugal normalize', () => {
  it('emits one zone per geometry part', () => {
    expect(zones).toHaveLength(27);
    expect(zones.filter((z) => z.id.startsWith('PRT-1063UA-')).map((z) => z.id)).toEqual([
      'PRT-1063UA-1',
      'PRT-1063UA-2',
    ]);
  });

  it('maps all four restriction levels, including the informational one', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    expect(counts).toEqual({
      PROHIBITED: 9,
      REQ_AUTHORISATION: 7,
      CONDITIONAL: 6,
      NO_RESTRICTION: 5,
    });
  });

  it('keeps the big aerodrome envelopes rather than dropping them', () => {
    // Madeira and its siblings restrict nothing themselves; their sub-areas do. Dropping them
    // would silently remove the aerodromes from the map.
    const madeira = zones.find((z) => z.id === 'PRT-45001UA')!;
    expect(madeira.restriction).toBe('NO_RESTRICTION');
    expect(madeira.name).toMatch(/Madeira/);
  });

  it('keeps circles as circles with their exact radius', () => {
    expect(zones.filter((z) => z.geometry.kind === 'circle')).toHaveLength(18);
    expect(helipad.geometry).toEqual({
      kind: 'circle',
      center: [-8.1997222, 39.4561111],
      radiusM: 1000,
    });
  });

  it('keeps polygons and computes a bbox containing the circle centre', () => {
    expect(zones.filter((z) => z.geometry.kind === 'polygon')).toHaveLength(9);
    const [minLon, minLat, maxLon, maxLat] = helipad.bbox;
    expect(minLon).toBeLessThan(-8.1997222);
    expect(maxLon).toBeGreaterThan(-8.1997222);
    expect(minLat).toBeLessThan(39.4561111);
    expect(maxLat).toBeGreaterThan(39.4561111);
  });

  it('reads both vertical references', () => {
    const refs = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.altitude.reference] = (a[z.altitude.reference] ?? 0) + 1), a),
      {},
    );
    expect(refs).toEqual({ AGL: 25, AMSL: 2 });
  });

  it('splits the bilingual message into source and published translation', () => {
    expect(helipad.text.source).toMatch(/^Categoria aberta/);
    expect(helipad.text.source).not.toMatch(/EN-/);
    expect(helipad.text.translations['en']).toMatch(/^Open category/);
  });

  it('tolerates a message with no english half', () => {
    // 71 of the 358 zones write only Portuguese, or append English with no EN marker; the
    // whole string stays as the source rather than being split on a guess.
    const ptOnly = zones.find((z) => z.id === 'PRT-88001UA')!;
    expect(ptOnly.text.source).toMatch(/^Carece de autorização/);
    expect(ptOnly.text.translations).toEqual({});
  });

  it('converts a ceiling published in feet to metres', () => {
    // ANAC states three nature-reserve ceilings in feet; storing 1000 as metres would put the
    // ceiling more than three times too high.
    const zpe = zones.find((z) => z.id === 'PRT-94009UA')!;
    expect(zpe.altitude).toEqual({ lower: 0, upper: 305, unit: 'm', reference: 'AMSL' });
  });

  it('carries otherReasonInfo as a condition rather than losing it', () => {
    expect(zones.find((z) => z.id === 'PRT-1063UA-1')!.conditions).toEqual(['Área 1']);
  });

  it('carries the authority and its contact', () => {
    expect(helipad.authority.email).toBe('uas.spec@anac.pt');
    expect(helipad.authority.name).toMatch(/ANAC/);
    expect(helipad.authority.siteUrl).toBe('https://www.anac.pt/');
  });

  it('marks temporary zones with their window', () => {
    expect(zones.filter((z) => !z.applicability.permanent)).toHaveLength(2);
  });

  it('produces no warnings for the known-good fixture', () => {
    expect(warnings).toEqual([]);
  });
});

describe('splitBilingual', () => {
  it('splits on the EN marker', () => {
    expect(splitBilingual('PT-Proibido. EN-Prohibited.')).toEqual({
      pt: 'Proibido.',
      en: 'Prohibited.',
    });
  });

  it('tolerates spaces and dashes around the markers', () => {
    expect(splitBilingual('PT - Proibido. EN - Prohibited.')).toEqual({
      pt: 'Proibido.',
      en: 'Prohibited.',
    });
  });

  it('returns only portuguese when there is no english half', () => {
    expect(splitBilingual('PT - Só português.')).toEqual({ pt: 'Só português.', en: null });
  });

  it('handles an absent message', () => {
    expect(splitBilingual(null)).toEqual({ pt: null, en: null });
  });
});

describe('publishedAtFrom', () => {
  it('reads the DDMMYYYYHHMMSS release stamp', () => {
    expect(publishedAtFrom('Version: 22042026083205')).toBe('2026-04-22');
  });

  it('throws when the stamp is missing, rather than publishing an undated mirror', () => {
    expect(() => publishedAtFrom('Version: unknown')).toThrow(/no release stamp/);
    expect(() => publishedAtFrom(undefined)).toThrow(/no release stamp/);
  });
});
