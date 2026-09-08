/** Everything the UI needs to know about a data source. Emitted to public/data/index.json. */
export interface SourceManifest {
  id: string;
  /** Display name per UI locale. */
  names: Record<string, string>;
  /** Locale of the authority's own zone texts. */
  sourceLocale: string;
  /**
   * Locales the authority publishes itself. Text in one of these is the authority's wording,
   * not our translation, and must not be labelled unofficial. Defaults to `[sourceLocale]`.
   */
  officialLocales?: string[];
  /** Human-facing page where the authority publishes the data. */
  officialUrl: string;
  attribution: string;
  disclaimer: Record<string, string>;
  defaultView: { center: [number, number]; zoom: number };
}

/**
 * Thrown when the authority's file cannot be downloaded but the link on its page is still the
 * one we already mirror. Nothing has been published that we are missing, so the build keeps the
 * committed data and stays green; a link pointing at something new is a real failure.
 */
export class SourceUnreachable extends Error {
  constructor(
    readonly sourceUrl: string,
    message: string,
  ) {
    super(message);
  }
}
