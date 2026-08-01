import { describe, it, expect } from 'vitest';
import { haversineM, inBbox, pointInCircle, pointInPolygon } from './geometry';
describe('haversineM', () => {
    it('measures a known distance', () => {
        // Sofia airport to Sofia city centre, roughly 7.4 km
        const d = haversineM([23.4114, 42.6952], [23.3219, 42.6977]);
        expect(d).toBeGreaterThan(7000);
        expect(d).toBeLessThan(8000);
    });
    it('is zero for identical points', () => {
        expect(haversineM([23, 42], [23, 42])).toBe(0);
    });
});
describe('pointInCircle', () => {
    const c = { center: [23.0, 42.0], radiusM: 5000 };
    it('accepts the centre', () => {
        expect(pointInCircle([23.0, 42.0], c)).toBe(true);
    });
    it('accepts a point just inside', () => {
        expect(pointInCircle([23.0, 42.0 + 4900 / 111_320], c)).toBe(true);
    });
    it('rejects a point just outside', () => {
        expect(pointInCircle([23.0, 42.0 + 5100 / 111_320], c)).toBe(false);
    });
});
describe('pointInPolygon', () => {
    // An L-shape: the bbox corner near (1.5, 1.5) is outside the polygon itself.
    const rings = [
        [
            [0, 0],
            [2, 0],
            [2, 1],
            [1, 1],
            [1, 2],
            [0, 2],
            [0, 0],
        ],
    ];
    it('accepts an interior point', () => {
        expect(pointInPolygon([0.5, 0.5], rings)).toBe(true);
    });
    it('rejects a point inside the bbox but outside the shape', () => {
        expect(pointInPolygon([1.5, 1.5], rings)).toBe(false);
    });
    it('rejects a point outside the bbox', () => {
        expect(pointInPolygon([3, 3], rings)).toBe(false);
    });
    it('treats rings after the first as holes', () => {
        const withHole = [
            [
                [0, 0],
                [4, 0],
                [4, 4],
                [0, 4],
                [0, 0],
            ],
            [
                [1, 1],
                [3, 1],
                [3, 3],
                [1, 3],
                [1, 1],
            ],
        ];
        expect(pointInPolygon([2, 2], withHole)).toBe(false);
        expect(pointInPolygon([0.5, 0.5], withHole)).toBe(true);
    });
});
describe('inBbox', () => {
    it('is inclusive of the edges', () => {
        expect(inBbox([1, 1], [0, 0, 1, 1])).toBe(true);
        expect(inBbox([1.0001, 1], [0, 0, 1, 1])).toBe(false);
    });
});
