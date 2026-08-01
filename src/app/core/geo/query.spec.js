import { describe, it, expect } from 'vitest';
import { queryZones } from './query';
function zone(over = {}) {
    return {
        id: 'z',
        sourceId: 's',
        name: 'z',
        restriction: 'CONDITIONAL',
        reasons: [],
        altitude: { lower: 0, upper: 120, unit: 'm', reference: 'AGL' },
        geometry: { kind: 'circle', center: [23, 42], radiusM: 5000 },
        bbox: [22.9, 41.9, 23.1, 42.1],
        applicability: { permanent: true },
        authority: { name: 'a' },
        text: { source: null, translations: {} },
        conditions: [],
        ...over,
    };
}
describe('queryZones', () => {
    it('returns only zones containing the point', () => {
        const zones = [
            zone({ id: 'in' }),
            zone({
                id: 'far',
                geometry: { kind: 'circle', center: [10, 10], radiusM: 100 },
                bbox: [9.9, 9.9, 10.1, 10.1],
            }),
        ];
        expect(queryZones(zones, [23, 42], 50).map((m) => m.zone.id)).toEqual(['in']);
    });
    it('excludes zones whose altitude band starts above the flight height', () => {
        const high = zone({
            id: 'high',
            altitude: { lower: 50, upper: 120, unit: 'm', reference: 'AGL' },
        });
        expect(queryZones([high], [23, 42], 30)).toHaveLength(0);
        expect(queryZones([high], [23, 42], 50)).toHaveLength(1);
    });
    it('includes a zone at its exact upper limit but not above it', () => {
        expect(queryZones([zone()], [23, 42], 120)).toHaveLength(1);
        expect(queryZones([zone()], [23, 42], 121)).toHaveLength(0);
    });
    it('sorts strictest first, then by the lower ceiling', () => {
        const zones = [
            zone({ id: 'cond', restriction: 'CONDITIONAL' }),
            zone({ id: 'proh', restriction: 'PROHIBITED' }),
            zone({
                id: 'auth-high',
                restriction: 'REQ_AUTHORISATION',
                altitude: { lower: 0, upper: 150, unit: 'm', reference: 'AGL' },
            }),
            zone({ id: 'auth-low', restriction: 'REQ_AUTHORISATION' }),
        ];
        expect(queryZones(zones, [23, 42], 50).map((m) => m.zone.id)).toEqual([
            'proh',
            'auth-low',
            'auth-high',
            'cond',
        ]);
    });
    it('reports every overlapping zone separately', () => {
        const zones = [zone({ id: 'a' }), zone({ id: 'b', restriction: 'PROHIBITED' })];
        expect(queryZones(zones, [23, 42], 50)).toHaveLength(2);
    });
    it('ignores expired temporary zones and honours active ones', () => {
        const now = new Date('2026-08-01T12:00:00Z');
        const past = zone({
            id: 'past',
            applicability: { permanent: false, start: '2020-01-01T00:00:00Z', end: '2020-01-02T00:00:00Z' },
        });
        const live = zone({
            id: 'live',
            applicability: { permanent: false, start: '2026-07-01T00:00:00Z', end: '2026-09-01T00:00:00Z' },
        });
        expect(queryZones([past], [23, 42], 50, now)).toHaveLength(0);
        expect(queryZones([live], [23, 42], 50, now)).toHaveLength(1);
    });
    it('works on polygon zones', () => {
        const poly = zone({
            id: 'poly',
            geometry: {
                kind: 'polygon',
                rings: [
                    [
                        [23, 42],
                        [24, 42],
                        [24, 43],
                        [23, 43],
                        [23, 42],
                    ],
                ],
            },
            bbox: [23, 42, 24, 43],
        });
        expect(queryZones([poly], [23.5, 42.5], 50).map((m) => m.zone.id)).toEqual(['poly']);
        expect(queryZones([poly], [22.5, 42.5], 50)).toHaveLength(0);
    });
});
