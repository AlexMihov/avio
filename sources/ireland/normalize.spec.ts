import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize, readCondition, readWindows } from './normalize';

/**
 * A verbatim subset covering all four restriction levels, the coded conditions and the
 * multi-window zones. Every Irish geometry is a MultiPolygon, most with a single part.
 */
const raw = readFileSync(
  new URL('./__fixtures__/irl_zones_20260725.json', import.meta.url),
  'utf8',
);
const { zones, warnings } = normalize(raw);

describe('ireland normalize', () => {
  it('returns a zone per polygon part', () => {
    expect(zones).toHaveLength(14);
  });

  it('accepts the IAA spelling and reads the level from `type`', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    // REQ_AUTHORIZATION with a z folds into the spelling every other source uses.
    expect(counts).toEqual({
      PROHIBITED: 2,
      REQ_AUTHORISATION: 6,
      CONDITIONAL: 5,
      NO_RESTRICTION: 1,
    });
  });

  it('unpacks MultiPolygon into polygon rings', () => {
    expect(zones.every((z) => z.geometry.kind === 'polygon')).toBe(true);
    const z = zones[0];
    const [minLon, minLat, maxLon, maxLat] = z.bbox;
    const ring = (z.geometry as { rings: [number, number][][] }).rings[0];
    expect(ring.every(([lon]) => lon >= minLon && lon <= maxLon)).toBe(true);
    expect(ring.every(([, lat]) => lat >= minLat && lat <= maxLat)).toBe(true);
  });

  it('leaves every zone unbounded, because the IAA publishes no vertical limits', () => {
    expect(zones.every((z) => z.altitude.lower === 0 && z.altitude.upper === null)).toBe(true);
  });

  it('turns the coded conditions into something readable', () => {
    const model = zones.find((z) => z.id === 'IRL-U74')!;
    expect(model.conditions).toContain('Permitted in this zone: model aircraft.');
    const maci = zones.find((z) => z.id === 'IRL-U96')!;
    expect(maci.conditions).toContain('Exempt from this zone: maci member.');
  });

  it('states the applicability windows it cannot model, and warns', () => {
    const windowed = zones.find((z) => z.id === 'IRL-T41')!;
    expect(windowed.conditions.some((c) => c.startsWith('Applies on:'))).toBe(true);
    expect(windowed.applicability.permanent).toBe(true);
    expect(warnings.some((w) => w.includes('IRL-T41') && w.includes('applicability windows'))).toBe(
      true,
    );
  });

  it('carries the authority and its contact', () => {
    const withEmail = zones.filter((z) => z.authority.email);
    expect(withEmail.length).toBeGreaterThan(0);
    expect(withEmail[0].authority.name).toBeTruthy();
  });

  it('warns only about the windows it collapsed', () => {
    expect(warnings.every((w) => w.includes('applicability windows'))).toBe(true);
  });
});

describe('readCondition', () => {
  it('reads the permitted and exempt forms', () => {
    expect(readCondition('PERMITTED/MODEL AIRCRAFT=YES')).toBe(
      'Permitted in this zone: model aircraft.',
    );
    expect(readCondition('EXEMPT/MACI MEMBER=YES')).toBe('Exempt from this zone: maci member.');
  });

  it('keeps an unrecognised code verbatim rather than dropping it', () => {
    expect(readCondition('SOMETHING ELSE')).toBe('SOMETHING ELSE');
  });

  it('handles an absent code', () => {
    expect(readCondition(null)).toBeNull();
  });
});

describe('readWindows', () => {
  it('lists the distinct days', () => {
    expect(
      readWindows([
        { startDateTime: '2026-05-28T11:00:00+00:00', endDateTime: '2026-05-28T22:59:00+00:00' },
        { startDateTime: '2026-06-19T11:00:00+00:00', endDateTime: '2026-06-19T22:59:00+00:00' },
        { startDateTime: '2026-06-19T23:00:00+00:00', endDateTime: '2026-06-20T01:00:00+00:00' },
      ]),
    ).toBe('Applies on: 2026-05-28, 2026-06-19.');
  });

  it('says nothing when there are no windows', () => {
    expect(readWindows(null)).toBeNull();
    expect(readWindows([])).toBeNull();
  });
});
