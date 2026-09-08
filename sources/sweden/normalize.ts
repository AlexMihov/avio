import type { NormalizedZone, Restriction, ZoneGeometry } from '../../shared/zone';

const SOURCE_ID = 'sweden';

const ED318_RESTRICTIONS: Record<string, Restriction> = {
  PROHIBITED: 'PROHIBITED',
  REQ_AUTHORIZATION: 'REQ_AUTHORISATION',
  REQ_AUTHORISATION: 'REQ_AUTHORISATION',
  CONDITIONAL: 'CONDITIONAL',
  NO_RESTRICTION: 'NO_RESTRICTION',
};

/**
 * What each airspace layer means for someone holding a controller. Control, traffic and
 * restricted airspace all have to be cleared before a flight; a danger area is an activity
 * warning rather than a permission, so it stays conditional.
 */
const AIRSPACE_RULES: Record<string, { restriction: Restriction; reasons: string[] }> = {
  CTR: { restriction: 'REQ_AUTHORISATION', reasons: ['AIR_TRAFFIC'] },
  TIZ: { restriction: 'REQ_AUTHORISATION', reasons: ['AIR_TRAFFIC'] },
  ATZ: { restriction: 'REQ_AUTHORISATION', reasons: ['AIR_TRAFFIC'] },
  RSTA: { restriction: 'REQ_AUTHORISATION', reasons: ['OTHER'] },
  DNGA: { restriction: 'CONDITIONAL', reasons: ['OTHER'] },
};

const AIRSPACE_AUTHORITY = {
  name: 'Luftfartsverket (LFV)',
  nameTranslations: { sv: 'Luftfartsverket (LFV)', en: 'Swedish Air Navigation Services (LFV)' },
  siteUrl: 'https://daim.lfv.se/echarts/dronechart/',
};

const FEET_TO_M = 0.3048;
const EARTH_R = 6_371_008.8;

function circleBbox(center: [number, number], radiusM: number): [number, number, number, number] {
  const [lon, lat] = center;
  const dLat = (radiusM / EARTH_R) * (180 / Math.PI);
  const dLon = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

function ringsBbox(rings: [number, number][][]): [number, number, number, number] {
  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

interface LangText {
  text?: string;
  lang?: string;
}

/** ED-318 repeats every string per language; Sweden tags its own as `se-SE`, English `en-GB`. */
export function textIn(entries: LangText[] | undefined, prefix: string): string | null {
  const hit = (entries ?? []).find((e) => String(e.lang ?? '').startsWith(prefix));
  return hit?.text?.trim() || null;
}

/**
 * ED-318 writes the notice period as e.g. "P14DT00H00M". Rounded up, because a partial day of
 * notice is still a day the operator has to allow for.
 */
export function noticeDaysFrom(interval: string | undefined): number | undefined {
  if (!interval) return undefined;
  const m = interval.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return undefined;
  const [d, h, min] = m.slice(1).map((v) => (v === undefined ? 0 : Number(v)));
  const days = d + Math.ceil((h * 60 + min) / (24 * 60));
  return days > 0 ? days : undefined;
}

/**
 * AIP limits come as a number of feet, a flight level, "GND" for the ground, or "UNL" for no
 * ceiling at all. Anything else is a form we have not seen and must not guess at.
 */
export function limitMetres(limit: string | undefined): number | null | undefined {
  const value = String(limit ?? '')
    .trim()
    .toUpperCase();
  if (value === 'UNL') return null;
  if (value === 'GND') return 0;
  if (/^\d+$/.test(value)) return Math.round(Number(value) * FEET_TO_M);
  const fl = value.match(/^FL\s*(\d+)$/);
  if (fl) return Math.round(Number(fl[1]) * 100 * FEET_TO_M);
  return undefined;
}

/**
 * LFV draws an area on its drone chart when the floor is at or below 500 ft above sea level;
 * a higher floor is out of reach of anything flown under the open category. Two Swedish areas
 * sit at 400 ft rather than on the ground, so a plain "starts at GND" test would drop them.
 */
const MAX_FLOOR_M = Math.round(500 * FEET_TO_M);

/** LFV writes the Swedish remark, a blank line, then the same remark in English. */
export function splitRemark(comment: string | null | undefined): {
  source: string | null;
  english: string | null;
} {
  const text = (comment ?? '').trim();
  if (!text) return { source: null, english: null };
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return { source: text, english: null };
  return { source: parts.slice(0, -1).join('\n\n'), english: parts[parts.length - 1] };
}

/**
 * The AIP gives an area a designator and a location, and either one can be the more useful
 * name: "ES R104C" is located at "ES R104C KÄNSÖ". The location wins only when it is the
 * designator plus something more.
 *
 * A control zone split into parts names them "Sector West" and nothing else, which is no help
 * on a map — Arlanda's two halves are both called that — so an unqualified name is prefixed
 * with the aerodrome it belongs to.
 */
export function airspaceName(p: Record<string, unknown>): string {
  const designator = String(p['NAMEOFAREA'] ?? '').trim();
  const location = String(p['LOCATION'] ?? '').trim();
  const indicator = String(p['POSITIONINDICATOR'] ?? '').trim();
  const name = designator && location.startsWith(designator) ? location : designator || location;
  if (!name) return String(p['IDNR']);
  return /^[A-Z]{2}\s|CTR|TIZ|ATZ/.test(name) ? name : `${indicator} ${name}`.trim();
}

/**
 * Areas across the border are published in the Swedish AIP because they abut Swedish airspace,
 * but they are Denmark's or Norway's to publish, not Sweden's. Some carry a foreign aerodrome
 * indicator, others sit under the Swedish FIR code with a foreign designator.
 */
export function isSwedish(p: Record<string, unknown>): boolean {
  if (!String(p['POSITIONINDICATOR'] ?? '').startsWith('ES')) return false;
  const prefix = String(p['NAMEOFAREA'] ?? '').match(/^([A-Z]{2})\s/);
  return !prefix || prefix[1] === 'ES';
}

/**
 * The WFS carries no remark for a control, traffic information or traffic zone, so LFV's own
 * chart writes the standing rule for the layer instead — and that rule is more permissive than
 * "authorisation required" suggests: outside 5 km from the runways and below the stated height,
 * a small drone needs no permission at all. Reproduced from the chart in LFV's own wording,
 * Swedish and English, rather than paraphrased.
 */
const AIRSPACE_TEXT: Record<
  string,
  { se: (name: string, ceiling: number) => string; en: (name: string, ceiling: number) => string }
> = {
  CTR: {
    se: (name, ceiling) =>
      `Flygning i kontrollzon ${name} mindre än 5 km från flygplatsens banor får bara ske efter ` +
      `särskilt tillstånd av flygtrafikledningen. På höjder mindre än ${ceiling} m från marken ` +
      `och mer än 5 km från flygplatsens banor krävs inget särskilt tillstånd för drönare med ` +
      `vikt upp till 7 kg och hastighet under 90 km/h.`,
    en: (name, ceiling) =>
      `Flight in control zone ${name} less than 5 km from the airport runways may only take ` +
      `place after special permission from the air traffic control. At heights less than ` +
      `${ceiling} m from the ground and more than 5 km from the airport runways no special ` +
      `permit is required for drones weighing up to 7 kg and with a speed up to 90 km/h.`,
  },
  TIZ: {
    se: (name) =>
      `Flygning i trafikinformationszon ${name} får bara ske om dubbelriktad radioförbindelse ` +
      `eller motsvarande, med AFIS-enheten upprätthålls. På höjder mindre än 50 m från marken ` +
      `och mer än 5 km från flygplatsens banor krävs inte dubbelriktad radioförbindelse med ` +
      `AFIS för drönare med vikt upp till 7 kg och hastighet upp till 90 km/h.`,
    en: (name) =>
      `Flight in traffic information zone ${name} is only allowed if bidirectional radio ` +
      `connection or equivalent is established with the AFIS provider. At altitudes less than ` +
      `50 m from the ground, and more than 5 km from the airport runways, bi-directional radio ` +
      `connection or equivalent with AFIS is not required for drones weighing up to 7 kg and ` +
      `with a speed up to 90 km/h.`,
  },
  ATZ: {
    se: (name) => `Flygning i trafikzon ${name} får ske endast efter samråd med berörd flygplats.`,
    en: (name) =>
      `Flight in traffic zone ${name} may only take place after consultation with the airport concerned.`,
  },
};

/**
 * Control zones with heavy military traffic drop the no-permission height from 50 m to 10 m.
 * LFV keeps the list by name, with two position indicators excluded from it.
 */
const MILITARY_CTR = new Set([
  'SAAB CTR',
  'Sector a',
  'Sector b',
  'KARLSBORG CTR',
  'MALMEN CTR',
  'KALLAX CTR',
  'RONNEBY CTR',
  'SÅTENÄS CTR',
  'UPPSALA CTR',
  'VIDSEL CTR',
  'VISBY CTR',
  'HAGSHULT CTR',
]);
const MILITARY_CTR_EXCEPTIONS = new Set(['ES S', 'ESKS']);

function ctrCeiling(p: Record<string, unknown>): number {
  const designator = String(p['NAMEOFAREA'] ?? '');
  const indicator = String(p['POSITIONINDICATOR'] ?? '');
  return MILITARY_CTR.has(designator) && !MILITARY_CTR_EXCEPTIONS.has(indicator) ? 10 : 50;
}

export function airspaceText(
  layer: string,
  p: Record<string, unknown>,
): { source: string | null; english: string | null } {
  const standing = AIRSPACE_TEXT[layer];
  if (!standing) return splitRemark(p['COMMENT_2'] as string | null | undefined);
  const designator = String(p['NAMEOFAREA'] ?? '');
  const ceiling = ctrCeiling(p);
  const remark = splitRemark(p['COMMENT_2'] as string | null | undefined);
  const join = (standingText: string, extra: string | null) =>
    extra ? `${standingText}\n\n${extra}` : standingText;
  return {
    source: join(standing.se(designator, ceiling), remark.source),
    english: join(standing.en(designator, ceiling), remark.english),
  };
}

function polygonRings(geometry: {
  type?: string;
  coordinates?: unknown;
}): [number, number][][] | null {
  if (geometry.type === 'Polygon') return geometry.coordinates as [number, number][][];
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as [number, number][][][]).flat();
  }
  return null;
}

function designatedZones(doc: { features?: any[] }, warnings: string[]): NormalizedZone[] {
  const zones: NormalizedZone[] = [];
  for (const f of doc.features ?? []) {
    const p = f.properties ?? {};
    const id = `SWE-${p.identifier}`;

    const restriction = ED318_RESTRICTIONS[String(p.type ?? '').toUpperCase()];
    if (!restriction) {
      warnings.push(`${id}: unknown restriction "${p.type}"`);
      continue;
    }

    const g = f.geometry ?? {};
    const layer = g.layer ?? {};
    // Almost every zone is published in metres, but Transportstyrelsen states one of them in
    // feet, so the unit has to be read rather than assumed.
    const unit = String(layer.uom ?? 'm').toLowerCase();
    if (unit !== 'm' && unit !== 'ft') {
      warnings.push(`${id}: unknown vertical unit "${layer.uom}"`);
      continue;
    }
    const toMetres = (value: number) => (unit === 'ft' ? Math.round(value * FEET_TO_M) : value);
    if (layer.upper !== undefined && layer.upperReference !== layer.lowerReference) {
      warnings.push(
        `${id}: mixed vertical references (${layer.lowerReference}/${layer.upperReference})`,
      );
    }

    let geometry: ZoneGeometry;
    let bbox: [number, number, number, number];
    if (g.type === 'Point' && g.extent?.subType === 'Circle') {
      const center: [number, number] = [g.coordinates[0], g.coordinates[1]];
      geometry = { kind: 'circle', center, radiusM: g.extent.radius };
      bbox = circleBbox(center, g.extent.radius);
    } else {
      const rings = polygonRings(g);
      if (!rings) {
        warnings.push(`${id}: unsupported geometry type "${g.type}"`);
        continue;
      }
      geometry = { kind: 'polygon', rings };
      bbox = ringsBbox(rings);
    }

    // Every Swedish zone carries a validity window, but most leave the end open; those are
    // permanent until Transportstyrelsen says otherwise, not zones that expire today.
    const window = (p.limitedApplicability ?? [])[0] ?? {};
    const applicability =
      window.startDateTime && window.endDateTime
        ? ({ permanent: false, start: window.startDateTime, end: window.endDateTime } as const)
        : ({ permanent: true } as const);
    if ((window.schedule ?? []).length) {
      warnings.push(`${id}: weekly time window is published but not modelled`);
    }

    // A zone lists the operator to notify alongside the agency that grants permission. The
    // agency is the one a pilot has to reach, so it wins when both are present.
    const authorities = (p.zoneAuthority ?? []) as any[];
    const auth =
      authorities.find((a) => String(a.purpose).toUpperCase() === 'AUTHORIZATION') ??
      authorities[0] ??
      {};

    const english = textIn(p.message, 'en');
    zones.push({
      id,
      sourceId: SOURCE_ID,
      name: textIn(p.name, 'se') ?? textIn(p.name, 'en') ?? id,
      restriction,
      reasons: (p.reason ?? []).map((r: string) => String(r).toUpperCase()),
      altitude: {
        lower: toMetres(layer.lower ?? 0),
        upper: layer.upper === undefined || layer.upper === null ? null : toMetres(layer.upper),
        unit: 'm',
        reference: String(layer.upperReference ?? layer.lowerReference) === 'AMSL' ? 'AMSL' : 'AGL',
      },
      geometry,
      bbox,
      applicability,
      authority: {
        name: textIn(auth.name, 'en') ?? textIn(auth.name, 'se') ?? 'unknown',
        nameTranslations: {
          sv: textIn(auth.name, 'se') ?? '',
          en: textIn(auth.name, 'en') ?? '',
        },
        contactName: textIn(auth.contactName, 'se') ?? undefined,
        email: textIn(auth.email, 'se') ?? undefined,
        phone: textIn(auth.phone, 'se') ?? undefined,
        siteUrl: textIn(auth.siteURL, 'se') ?? undefined,
        noticeDays: noticeDaysFrom(auth.intervalBefore),
      },
      text: {
        source: textIn(p.message, 'se'),
        translations: english ? { en: english } : {},
      },
      // `restrictionConditions` is a bare enum — AUTHORIZED or NO_PHOTOGRAPH — and every zone
      // that carries one spells the same thing out in its own message. Showing the token as
      // well would only repeat the restriction back at the reader.
      conditions: [],
    });
  }
  return zones;
}

function airspaceZones(
  collections: Record<string, { features?: any[] }>,
  warnings: string[],
): NormalizedZone[] {
  const zones: NormalizedZone[] = [];
  let skippedAbove = 0;
  let skippedForeign = 0;

  for (const [layer, collection] of Object.entries(collections ?? {})) {
    const rule = AIRSPACE_RULES[layer];
    if (!rule) {
      warnings.push(`airspace layer "${layer}" has no restriction rule and was skipped`);
      continue;
    }

    for (const f of collection.features ?? []) {
      const p = f.properties ?? {};
      const id = `SWE-${layer}-${p.IDNR}`;

      if (!isSwedish(p)) {
        skippedForeign++;
        continue;
      }
      const lower = limitMetres(p.LOWER);
      if (lower === undefined || lower === null) {
        warnings.push(`${id}: unreadable floor "${p.LOWER}"`);
        continue;
      }
      if (lower > MAX_FLOOR_M) {
        skippedAbove++;
        continue;
      }

      const upper = limitMetres(p.UPPER);
      if (upper === undefined) {
        warnings.push(`${id}: unreadable ceiling "${p.UPPER}"`);
        continue;
      }

      const rings = polygonRings(f.geometry ?? {});
      if (!rings) {
        warnings.push(`${id}: unsupported geometry type "${f.geometry?.type}"`);
        continue;
      }

      const remark = airspaceText(layer, p);
      zones.push({
        id,
        sourceId: SOURCE_ID,
        name: airspaceName(p),
        restriction: rule.restriction,
        reasons: rule.reasons,
        altitude: { lower, upper, unit: 'm', reference: 'AMSL' },
        geometry: { kind: 'polygon', rings },
        bbox: ringsBbox(rings),
        applicability: { permanent: true },
        authority: AIRSPACE_AUTHORITY,
        text: {
          source: remark.source,
          translations: remark.english ? { en: remark.english } : {},
        },
        conditions: [],
      });
    }
  }

  if (skippedForeign) warnings.push(`${skippedForeign} airspace areas outside Sweden were skipped`);
  if (skippedAbove) {
    warnings.push(
      `${skippedAbove} airspace areas with a floor above 500 ft were skipped, as LFV's chart does`,
    );
  }
  if (zones.length) {
    // One note beats repeating it on every area: the AIP publishes these limits above sea
    // level, and all but two of them start at the ground.
    warnings.push(`${zones.length} airspace areas carry limits published above sea level`);
  }
  return zones;
}

export function normalize(raw: string): { zones: NormalizedZone[]; warnings: string[] } {
  const warnings: string[] = [];
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload?.ed318?.features)) {
    throw new Error('unexpected payload: no ed318.features array');
  }
  if (!payload?.airspace || !Object.keys(payload.airspace).length) {
    throw new Error('unexpected payload: no airspace collections');
  }

  return {
    zones: [
      ...designatedZones(payload.ed318, warnings),
      ...airspaceZones(payload.airspace, warnings),
    ],
    warnings,
  };
}
