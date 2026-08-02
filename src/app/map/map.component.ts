import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { ConfigService } from '../core/config.service';
import { I18nService } from '../core/i18n/i18n.service';
import type { NormalizedZone, Restriction } from '../../../shared/zone';
import type { LonLat } from '../core/geo/geometry';

const INK: Record<Restriction, string> = {
  PROHIBITED: '#b31b4b',
  REQ_AUTHORISATION: '#1b6ca8',
  CONDITIONAL: '#b07d18',
  NO_RESTRICTION: '#3f6a63',
};

/** Prohibited areas get the heaviest line; conditional ones a chart-style dashed edge. */
function baseStyle(restriction: Restriction): L.PathOptions {
  return {
    color: INK[restriction],
    weight: restriction === 'PROHIBITED' ? 1.6 : 1.1,
    opacity: 0.9,
    fillColor: INK[restriction],
    fillOpacity: 0.16,
    dashArray: restriction === 'CONDITIONAL' ? '5 3' : undefined,
  };
}

const HIGHLIGHT: L.PathOptions = { weight: 4, opacity: 1, fillOpacity: 0.38 };

@Component({
  selector: 'dz-map',
  template: `<div
    class="canvas"
    #host
    role="application"
    [attr.aria-label]="i18n.t('map.label')"
  ></div>`,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .canvas {
      height: 100%;
      background: var(--paper);
    }
    :host ::ng-deep .leaflet-container {
      font-family: var(--font-ui);
      background: #dfe4e6;
    }
    :host ::ng-deep .dz-pin {
      display: grid;
      place-items: center;
    }
    :host ::ng-deep .dz-pin::after {
      content: '';
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: var(--ink);
      border: 3px solid var(--paper-2);
      box-shadow: 0 0 0 1px var(--ink);
    }
  `,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly config = inject(ConfigService);
  protected readonly i18n = inject(I18nService);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  readonly zones = input<NormalizedZone[]>([]);
  readonly highlightedId = input<string | null>(null);
  readonly point = input<LonLat | null>(null);
  readonly view = input<{ center: [number, number]; zoom: number }>({
    center: [42.7339, 25.4858],
    zoom: 7,
  });

  readonly pointPicked = output<LonLat>();

  private map?: L.Map;
  private layers = new Map<string, L.Path>();
  private zoneGroup?: L.LayerGroup;
  private marker?: L.Marker;
  private tiles?: L.TileLayer;

  constructor() {
    // Only providers whose URL takes a {lang} get relaid; for the rest a language switch
    // would refetch every tile for an identical image.
    effect(() => {
      const locale = this.i18n.locale();
      if (this.map && this.config.required.map.tileUrl.includes('{lang}')) {
        this.addTiles(locale);
      }
    });
    effect(() => {
      const zones = this.zones();
      if (this.map) this.drawZones(zones);
    });
    effect(() => {
      const id = this.highlightedId();
      if (this.map) this.applyHighlight(id);
    });
    effect(() => {
      const p = this.point();
      if (this.map) this.drawMarker(p);
    });
  }

  ngAfterViewInit(): void {
    const view = this.view();

    this.map = L.map(this.host().nativeElement, {
      preferCanvas: true,
      center: view.center,
      zoom: view.zoom,
      zoomControl: true,
    });

    this.addTiles(this.i18n.locale());

    this.zoneGroup = L.layerGroup().addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) =>
      this.pointPicked.emit([e.latlng.lng, e.latlng.lat]),
    );

    this.drawZones(this.zones());
    this.drawMarker(this.point());
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  /**
   * `lang` is handed to Leaflet as a template variable, so a provider that localises its
   * labels only needs `{lang}` in `map.tileUrl` — no code change to add one.
   */
  private addTiles(lang: string): void {
    if (!this.map) return;
    const { map: mapConfig } = this.config.required;
    this.tiles?.remove();
    this.tiles = L.tileLayer(mapConfig.tileUrl, {
      attribution: mapConfig.attribution,
      maxZoom: mapConfig.maxZoom,
      lang,
    } as L.TileLayerOptions).addTo(this.map);
  }

  private drawZones(zones: NormalizedZone[]): void {
    this.zoneGroup?.clearLayers();
    this.layers.clear();

    for (const zone of zones) {
      const style = baseStyle(zone.restriction);
      const layer =
        zone.geometry.kind === 'circle'
          ? L.circle([zone.geometry.center[1], zone.geometry.center[0]], {
              radius: zone.geometry.radiusM,
              ...style,
            })
          : L.polygon(
              zone.geometry.rings.map((ring) =>
                ring.map(([lon, lat]) => [lat, lon] as L.LatLngTuple),
              ),
              style,
            );

      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stop(e);
        this.pointPicked.emit([e.latlng.lng, e.latlng.lat]);
      });

      this.layers.set(zone.id, layer);
      layer.addTo(this.zoneGroup!);
    }
  }

  private applyHighlight(highlightedId: string | null): void {
    for (const [id, layer] of this.layers) {
      const zone = this.zones().find((z) => z.id === id);
      if (!zone) continue;
      layer.setStyle(
        id === highlightedId
          ? { ...baseStyle(zone.restriction), ...HIGHLIGHT }
          : baseStyle(zone.restriction),
      );
      if (id === highlightedId) layer.bringToFront();
    }
  }

  private drawMarker(point: LonLat | null): void {
    if (!this.map) return;
    if (!point) {
      this.marker?.remove();
      this.marker = undefined;
      return;
    }
    const latlng: L.LatLngTuple = [point[1], point[0]];
    // A point from a shared link or geolocation can be off-screen; a map click never is.
    if (!this.map.getBounds().contains(latlng)) {
      this.map.setView(latlng, Math.max(this.map.getZoom(), 12));
    }
    if (this.marker) {
      this.marker.setLatLng(latlng);
    } else {
      this.marker = L.marker(latlng, {
        icon: L.divIcon({ className: 'dz-pin', iconSize: [20, 20] }),
        keyboard: false,
      }).addTo(this.map);
    }
  }
}
