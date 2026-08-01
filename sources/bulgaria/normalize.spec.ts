import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { normalize } from './normalize';

const rawJson = await (async () => {
  const zip = await JSZip.loadAsync(
    readFileSync(new URL('./__fixtures__/bgr_zones_30072026.zip', import.meta.url)),
  );
  const name = Object.keys(zip.files)[0];
  return zip.files[name].async('string');
})();

const { zones, warnings } = normalize(rawJson);
const aec = zones.find((z) => z.id === 'BGR-0000001')!;

describe('bulgaria normalize', () => {
  it('returns every feature', () => {
    expect(zones).toHaveLength(881);
  });

  it('maps restrictions without loss', () => {
    const counts = zones.reduce<Record<string, number>>(
      (a, z) => ((a[z.restriction] = (a[z.restriction] ?? 0) + 1), a),
      {},
    );
    expect(counts).toEqual({ PROHIBITED: 214, REQ_AUTHORISATION: 583, CONDITIONAL: 84 });
  });

  it('keeps circles as circles with exact radius', () => {
    expect(zones.filter((z) => z.geometry.kind === 'circle')).toHaveLength(421);
    expect(aec.geometry).toEqual({ kind: 'circle', center: [23.778889, 43.74], radiusM: 5000 });
  });

  it('keeps polygons as polygons', () => {
    expect(zones.filter((z) => z.geometry.kind === 'polygon')).toHaveLength(460);
  });

  it('computes a bbox that contains the circle centre', () => {
    const [minLon, minLat, maxLon, maxLat] = aec.bbox;
    expect(minLon).toBeLessThan(23.778889);
    expect(maxLon).toBeGreaterThan(23.778889);
    expect(minLat).toBeLessThan(43.74);
    expect(maxLat).toBeGreaterThan(43.74);
  });

  it('normalizes altitude limits to metres AGL', () => {
    expect(aec.altitude).toEqual({ lower: 0, upper: 120, unit: 'm', reference: 'AGL' });
  });

  it('carries authority contact details', () => {
    expect(aec.authority.email).toBe('uas@caa.bg');
    expect(aec.authority.name).toBe('ГД ГВА');
  });

  it('tolerates null messages', () => {
    expect(zones.filter((z) => z.text.source === null)).toHaveLength(122);
  });

  it('attaches curated english translations to every non-null message', () => {
    const withText = zones.filter((z) => z.text.source !== null);
    expect(withText.length).toBe(881 - 122);
    expect(withText.every((z) => !!z.text.translations['en'])).toBe(true);
  });

  it('extracts the notice period from the message when stated', () => {
    const fiveWorkingDays = zones.find((z) =>
      (z.text.source ?? '').includes('5 работни дни'),
    )!;
    expect(fiveWorkingDays.authority.noticeDays).toBe(5);
    expect(aec.authority.noticeDays).toBeUndefined();
  });

  it('marks non-permanent zones with their window', () => {
    const temporal = zones.filter((z) => !z.applicability.permanent);
    expect(temporal).toHaveLength(2);
    expect(temporal[0].applicability).toHaveProperty('start');
  });

  it('produces no warnings for the known-good fixture', () => {
    expect(warnings).toEqual([]);
  });
});
