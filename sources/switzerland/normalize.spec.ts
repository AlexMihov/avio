import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, noticeDaysFrom } from './normalize';

/**
 * The full release is 17 MB, so the fixture is a verbatim subset of one real publication
 * chosen to carry every shape the normalizer has to survive: multi-part zones, unbounded
 * ceilings declared AMSL, bounded AGL ceilings, a floor above ground, temporary windows and
 * an unmodelled daily period. It has the same shape the fetcher produces — the ED-269
 * document plus the GeoPackage's multilingual text rows, joined on identifier.
 */
const raw = readFileSync(
  new URL('./__fixtures__/che_zones_20260802.json', import.meta.url),
  'utf8',
);

const { zones, warnings } = normalize(raw);
const prison = zones.find((z) => z.id === 'CHE-SIO0001')!;

describe('switzerland normalize', () => {
  it('emits one zone per geometry part', () => {
    // 21 features, 25 geometries — nothing is dropped after the first part.
    expect(zones).toHaveLength(25);
    expect(zones.filter((z) => z.id.startsWith('CHE-GE71-')).map((z) => z.id)).toEqual([
      'CHE-GE71-1',
      'CHE-GE71-2',
      'CHE-GE71-3',
      'CHE-GE71-4',
    ]);
  });

  it('leaves a single-part zone unsuffixed', () => {
    expect(prison).toBeDefined();
  });

  it('maps restrictions without loss', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    expect(counts).toEqual({ REQ_AUTHORISATION: 25 });
  });

  it('turns the 99999 sentinel into an unbounded ceiling', () => {
    expect(zones.filter((z) => z.altitude.upper === null)).toHaveLength(19);
    expect(zones.some((z) => z.altitude.upper === 99999)).toBe(false);
  });

  it('reports an unbounded ceiling as AGL when the floor is AGL, ignoring the AMSL label', () => {
    // FOCA leaves upperVerticalReference at AMSL on unbounded ceilings; taking it literally
    // would label a ground-referenced band as sea-level referenced.
    const amslSentinel = zones.find((z) => z.id === 'CHE-GE50')!;
    expect(amslSentinel.altitude).toEqual({
      lower: 0,
      upper: null,
      unit: 'm',
      reference: 'AGL',
    });
  });

  it('keeps bounded ceilings with their published reference', () => {
    expect(prison.altitude).toEqual({ lower: 0, upper: 150, unit: 'm', reference: 'AGL' });
  });

  it('keeps a floor above ground', () => {
    const ctr = zones.find((z) => z.id === 'CHE-CTR0001')!;
    expect(ctr.altitude.lower).toBe(120);
    expect(ctr.altitude.upper).toBeNull();
  });

  it('keeps polygons as polygons and computes a containing bbox', () => {
    expect(zones.every((z) => z.geometry.kind === 'polygon')).toBe(true);
    const [minLon, minLat, maxLon, maxLat] = prison.bbox;
    const ring = (prison.geometry as { rings: [number, number][][] }).rings[0];
    expect(ring.every(([lon]) => lon >= minLon && lon <= maxLon)).toBe(true);
    expect(ring.every(([, lat]) => lat >= minLat && lat <= maxLat)).toBe(true);
  });

  it('reads the notice period from the ISO duration', () => {
    expect(prison.authority.noticeDays).toBe(10);
    expect(zones.find((z) => z.id === 'CHE-VD00917')!.authority.noticeDays).toBe(20);
  });

  it('carries authority contact details including the site url', () => {
    expect(prison.authority.email).toBe('SAPEM-DIRECTION@admin.vs.ch');
    expect(prison.authority.siteUrl).toMatch(/^https?:\/\//);
    expect(prison.authority.contactName).toBeUndefined();
  });

  it('marks non-permanent zones with their window', () => {
    const temporal = zones.filter((z) => !z.applicability.permanent);
    expect(temporal.map((z) => z.id).sort()).toEqual(['CHE-LSPU002', 'CHE-VD00917']);
    expect(temporal[0].applicability).toHaveProperty('start');
  });

  it('keeps the authority text and its conditions', () => {
    expect(prison.text.source).toMatch(/Exemption permits/);
    expect(prison.conditions).toEqual(['The operation of unmanned aircraft is prohibited.']);
  });

  it("carries FOCA's own text in all four national languages", () => {
    expect(Object.keys(prison.text.translations).sort()).toEqual(['de', 'en', 'fr', 'it']);
    expect(prison.text.translations['de']).toMatch(/Ausnahmebewilligungen/);
    expect(prison.conditionTranslations!['de']).toEqual([
      'Der Betrieb von unbemannten Luftfahrzeugen ist verboten.',
    ]);
    expect(prison.conditionTranslations!['fr']![0]).toMatch(/interdit/);
  });

  it('localises the authority name', () => {
    const aargau = zones.find((z) => z.authority.nameTranslations?.['de'] === 'Kanton Aargau');
    expect(aargau?.authority.nameTranslations?.['en']).toBe('Canton of Aargau');
  });

  it('gives every zone a geopackage row', () => {
    expect(zones.every((z) => z.conditionTranslations?.['de'])).toBe(true);
  });

  it('warns about daily windows it cannot model instead of dropping them', () => {
    expect(warnings).toEqual([
      'CHE-KTAG508: daily time window is published but not modelled',
      'CHE-KTAG506: daily time window is published but not modelled',
    ]);
  });
});

describe('noticeDaysFrom', () => {
  it('parses the forms FOCA publishes', () => {
    expect(noticeDaysFrom('P05DT00H')).toBe(5);
    expect(noticeDaysFrom('P30DT00H')).toBe(30);
  });

  it('rounds a part-day up and handles larger units', () => {
    expect(noticeDaysFrom('P0DT12H')).toBe(1);
    expect(noticeDaysFrom('P1M')).toBe(30);
    expect(noticeDaysFrom('P2W')).toBe(14);
  });

  it('returns undefined for absent or unparseable values', () => {
    expect(noticeDaysFrom(undefined)).toBeUndefined();
    expect(noticeDaysFrom('')).toBeUndefined();
    expect(noticeDaysFrom('P0DT00H')).toBeUndefined();
    expect(noticeDaysFrom('soon')).toBeUndefined();
  });
});
