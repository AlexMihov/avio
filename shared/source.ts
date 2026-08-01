/** Everything the UI needs to know about a data source. Emitted to public/data/index.json. */
export interface SourceManifest {
  id: string;
  /** Display name per UI locale. */
  names: Record<string, string>;
  /** Locale of the authority's own zone texts. */
  sourceLocale: string;
  /** Human-facing page where the authority publishes the data. */
  officialUrl: string;
  attribution: string;
  disclaimer: Record<string, string>;
  defaultView: { center: [number, number]; zoom: number };
}
