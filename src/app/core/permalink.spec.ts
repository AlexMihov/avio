import { describe, it, expect } from 'vitest';
import { buildPermalink, parsePermalink } from './permalink';

describe('parsePermalink', () => {
  it('reads a point as lat,lon and returns it as lon,lat', () => {
    expect(parsePermalink('?at=42.6977,23.3219').point).toEqual([23.3219, 42.6977]);
  });

  it('reads the height and source', () => {
    const state = parsePermalink('?at=42,23&h=50&src=bulgaria');
    expect(state.heightM).toBe(50);
    expect(state.source).toBe('bulgaria');
  });

  it('ignores coordinates that are out of range or malformed', () => {
    expect(parsePermalink('?at=95,23').point).toBeNull();
    expect(parsePermalink('?at=north').point).toBeNull();
    expect(parsePermalink('').point).toBeNull();
  });
});

describe('buildPermalink', () => {
  it('round-trips a query', () => {
    const url = buildPermalink({ point: [23.3219, 42.6977], heightM: 50, source: 'bulgaria' });
    expect(url).toBe('?at=42.69770,23.32190&h=50&src=bulgaria');
    const back = parsePermalink(url);
    expect(back.point![0]).toBeCloseTo(23.3219, 5);
    expect(back.heightM).toBe(50);
  });
});
