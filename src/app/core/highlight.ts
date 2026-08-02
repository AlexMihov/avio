export type MarkKind = 'plain' | 'prohibition' | 'measure';

export interface Mark {
  kind: MarkKind;
  text: string;
}

/**
 * Authority text buries the operative facts in a sentence: whether the zone is an outright
 * prohibition, and the weight and height it turns on. The terms are matched in every language
 * a source might publish in, because this runs over the authority's own words as well as our
 * translations, and the two are rarely the same language.
 */
const PROHIBITION = String.raw`(?<![\p{L}])(?:prohibit|forbidden|verbot|untersagt|interdit|vietat|divieto|proibid|apagorev|απαγορ|keelat|забранен|забрана)\p{L}*`;

const UNIT = String.raw`metres|meters|Metern|Meter|Gramm|grams|gram|kg|km|ft|g|m|кг|км|г|м`;
const MEASURE = String.raw`\d+(?:[.,]\d+)?\s?(?:${UNIT})(?!\p{L})`;

const PATTERN = new RegExp(
  `(?<prohibition>${PROHIBITION})|(?<measure>${MEASURE})`,
  'giu',
);

/** Splits `text` into runs, tagging the ones worth pulling out of the sentence. */
export function markUp(text: string): Mark[] {
  const marks: Mark[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PATTERN)) {
    const start = match.index;
    if (start > cursor) marks.push({ kind: 'plain', text: text.slice(cursor, start) });
    marks.push({
      kind: match.groups?.['prohibition'] ? 'prohibition' : 'measure',
      text: match[0],
    });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) marks.push({ kind: 'plain', text: text.slice(cursor) });
  return marks;
}
