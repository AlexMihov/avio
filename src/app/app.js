import { __decorate } from "tslib";
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ConfigService } from './core/config.service';
import { ZonesService } from './core/zones.service';
import { I18nService } from './core/i18n/i18n.service';
import { queryZones } from './core/geo/query';
import { buildPermalink, parsePermalink } from './core/permalink';
import { MapComponent } from './map/map.component';
import { HeaderComponent } from './shell/header.component';
import { ResultPanelComponent } from './result/result-panel.component';
let App = class App {
    zonesService = inject(ZonesService);
    i18n = inject(I18nService);
    config = inject(ConfigService);
    initial = parsePermalink(location.search);
    point = signal(this.initial.point);
    heightM = signal(this.initial.heightM ?? this.config.required.defaultHeightM);
    highlightedId = signal(null);
    locating = signal(false);
    constructor() {
        if (this.initial.source && this.config.required.enabledSources.includes(this.initial.source)) {
            void this.zonesService.select(this.initial.source);
        }
        // Keep the address bar in step so the current query is always shareable.
        effect(() => {
            const url = buildPermalink({
                point: this.point(),
                heightM: this.heightM(),
                source: this.zonesService.activeId(),
            });
            history.replaceState(null, '', url);
        });
    }
    view = computed(() => {
        const manifest = this.zonesService.manifest(this.zonesService.activeId());
        return manifest?.defaultView ?? { center: [42.7339, 25.4858], zoom: 7 };
    });
    matches = computed(() => {
        const point = this.point();
        if (!point)
            return [];
        return queryZones(this.zonesService.zones(), point, this.heightM());
    });
    onPointPicked(point) {
        this.point.set(point);
    }
    onSourceChanged(sourceId) {
        this.point.set(null);
        void this.zonesService.select(sourceId);
    }
    locate() {
        if (!navigator.geolocation)
            return;
        this.locating.set(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            this.point.set([pos.coords.longitude, pos.coords.latitude]);
            this.locating.set(false);
        }, () => this.locating.set(false), { enableHighAccuracy: true, timeout: 10_000 });
    }
};
App = __decorate([
    Component({
        selector: 'app-root',
        imports: [MapComponent, HeaderComponent, ResultPanelComponent],
        templateUrl: './app.html',
        styleUrl: './app.css',
    })
], App);
export { App };
