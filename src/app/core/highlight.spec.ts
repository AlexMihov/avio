import { describe, it, expect } from 'vitest';
import { markUp, type Mark } from './highlight';

const kinds = (text: string) => markUp(text).map((m) => `${m.kind}:${m.text}`);
const marked = (text: string): Mark[] => markUp(text).filter((m) => m.kind !== 'plain');

describe('markUp', () => {
  it('leaves text with nothing operative in it alone', () => {
    expect(markUp('Air traffic')).toEqual([{ kind: 'plain', text: 'Air traffic' }]);
  });

  it('reassembles to the original text exactly', () => {
    const text = 'The operation of unmanned aircraft weighing more than 250 g is prohibited.';
    expect(markUp(text).map((m) => m.text).join('')).toBe(text);
  });

  it('marks the prohibition and both quantities in a swiss condition', () => {
    const text =
      'The operation of unmanned aircraft weighing more than 250 g is prohibited from an altitude of 120 m above ground.';
    expect(marked(text)).toEqual([
      { kind: 'measure', text: '250 g' },
      { kind: 'prohibition', text: 'prohibited' },
      { kind: 'measure', text: '120 m' },
    ]);
  });

  it('marks bulgarian prohibitions and metres', () => {
    expect(marked('Полети над 50м са забранени')).toEqual([
      { kind: 'measure', text: '50м' },
      { kind: 'prohibition', text: 'забранени' },
    ]);
  });

  it('marks german prohibitions', () => {
    expect(marked('Der Betrieb ist verboten')).toEqual([
      { kind: 'prohibition', text: 'verboten' },
    ]);
  });

  it('does not mark a unit letter that is really the start of a word', () => {
    expect(marked('within 5 minutes of the airfield')).toEqual([]);
    expect(marked('a 10 gigabyte file')).toEqual([]);
  });

  it('does not mark a prohibition term embedded in a longer word', () => {
    expect(marked('unprohibited')).toEqual([]);
  });

  it('handles decimals and spelled-out units', () => {
    expect(marked('2.5 kg and 1,5 kg and 120 metres')).toEqual([
      { kind: 'measure', text: '2.5 kg' },
      { kind: 'measure', text: '1,5 kg' },
      { kind: 'measure', text: '120 metres' },
    ]);
  });

  it('keeps plain runs between marks', () => {
    expect(kinds('over 250 g: prohibited')).toEqual([
      'plain:over ',
      'measure:250 g',
      'plain:: ',
      'prohibition:prohibited',
    ]);
  });
});
