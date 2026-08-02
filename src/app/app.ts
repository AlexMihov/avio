import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ConfigService } from './core/config.service';
import { ZonesService } from './core/zones.service';
import { I18nService } from './core/i18n/i18n.service';
import { queryZones, isActiveAt } from './core/geo/query';
import type { LonLat } from './core/geo/geometry';
import { buildPermalink, parsePermalink } from './core/permalink';
import { MapComponent } from './map/map.component';
import { HeaderComponent } from './shell/header.component';
import { FooterComponent } from './shell/footer.component';
import { ConsentBannerComponent } from './shell/consent-banner.component';
import { AnalyticsService } from './core/analytics.service';
import { ResultPanelComponent } from './result/result-panel.component';

@Component({
  selector: 'app-root',
  imports: [
    MapComponent,
    HeaderComponent,
    ResultPanelComponent,
    FooterComponent,
    ConsentBannerComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly zonesService = inject(ZonesService);
  protected readonly i18n = inject(I18nService);
  private readonly config = inject(ConfigService);
  private readonly analytics = inject(AnalyticsService);

  private readonly initial = parsePermalink(location.search);

  protected readonly point = signal<LonLat | null>(this.initial.point);
  protected readonly heightM = signal(
    this.initial.heightM ?? this.config.required.defaultHeightM,
  );
  protected readonly highlightedId = signal<string | null>(null);
  protected readonly locating = signal(false);

  constructor() {
    // A query is the point being set or moved; height alone is a nudge, not a new question,
    // so it does not report. Reads matches() untracked to keep it out of the dependencies.
    effect(() => {
      const point = this.point();
      if (!point) return;
      untracked(() =>
        this.analytics.trackQuery(
          this.zonesService.activeIds(),
          this.i18n.locale(),
          this.matches().length,
          point,
        ),
      );
    });

    // The initial selection is resolved during bootstrap, before this component exists, so
    // the address bar is never rewritten with a source the visitor did not ask for.
    effect(() => {
      const url = buildPermalink({
        point: this.point(),
        heightM: this.heightM(),
        sources: this.zonesService.activeIds(),
        locale: this.i18n.locale(),
      });
      history.replaceState(null, '', url);
      // Must follow the rewrite: gtag reads the address bar for its own page_view.
      this.analytics.syncPage();
    });
  }

  protected readonly view = computed(() => {
    const manifest = this.zonesService.manifest(this.zonesService.activeIds()[0] ?? null);
    return manifest?.defaultView ?? { center: [42.7339, 25.4858] as [number, number], zoom: 7 };
  });

  /**
   * The map shows footprints, so it is not filtered by flight height — but it must not draw a
   * zone that has lapsed, or it contradicts the list beside it.
   */
  protected readonly mapZones = computed(() =>
    this.zonesService.zones().filter((zone) => isActiveAt(zone)),
  );

  protected readonly matches = computed(() => {
    const point = this.point();
    if (!point) return [];
    return queryZones(this.zonesService.zones(), point, this.heightM());
  });

  protected onPointPicked(point: LonLat): void {
    this.point.set(point);
  }

  /**
   * The picked point survives a country change: a zone from a country the point is not in
   * simply does not match, so there is nothing to reset.
   */
  protected onSourcesChanged(sourceIds: string[]): void {
    void this.zonesService.select(sourceIds);
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
