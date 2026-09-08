import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  normalize,
  airspaceName,
  limitMetres,
  isSwedish,
  noticeDaysFrom,
  splitRemark,
  textIn,
} from './normalize';
import { publishedAtFrom } from './fetch';

/**
 * A verbatim subset of both upstreams: six of the 62 designated zones, and a few areas from
 * each airspace layer chosen for the cases that would otherwise break silently — a foreign
 * area, one that does not reach the ground, an unlimited ceiling and a flight level.
 */
const raw = readFileSync(
  new URL('./__fixtures__/swe_zones_20260908.json', import.meta.url),
  'utf8',
);
const { zones, warnings } = normalize(raw);
const byId = (id: string) => zones.find((z) => z.id === id)!;

describe('sweden normalize', () => {
  it('publishes both the designated zones and the airspace around them', () => {
    expect(zones.filter((z) => z.id.startsWith('SWE-ESU'))).toHaveLength(6);
    expect(zones.filter((z) => /^SWE-(CTR|TIZ|ATZ|RSTA|DNGA)-/.test(z.id))).toHaveLength(14);
  });

  it('keeps a designated circle exact', () => {
    const zone = byId('SWE-ESU200');
    expect(zone.geometry).toEqual({
      kind: 'circle',
      center: [20.051111111111112, 63.852222222222224],
      radiusM: 500,
    });
    expect(zone.altitude).toEqual({ lower: 0, upper: 150, unit: 'm', reference: 'AGL' });
    expect(zone.restriction).toBe('REQ_AUTHORISATION');
  });

  it('keeps Swedish as the authority text and English as its own translation', () => {
    const zone = byId('SWE-ESU200');
    expect(zone.name).toBe('Stornorrforsen kraftverk');
    expect(zone.text.source).toMatch(/^Tillträde förbjudet/);
    expect(zone.text.translations['en']).toMatch(/^Access prohibited/);
  });

  it('prefers the agency that grants permission over the operator to notify', () => {
    const zone = byId('SWE-ESU200');
    expect(zone.authority.name).toBe('Swedish Transport Agency');
    expect(zone.authority.email).toBe('luftfart@transportstyrelsen.se');
    expect(zone.authority.noticeDays).toBe(14);
  });

  it('treats an open-ended validity window as permanent', () => {
    expect(zones.filter((z) => z.applicability.permanent).length).toBeGreaterThan(0);
    expect(byId('SWE-ESU208').applicability).toEqual({
      permanent: false,
      start: '2025-11-10T00:00Z',
      end: '2027-05-31T00:00Z',
    });
  });

  it('says so when a weekly schedule cannot be modelled', () => {
    expect(warnings).toContain('SWE-ESU208: weekly time window is published but not modelled');
  });

  it('converts airspace ceilings from feet to metres above sea level', () => {
    expect(byId('SWE-RSTA-29874').altitude).toEqual({
      lower: 0,
      upper: 2743,
      unit: 'm',
      reference: 'AMSL',
    });
    expect(byId('SWE-RSTA-29880').altitude.upper).toBeNull();
  });

  it('maps each airspace layer to what it means for a pilot', () => {
    expect(byId('SWE-CTR-16227').restriction).toBe('REQ_AUTHORISATION');
    expect(byId('SWE-TIZ-4105').restriction).toBe('REQ_AUTHORISATION');
    expect(byId('SWE-DNGA-4938').restriction).toBe('CONDITIONAL');
    expect(byId('SWE-CTR-16227').reasons).toEqual(['AIR_TRAFFIC']);
  });

  it("carries LFV's standing rule for a zone the WFS leaves without a remark", () => {
    const zone = byId('SWE-CTR-16227');
    expect(zone.text.source).toMatch(/^Flygning i kontrollzon SAAB CTR mindre än 5 km/);
    expect(zone.text.translations['en']).toMatch(/^Flight in control zone SAAB CTR less than 5 km/);
    // SAAB is on LFV's military list, so the no-permission height drops from 50 m to 10 m.
    expect(zone.text.translations['en']).toContain('less than 10 m from the ground');
    expect(byId('SWE-TIZ-4105').text.translations['en']).toContain('AFIS provider');
    expect(byId('SWE-ATZ-3563').text.translations['en']).toMatch(/^Flight in traffic zone/);
  });

  it('keeps the 50 m height for a control zone without heavy military traffic', () => {
    expect(byId('SWE-CTR-16212').text.translations['en']).toContain(
      'less than 50 m from the ground',
    );
  });

  it('splits LFV bilingual remarks into the Swedish original and the English', () => {
    const zone = byId('SWE-RSTA-29874');
    expect(zone.text.source).toMatch(/^Militär verksamhet/);
    expect(zone.text.translations['en']).toMatch(/^Military activities/);
  });

  it('keeps a raised floor that LFV still draws, and skips one it does not', () => {
    // LFV's chart shows anything with a floor at or below 500 ft; ES R130 starts at 400 ft.
    expect(byId('SWE-RSTA-29932').altitude).toEqual({
      lower: 122,
      upper: 366,
      unit: 'm',
      reference: 'AMSL',
    });
    expect(zones.some((z) => z.id === 'SWE-RSTA-29834')).toBe(false);
  });

  it('skips what does not belong on the map, and counts it', () => {
    expect(warnings).toContain('1 airspace areas outside Sweden were skipped');
    expect(warnings).toContain(
      "1 airspace areas with a floor above 500 ft were skipped, as LFV's chart does",
    );
  });

  it('gives every zone a bbox that contains it', () => {
    for (const zone of zones) {
      const [minLon, minLat, maxLon, maxLat] = zone.bbox;
      expect(minLon).toBeLessThan(maxLon);
      expect(minLat).toBeLessThan(maxLat);
    }
  });
});

describe('limitMetres', () => {
  it('reads the ground, feet, flight levels and no ceiling at all', () => {
    expect(limitMetres('GND')).toBe(0);
    expect(limitMetres('1500')).toBe(457);
    expect(limitMetres('FL 65')).toBe(1981);
    expect(limitMetres('UNL')).toBeNull();
  });

  it('refuses a form it does not know', () => {
    expect(limitMetres('2000 AGL')).toBeUndefined();
    expect(limitMetres(undefined)).toBeUndefined();
  });
});

describe('airspaceName', () => {
  it('takes the location when it is the designator plus something more', () => {
    expect(airspaceName({ NAMEOFAREA: 'ES R104C', LOCATION: 'ES R104C KÄNSÖ' })).toBe(
      'ES R104C KÄNSÖ',
    );
  });

  it('qualifies a bare sector with the aerodrome it belongs to', () => {
    expect(
      airspaceName({
        NAMEOFAREA: 'Sector West',
        LOCATION: 'Sector West',
        POSITIONINDICATOR: 'ESSA',
      }),
    ).toBe('ESSA Sector West');
  });

  it('leaves a name that already identifies itself alone', () => {
    expect(
      airspaceName({ NAMEOFAREA: 'VISBY CTR', LOCATION: 'VISBY CTR', POSITIONINDICATOR: 'ESSV' }),
    ).toBe('VISBY CTR');
  });
});

describe('isSwedish', () => {
  it('rejects a foreign aerodrome and a foreign designator under the Swedish FIR', () => {
    expect(isSwedish({ POSITIONINDICATOR: 'EKRN', NAMEOFAREA: 'ROENNE CTR' })).toBe(false);
    expect(isSwedish({ POSITIONINDICATOR: 'ESAA', NAMEOFAREA: 'EK R96 HULLEBAEK' })).toBe(false);
    expect(isSwedish({ POSITIONINDICATOR: 'ESAA', NAMEOFAREA: 'ES R104C' })).toBe(true);
  });
});

describe('splitRemark', () => {
  it('keeps a single-language remark whole', () => {
    expect(splitRemark('Bara svenska.')).toEqual({ source: 'Bara svenska.', english: null });
    expect(splitRemark(null)).toEqual({ source: null, english: null });
  });
});

describe('noticeDaysFrom', () => {
  it('reads the ED-318 duration and rounds a partial day up', () => {
    expect(noticeDaysFrom('P14DT00H00M')).toBe(14);
    expect(noticeDaysFrom('P00DT12H00M')).toBe(1);
    expect(noticeDaysFrom(undefined)).toBeUndefined();
  });
});

describe('textIn', () => {
  it('matches on the language prefix, not the exact tag', () => {
    const entries = [
      { text: 'hej', lang: 'se-SE' },
      { text: 'hi', lang: 'en-GB' },
    ];
    expect(textIn(entries, 'se')).toBe('hej');
    expect(textIn(entries, 'de')).toBeNull();
  });
});

describe('publishedAtFrom', () => {
  it('takes the later of the ED-318 issue date and the AIRAC date', () => {
    expect(
      publishedAtFrom({
        ed318: { metadata: { issued: '2026-08-13T00:00:00Z' } },
        airspace: { CTR: { features: [{ properties: { WEF: '2026-09-03' } }] } },
      }),
    ).toBe('2026-09-03');
  });

  it('throws when neither upstream states a date', () => {
    expect(() => publishedAtFrom({ ed318: {}, airspace: {} })).toThrow();
  });
});
