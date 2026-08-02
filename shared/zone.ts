export type Restriction = 'PROHIBITED' | 'REQ_AUTHORISATION' | 'CONDITIONAL';

export type ZoneGeometry =
  | { kind: 'circle'; center: [number, number]; radiusM: number }
  | { kind: 'polygon'; rings: [number, number][][] };

export interface NormalizedZone {
  id: string;
  sourceId: string;
  name: string;
  restriction: Restriction;
  reasons: string[];
  /** `upper: null` is a zone the authority published without a ceiling. */
  altitude: { lower: number; upper: number | null; unit: 'm'; reference: 'AGL' | 'AMSL' };
  geometry: ZoneGeometry;
  /** minLon, minLat, maxLon, maxLat */
  bbox: [number, number, number, number];
  applicability: { permanent: true } | { permanent: false; start: string; end: string };
  authority: {
    name: string;
    /** The authority's own name in each locale it publishes, when it publishes more than one. */
    nameTranslations?: Record<string, string>;
    contactName?: string;
    email?: string;
    phone?: string;
    siteUrl?: string;
    noticeDays?: number;
  };
  text: { source: string | null; translations: Record<string, string> };
  conditions: string[];
  /** `conditions` per locale, where the authority publishes them in more than one. */
  conditionTranslations?: Record<string, string[]>;
}

export interface SourceMeta {
  sourceId: string;
  sourceUrl: string;
  /** ISO date of the authority's release */
  publishedAt: string;
  /** ISO datetime of our fetch */
  fetchedAt: string;
  zoneCount: number;
  /** sha256 of the raw payload */
  checksum: string;
  warnings: string[];
}

export const STRICTNESS: Record<Restriction, number> = {
  PROHIBITED: 3,
  REQ_AUTHORISATION: 2,
  CONDITIONAL: 1,
};
