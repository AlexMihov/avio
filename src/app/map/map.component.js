import { __decorate } from "tslib";
import { Component, effect, inject, input, output, viewChild, } from '@angular/core';
import * as L from 'leaflet';
import { ConfigService } from '../core/config.service';
const INK = {
    PROHIBITED: '#b31b4b',
    REQ_AUTHORISATION: '#1b6ca8',
    CONDITIONAL: '#b07d18',
};
/** Prohibited areas get the heaviest line; conditional ones a chart-style dashed edge. */
function baseStyle(restriction) {
    return {
        color: INK[restriction],
        weight: restriction === 'PROHIBITED' ? 1.6 : 1.1,
        opacity: 0.9,
        fillColor: INK[restriction],
        fillOpacity: 0.16,
        dashArray: restriction === 'CONDITIONAL' ? '5 3' : undefined,
    };
}
const HIGHLIGHT = { weight: 4, opacity: 1, fillOpacity: 0.38 };
let MapComponent = class MapComponent {
    config = inject(ConfigService);
    host = viewChild.required('host');
    zones = input([]);
    highlightedId = input(null);
    point = input(null);
    view = input({
        center: [42.7339, 25.4858],
        zoom: 7,
    });
    pointPicked = output();
    map;
    layers = new Map();
    zoneGroup;
    marker;
    constructor() {
        effect(() => {
            const zones = this.zones();
            if (this.map)
                this.drawZones(zones);
        });
        effect(() => {
            const id = this.highlightedId();
            if (this.map)
                this.applyHighlight(id);
        });
        effect(() => {
            const p = this.point();
            if (this.map)
                this.drawMarker(p);
        });
    }
    ngAfterViewInit() {
        const { map: mapConfig } = this.config.required;
        const view = this.view();
        this.map = L.map(this.host().nativeElement, {
            preferCanvas: true,
            center: view.center,
            zoom: view.zoom,
            zoomControl: true,
        });
        L.tileLayer(mapConfig.tileUrl, {
            attribution: mapConfig.attribution,
            maxZoom: mapConfig.maxZoom,
        }).addTo(this.map);
        this.zoneGroup = L.layerGroup().addTo(this.map);
        this.map.on('click', (e) => this.pointPicked.emit([e.latlng.lng, e.latlng.lat]));
        this.drawZones(this.zones());
        this.drawMarker(this.point());
    }
    ngOnDestroy() {
        this.map?.remove();
    }
    drawZones(zones) {
        this.zoneGroup?.clearLayers();
        this.layers.clear();
        for (const zone of zones) {
            const style = baseStyle(zone.restriction);
            const layer = zone.geometry.kind === 'circle'
                ? L.circle([zone.geometry.center[1], zone.geometry.center[0]], {
                    radius: zone.geometry.radiusM,
                    ...style,
                })
                : L.polygon(zone.geometry.rings.map((ring) => ring.map(([lon, lat]) => [lat, lon])), style);
            layer.on('click', (e) => {
                L.DomEvent.stop(e);
                this.pointPicked.emit([e.latlng.lng, e.latlng.lat]);
            });
            this.layers.set(zone.id, layer);
            layer.addTo(this.zoneGroup);
        }
    }
    applyHighlight(highlightedId) {
        for (const [id, layer] of this.layers) {
            const zone = this.zones().find((z) => z.id === id);
            if (!zone)
                continue;
            layer.setStyle(id === highlightedId
                ? { ...baseStyle(zone.restriction), ...HIGHLIGHT }
                : baseStyle(zone.restriction));
            if (id === highlightedId)
                layer.bringToFront();
        }
    }
    drawMarker(point) {
        if (!this.map)
            return;
        if (!point) {
            this.marker?.remove();
            this.marker = undefined;
            return;
        }
        const latlng = [point[1], point[0]];
        // A point from a shared link or geolocation can be off-screen; a map click never is.
        if (!this.map.getBounds().contains(latlng)) {
            this.map.setView(latlng, Math.max(this.map.getZoom(), 12));
        }
        if (this.marker) {
            this.marker.setLatLng(latlng);
        }
        else {
            this.marker = L.marker(latlng, {
                icon: L.divIcon({ className: 'dz-pin', iconSize: [20, 20] }),
                keyboard: false,
            }).addTo(this.map);
        }
    }
};
MapComponent = __decorate([
    Component({
        selector: 'dz-map',
        template: `<div class="canvas" #host role="application" aria-label="Zone map"></div>`,
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
], MapComponent);
export { MapComponent };
