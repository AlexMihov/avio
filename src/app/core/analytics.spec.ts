import { describe, it, expect } from 'vitest';
import { gridCell, isMeasurementId, pageLocation, queryEvent, readConsent } from './analytics';

describe('pageLocation', () => {
  it('drops the query, which is where the flight plan lives', () => {
    expect(pageLocation('https://avio.example/?at=51.83529,-8.56293&h=50&src=ireland')).toBe(
      'https://avio.example/',
    );
  });

  it('keeps the path so a self-hosted subdirectory still reports correctly', () => {
    expect(pageLocation('https://example.org/avio/?at=1,2')).toBe('https://example.org/avio/');
  });

  it('drops the hash as well', () => {
    expect(pageLocation('https://avio.example/#at=1,2')).toBe('https://avio.example/');
  });

  it('sends nothing rather than risk leaking an unparseable href', () => {
    expect(pageLocation('not a url')).toBe('');
  });
});

describe('readConsent', () => {
  it('reads the two decided states', () => {
    expect(readConsent('granted')).toBe('granted');
    expect(readConsent('denied')).toBe('denied');
  });

  it('treats anything else as undecided, so the banner shows again', () => {
    expect(readConsent(null)).toBe('unknown');
    expect(readConsent('')).toBe('unknown');
    expect(readConsent('yes')).toBe('unknown');
  });
});

describe('isMeasurementId', () => {
  it('accepts a GA4 id', () => {
    expect(isMeasurementId('G-ABC123')).toBe(true);
    expect(isMeasurementId(' G-XYZ98765 ')).toBe(true);
  });

  it('rejects an empty, absent or malformed id, so nothing loads by accident', () => {
    expect(isMeasurementId('')).toBe(false);
    expect(isMeasurementId(undefined)).toBe(false);
    expect(isMeasurementId('UA-12345-1')).toBe(false);
    expect(isMeasurementId('G-')).toBe(false);
  });
});

describe('queryEvent', () => {
  it('reports the country and language, and nothing else', () => {
    expect(queryEvent(['switzerland'], 'de', 2, [8.5492, 47.4647])).toEqual({
      sources: 'switzerland',
      locale: 'de',
      outcome: '2-3',
      area: '47.5,8.5',
    });
  });

  it('sorts the countries so one selection is one value', () => {
    expect(queryEvent(['switzerland', 'bulgaria'], 'en', 1, null).sources).toBe(
      queryEvent(['bulgaria', 'switzerland'], 'en', 1, null).sources,
    );
  });

  it('buckets the count rather than reporting it exactly', () => {
    expect(queryEvent([], 'en', 0, null).outcome).toBe('clear');
    expect(queryEvent([], 'en', 1, null).outcome).toBe('1');
    expect(queryEvent([], 'en', 3, null).outcome).toBe('2-3');
    expect(queryEvent([], 'en', 12, null).outcome).toBe('4+');
  });

  it('carries the height nowhere and the position only as a grid cell', () => {
    const event = queryEvent(['portugal'], 'pt', 2, [-9.1393, 38.7223]);
    expect(Object.keys(event).sort()).toEqual(['area', 'locale', 'outcome', 'sources']);
    expect(event.area).toBe('38.7,-9.1');
  });
});

describe('gridCell', () => {
  it('snaps to a tenth of a degree, so the exact point cannot be recovered', () => {
    expect(gridCell([8.54920, 47.46470])).toBe('47.5,8.5');
    expect(gridCell([8.51000, 47.44000])).toBe('47.4,8.5');
  });

  it('gives one cell for every point within it', () => {
    // Zurich airport and a field 4 km away report the same area.
    expect(gridCell([8.5492, 47.4647])).toBe(gridCell([8.5301, 47.4702]));
  });

  it('handles the southern and western hemispheres', () => {
    expect(gridCell([-9.1393, 38.7223])).toBe('38.7,-9.1');
    expect(gridCell([-43.2, -22.9])).toBe('-22.9,-43.2');
  });

  it('reports nothing when no point has been picked', () => {
    expect(gridCell(null)).toBe('none');
  });
});
