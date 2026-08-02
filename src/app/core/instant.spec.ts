import { describe, it, expect } from 'vitest';
import { formatAtOffset, offsetLabel, offsetMinutesOf } from './instant';

const CLOCK: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

describe('offsetMinutesOf', () => {
  it('reads Z as UTC', () => {
    expect(offsetMinutesOf('2026-04-30T23:59:59.000000Z')).toBe(0);
  });

  it('reads the offsets Luxembourg and Switzerland publish', () => {
    expect(offsetMinutesOf('2026-08-02T10:10:00+02:00')).toBe(120);
    expect(offsetMinutesOf('2020-12-29T01:00:00+01:00')).toBe(60);
  });

  it('reads western and half-hour offsets', () => {
    expect(offsetMinutesOf('2026-01-01T00:00:00-03:30')).toBe(-210);
    expect(offsetMinutesOf('2026-01-01T00:00:00+0530')).toBe(330);
  });

  it('returns null when no offset is declared', () => {
    expect(offsetMinutesOf('2026-08-02T10:10:00')).toBeNull();
  });
});

describe('offsetLabel', () => {
  it('names whole-hour offsets compactly', () => {
    expect(offsetLabel(0)).toBe('UTC');
    expect(offsetLabel(120)).toBe('UTC+2');
    expect(offsetLabel(-180)).toBe('UTC-3');
  });

  it('keeps the minutes on a half-hour offset', () => {
    expect(offsetLabel(330)).toBe('UTC+5:30');
    expect(offsetLabel(-210)).toBe('UTC-3:30');
  });

  it('says nothing when there is no offset to name', () => {
    expect(offsetLabel(null)).toBe('');
  });
});

describe('formatAtOffset', () => {
  it("keeps the authority's wall clock rather than the reader's", () => {
    // Luxembourg's airport window closes at 21:44 local, and must read 21:44 anywhere.
    expect(formatAtOffset('2026-08-02T21:44:00+02:00', 'en', CLOCK)).toBe('Aug 2, 2026, 21:44');
  });

  it('does not roll a UTC end date into the next day', () => {
    // Bulgaria publishes 23:59:59Z; in Zürich toLocaleString would say 1 May, 01:59.
    expect(formatAtOffset('2026-04-30T23:59:59.000000Z', 'en', CLOCK)).toBe(
      'Apr 30, 2026, 23:59',
    );
  });

  it('honours a winter offset on the same source', () => {
    expect(formatAtOffset('2020-12-29T01:00:00+01:00', 'en', CLOCK)).toBe('Dec 29, 2020, 01:00');
  });

  it('formats in the requested locale', () => {
    expect(formatAtOffset('2026-08-02T21:44:00+02:00', 'de', CLOCK)).toBe('2. Aug. 2026, 21:44');
  });

  it('returns the input unchanged when it cannot be parsed', () => {
    expect(formatAtOffset('whenever', 'en', CLOCK)).toBe('whenever');
  });
});
