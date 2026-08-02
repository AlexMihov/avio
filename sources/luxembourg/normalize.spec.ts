import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalize } from './normalize';

/** One complete release; at 87 KB the whole thing fits, so nothing is sampled away. */
const raw = readFileSync(
  new URL('./__fixtures__/lux_zones_20260802.json', import.meta.url),
  'utf8',
);

const { zones, warnings } = normalize(raw);

describe('luxembourg normalize', () => {
  it('returns every feature', () => {
    expect(zones).toHaveLength(47);
  });

  it('maps all three restriction levels', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    expect(counts).toEqual({ PROHIBITED: 11, REQ_AUTHORISATION: 20, CONDITIONAL: 16 });
  });

  it('keeps polygons with a containing bbox', () => {
    expect(zones.every((z) => z.geometry.kind === 'polygon')).toBe(true);
    const z = zones[0];
    const [minLon, minLat, maxLon, maxLat] = z.bbox;
    const ring = (z.geometry as { rings: [number, number][][] }).rings[0];
    expect(ring.every(([lon]) => lon >= minLon && lon <= maxLon)).toBe(true);
    expect(ring.every(([, lat]) => lat >= minLat && lat <= maxLat)).toBe(true);
  });

  it('keeps the published vertical bands', () => {
    const bands = zones.map((z) => `${z.altitude.lower}-${z.altitude.upper}`);
    expect(new Set(bands)).toEqual(new Set(['0-120', '50-120', '0-50']));
    expect(zones.every((z) => z.altitude.reference === 'AGL')).toBe(true);
  });

  it('treats every zone as time-bounded, because the DAC publishes no permanent ones', () => {
    expect(zones.every((z) => !z.applicability.permanent)).toBe(true);
    const windowed = zones.filter(
      (z) => !z.applicability.permanent && z.applicability.start && z.applicability.end,
    );
    expect(windowed).toHaveLength(47);
  });

  it('carries the responsible authority rather than only the regulator', () => {
    const names = new Set(zones.map((z) => z.authority.name));
    expect(names.size).toBe(9);
    expect(names).toContain('NATO');
    expect(names).toContain("Direction de l'Aviation Civile");
    expect(zones.find((z) => z.id === 'LUX-SPECI11')!.authority.name).toBe('NATO');
  });

  it('has no notice period to read, since the DAC publishes none', () => {
    expect(zones.every((z) => z.authority.noticeDays === undefined)).toBe(true);
  });

  it('keeps the authority message and records that there are no separate conditions', () => {
    expect(zones[0].text.source).toMatch(/g-o\.lu\/uas/);
    expect(zones.every((z) => z.conditions.length === 0)).toBe(true);
  });

  it('carries the POPULATION reason, which no other source uses', () => {
    expect(zones.filter((z) => z.reasons.includes('POPULATION'))).toHaveLength(2);
  });

  it('tolerates a leading byte order mark', () => {
    expect(normalize('﻿' + raw).zones).toHaveLength(47);
  });

  it('produces no warnings for the known-good fixture', () => {
    expect(warnings).toEqual([]);
  });
});
