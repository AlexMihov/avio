import { describe, it, expect } from 'vitest';
import { buildPermalink, parsePermalink } from './permalink';

describe('parsePermalink', () => {
  it('reads a point as lat,lon and returns it as lon,lat', () => {
    expect(parsePermalink('?at=42.6977,23.3219').point).toEqual([23.3219, 42.6977]);
  });

  it('reads the height and source', () => {
    const state = parsePermalink('?at=42,23&h=50&src=bulgaria');
    expect(state.heightM).toBe(50);
    expect(state.sources).toEqual(['bulgaria']);
  });

  it('reads several comma-separated sources', () => {
    expect(parsePermalink('?src=bulgaria,switzerland').sources).toEqual([
      'bulgaria',
      'switzerland',
    ]);
  });

  it('reads the language', () => {
    expect(parsePermalink('?lang=pt').locale).toBe('pt');
  });

  it('returns no language when the parameter is absent', () => {
    expect(parsePermalink('?at=42,23').locale).toBeNull();
  });

  it('returns no sources when the parameter is absent or empty', () => {
    expect(parsePermalink('?at=42,23').sources).toEqual([]);
    expect(parsePermalink('?src=').sources).toEqual([]);
    expect(parsePermalink('?src=,,').sources).toEqual([]);
  });

  it('ignores coordinates that are out of range or malformed', () => {
    expect(parsePermalink('?at=95,23').point).toBeNull();
    expect(parsePermalink('?at=north').point).toBeNull();
    expect(parsePermalink('').point).toBeNull();
  });
});

describe('buildPermalink', () => {
  it('round-trips a query', () => {
    const url = buildPermalink({
      point: [23.3219, 42.6977],
      heightM: 50,
      sources: ['bulgaria'],
      locale: null,
    });
    expect(url).toBe('?at=42.69770,23.32190&h=50&src=bulgaria');
    const back = parsePermalink(url);
    expect(back.point![0]).toBeCloseTo(23.3219, 5);
    expect(back.heightM).toBe(50);
  });

  it('round-trips several sources', () => {
    const url = buildPermalink({
      point: [8.5492, 47.4647],
      heightM: 50,
      sources: ['switzerland', 'bulgaria'],
      locale: null,
    });
    expect(url).toBe('?at=47.46470,8.54920&h=50&src=switzerland,bulgaria');
    expect(parsePermalink(url).sources).toEqual(['switzerland', 'bulgaria']);
  });

  it('round-trips the language alongside the rest', () => {
    const url = buildPermalink({
      point: [-9.1393, 38.7223],
      heightM: 50,
      sources: ['portugal'],
      locale: 'pt',
    });
    expect(url).toBe('?at=38.72230,-9.13930&h=50&src=portugal&lang=pt');
    const back = parsePermalink(url);
    expect(back.locale).toBe('pt');
    expect(back.sources).toEqual(['portugal']);
  });
});
