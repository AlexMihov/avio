import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../core/config.service';
import { I18nService, LOCALES, type Locale } from '../core/i18n/i18n.service';
import { ZonesService } from '../core/zones.service';

@Component({
  selector: 'dz-header',
  imports: [FormsModule],
  template: `
    <header>
      <div class="brand">
        <img src="logo.svg" alt="" width="34" height="34" />
        <div>
          <h1>{{ i18n.t('app.title') }}</h1>
          <p>{{ i18n.t('app.subtitle') }}</p>
        </div>
        <div class="bar">
          <button
            type="button"
            class="disclose"
            [attr.aria-expanded]="controlsOpen()"
            aria-controls="query-controls"
            (click)="controlsOpen.set(!controlsOpen())"
          >
            {{ i18n.t('query.controls') }}
            <span class="chev" aria-hidden="true">{{ controlsOpen() ? '\u2212' : '+' }}</span>
          </button>
        </div>
      </div>

      <div class="controls" id="query-controls" [class.open]="controlsOpen()">
        @if (zones.manifests().length > 1) {
          <fieldset class="field sources collapsible">
            <legend class="compartment-label">{{ i18n.t('source.label') }}</legend>
            <div class="checks">
              @for (manifest of zones.manifests(); track manifest.id) {
                <label class="check data" [class.on]="isActive(manifest.id)">
                  <input
                    type="checkbox"
                    [checked]="isActive(manifest.id)"
                    [disabled]="isLastActive(manifest.id)"
                    (change)="toggle(manifest.id)"
                  />
                  {{ i18n.pick(manifest.names) }}
                </label>
              }
            </div>
          </fieldset>
        }

        <label class="field height collapsible">
          <span class="compartment-label">{{ i18n.t('query.height') }}</span>
          <span class="input-row">
            <input
              type="number"
              class="data"
              min="0"
              max="3500"
              step="10"
              [ngModel]="heightM()"
              (ngModelChange)="heightChanged.emit(+$event || 0)"
            />
            <span class="unit data">m AGL</span>
          </span>
        </label>

        <label class="field coords collapsible">
          <span class="compartment-label">{{ i18n.t('query.coords') }}</span>
          <span class="input-row">
            <input
              type="text"
              class="data"
              inputmode="decimal"
              [placeholder]="i18n.t('query.coordsPlaceholder')"
              [(ngModel)]="typedCoords"
              (keydown.enter)="submitCoords()"
            />
            <button type="button" (click)="submitCoords()">{{ i18n.t('query.go') }}</button>
          </span>
        </label>

        <button type="button" class="locate" (click)="locateRequested.emit()">
          {{ locating() ? i18n.t('query.locating') : i18n.t('query.locate') }}
        </button>

        <div class="locales collapsible">
          @for (locale of locales; track locale) {
            <button
              type="button"
              class="locale"
              [class.active]="i18n.locale() === locale"
              [attr.aria-pressed]="i18n.locale() === locale"
              (click)="i18n.setLocale(locale)"
            >
              {{ locale.toUpperCase() }}
            </button>
          }
        </div>
      </div>
    </header>

    @for (entry of stale(); track entry.id) {
      <p class="stale" role="status">
        {{ entry.name }} — {{ i18n.t('source.stale', { days: entry.days }) }}
      </p>
    }
    @if (zones.loading()) {
      <p class="loading" role="status">{{ i18n.t('source.loading') }}</p>
    }
    @if (zones.error(); as message) {
      <p class="error" role="alert">{{ i18n.t('source.error', { message }) }}</p>
    }
  `,
  styles: `
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem 1.5rem;
      padding: 0.75rem 1.1rem 0.7rem;
      border-bottom: 1px solid var(--rule);
      background: var(--paper-2);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    /* Only ever shown on a phone, where the header has to collapse to one row. */
    .bar {
      display: none;
      gap: 0.4rem;
      margin-left: auto;
    }
    .disclose {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .chev {
      font-family: var(--font-data);
    }
    h1 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      text-transform: uppercase;
    }
    .brand p {
      margin: 0;
      font-size: 0.74rem;
      color: var(--ink-3);
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }
    .field {
      display: grid;
      gap: 0.15rem;
      min-width: 0;
    }
    fieldset.sources {
      border: 0;
      margin: 0;
      padding: 0;
    }
    fieldset.sources legend {
      padding: 0;
    }
    .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.22rem 0.45rem;
      border: 1px solid var(--rule);
      background: var(--paper);
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
    }
    .check.on {
      border-color: var(--ink);
      background: #fff;
    }
    /* The only selected source cannot be turned off, so it reads as fixed rather than broken. */
    .check:has(input:disabled) {
      cursor: default;
      opacity: 0.75;
    }
    .check input {
      margin: 0;
    }
    .input-row {
      display: flex;
      align-items: stretch;
      gap: 0.3rem;
      min-width: 0;
    }
    input,
    select {
      font-family: var(--font-data);
      font-size: 0.85rem;
      padding: 0.25rem 0.4rem;
      border: 1px solid var(--rule);
      background: #fff;
      color: var(--ink);
    }
    input[type='number'] {
      width: 4.5rem;
    }
    .coords input {
      width: 11rem;
    }
    .unit {
      align-self: center;
      font-size: 0.72rem;
      color: var(--ink-3);
    }
    button {
      border: 1px solid var(--ink);
      background: var(--ink);
      color: var(--paper-2);
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.28rem 0.6rem;
      cursor: pointer;
    }
    button:hover {
      background: var(--ink-2);
    }
    .locales {
      display: flex;
    }
    .locale {
      background: transparent;
      color: var(--ink-2);
      border-color: var(--rule);
      font-family: var(--font-data);
    }
    .locale + .locale {
      border-left: none;
    }
    .locale.active {
      background: var(--ink);
      color: var(--paper-2);
      border-color: var(--ink);
    }
    .stale,
    .error,
    .loading {
      margin: 0;
      padding: 0.4rem 1.1rem;
      font-size: 0.78rem;
      border-bottom: 1px solid var(--rule);
    }
    .loading {
      background: var(--paper-2);
      color: var(--ink-2);
    }
    .stale {
      background: #fbf1dc;
      color: #6b4b06;
    }
    .error {
      background: #fbe4ea;
      color: var(--prohibited);
    }
    @media (max-width: 720px) {
      header {
        padding: 0.6rem 0.8rem;
        gap: 0.6rem;
      }
      .brand {
        width: 100%;
      }
      .brand p {
        display: none;
      }
      .bar {
        display: flex;
      }
      .controls {
        width: 100%;
        gap: 0.5rem 0.6rem;
      }
      /* Collapsed by default: the query inputs were costing half the screen and the results
         could not be reached at all. Locating stays one tap away. */
      .collapsible {
        display: none;
      }
      .controls.open .field {
        display: grid;
      }
      .controls.open .locales {
        display: flex;
      }
      .locate {
        flex: 1;
      }
      .field.coords {
        flex: 1 1 100%;
      }
      .coords input {
        flex: 1;
        width: auto;
        min-width: 0;
      }
    }
  `,
})
export class HeaderComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly zones = inject(ZonesService);
  private readonly config = inject(ConfigService);
  protected readonly locales = LOCALES as readonly Locale[];

  readonly heightM = input(120);
  readonly locating = input(false);

  readonly heightChanged = output<number>();
  readonly coordsSubmitted = output<[number, number]>();
  readonly locateRequested = output<void>();
  readonly sourcesChanged = output<string[]>();

  protected typedCoords = '';

  /** Phone only; on wider screens the controls are always laid out and this is ignored. */
  protected readonly controlsOpen = signal(false);

  /** Publication line per selected source, in the order they were selected. */
  protected readonly published = computed(() => {
    const metas = this.zones.metas();
    return this.zones
      .activeIds()
      .filter((id) => metas[id])
      .map((id) => ({
        id,
        name: this.sourceName(id),
        publishedAt: metas[id].publishedAt,
        sourceUrl: metas[id].sourceUrl,
      }));
  });

  /** Only the sources whose mirror has gone past the configured freshness window. */
  protected readonly stale = computed(() => {
    const metas = this.zones.metas();
    const limit = this.config.required.staleAfterDays;
    return this.zones
      .activeIds()
      .filter((id) => metas[id])
      .map((id) => ({
        id,
        name: this.sourceName(id),
        days: Math.floor((Date.now() - new Date(metas[id].fetchedAt).getTime()) / 86_400_000),
      }))
      .filter((entry) => entry.days > limit);
  });

  protected isActive(id: string): boolean {
    return this.zones.activeIds().includes(id);
  }

  /** The last remaining source cannot be switched off; an empty map answers nothing. */
  protected isLastActive(id: string): boolean {
    const active = this.zones.activeIds();
    return active.length === 1 && active[0] === id;
  }

  protected toggle(id: string): void {
    const active = this.zones.activeIds();
    const next = active.includes(id)
      ? active.filter((other) => other !== id)
      : // Keep the configured order rather than click order, so the list reads consistently.
        this.zones
          .manifests()
          .map((m) => m.id)
          .filter((candidate) => candidate === id || active.includes(candidate));
    if (next.length) this.sourcesChanged.emit(next);
  }

  private sourceName(id: string): string {
    const manifest = this.zones.manifest(id);
    return manifest ? this.i18n.pick(manifest.names) : id;
  }

  protected submitCoords(): void {
    const match = this.typedCoords.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return;
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    this.coordsSubmitted.emit([lon, lat]);
  }
}
