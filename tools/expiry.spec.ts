import { describe, it, expect } from 'vitest';
import { expiryWarnings } from './expiry';
import type { NormalizedZone } from '../shared/zone';

const NOW = new Date('2026-08-02T00:00:00Z');

function zone(over: Partial<NormalizedZone> = {}): NormalizedZone {
  return {
    id: 'z',
    sourceId: 's',
    name: 'z',
    restriction: 'CONDITIONAL',
    reasons: [],
    altitude: { lower: 0, upper: 120, unit: 'm', reference: 'AGL' },
    geometry: { kind: 'circle', center: [6, 49], radiusM: 500 },
    bbox: [5.9, 48.9, 6.1, 49.1],
    applicability: { permanent: true },
    authority: { name: 'a' },
    text: { source: null, translations: {} },
    conditions: [],
    ...over,
  };
}

const until = (end: string) =>
  zone({ applicability: { permanent: false, start: '2020-01-01T00:00:00Z', end } });

describe('expiryWarnings', () => {
  it('says nothing about a source of permanent zones', () => {
    expect(expiryWarnings([zone(), zone()], NOW)).toEqual([]);
  });

  it('says nothing when the windows run well past the horizon', () => {
    expect(expiryWarnings([until('2030-01-01T00:00:00Z')], NOW)).toEqual([]);
  });

  it('reports zones that have already lapsed', () => {
    const warnings = expiryWarnings([until('2020-06-01T00:00:00Z'), zone()], NOW);
    expect(warnings).toEqual(['1 of 2 zones have already expired and will not be shown']);
  });

  it('names the cliff when a large share ends on one day', () => {
    const zones = [...Array(8)].map(() => until('2026-09-01T00:00:00Z')).concat(zone(), zone());
    expect(expiryWarnings(zones, NOW)).toEqual([
      '8 of 10 zones expire within 120 days on 2026-09-01; check whether the authority has republished',
    ]);
  });

  it('reports a spread of dates with the worst day called out', () => {
    const zones = [
      until('2026-09-01T00:00:00Z'),
      until('2026-09-01T00:00:00Z'),
      until('2026-10-05T00:00:00Z'),
      zone(),
    ];
    expect(expiryWarnings(zones, NOW)).toEqual([
      '3 of 4 zones expire within 120 days, 2 of them on 2026-09-01; check whether the authority has republished',
    ]);
  });

  it('stays quiet when only a small share is inside the horizon', () => {
    const zones = [until('2026-09-01T00:00:00Z'), ...Array(9)].map((z) => z ?? zone());
    expect(expiryWarnings(zones as NormalizedZone[], NOW)).toEqual([]);
  });

  it('ignores an unparseable end date rather than counting it as expired', () => {
    expect(expiryWarnings([until('whenever')], NOW)).toEqual([]);
  });

  it('handles an empty source', () => {
    expect(expiryWarnings([], NOW)).toEqual([]);
  });
});
