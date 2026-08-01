import { Component, computed, effect, inject, signal } from '@angular/core';
import { ConfigService } from './core/config.service';
import { ZonesService } from './core/zones.service';
import { I18nService } from './core/i18n/i18n.service';
import { queryZones } from './core/geo/query';
import type { LonLat } from './core/geo/geometry';
import { buildPermalink, parsePermalink } from './core/permalink';
import { MapComponent } from './map/map.component';
import { HeaderComponent } from './shell/header.component';
import { ResultPanelComponent } from './result/result-panel.component';

@Component({
  selector: 'app-root',
  imports: [MapComponent, HeaderComponent, ResultPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly zonesService = inject(ZonesService);
  protected readonly i18n = inject(I18nService);
  private readonly config = inject(ConfigService);

  private readonly initial = parsePermalink(location.search);

  protected readonly point = signal<LonLat | null>(this.initial.point);
  protected readonly heightM = signal(
    this.initial.heightM ?? this.config.required.defaultHeightM,
  );
  protected readonly highlightedId = signal<string | null>(null);
  protected readonly locating = signal(false);

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

  protected readonly view = computed(() => {
    const manifest = this.zonesService.manifest(this.zonesService.activeId());
    return manifest?.defaultView ?? { center: [42.7339, 25.4858] as [number, number], zoom: 7 };
  });

  protected readonly matches = computed(() => {
    const point = this.point();
    if (!point) return [];
    return queryZones(this.zonesService.zones(), point, this.heightM());
  });

  protected onPointPicked(point: LonLat): void {
    this.point.set(point);
  }

  protected onSourceChanged(sourceId: string): void {
    this.point.set(null);
    void this.zonesService.select(sourceId);
  }

  protected locate(): void {
    if (!navigator.geolocation) return;
    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.point.set([pos.coords.longitude, pos.coords.latitude]);
        this.locating.set(false);
      },
      () => this.locating.set(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }
}
