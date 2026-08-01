import { Component, computed, inject, input, output } from '@angular/core';
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
        <h1>{{ i18n.t('app.title') }}</h1>
        <p>{{ i18n.t('app.subtitle') }}</p>
      </div>

      <div class="controls">
        @if (zones.manifests().length > 1) {
          <label class="field">
            <span class="compartment-label">{{ i18n.t('source.label') }}</span>
            <select
              [ngModel]="zones.activeId()"
              (ngModelChange)="sourceChanged.emit($event)"
              class="data"
            >
              @for (manifest of zones.manifests(); track manifest.id) {
                <option [value]="manifest.id">{{ i18n.pick(manifest.names) }}</option>
              }
            </select>
          </label>
        }

        <label class="field height">
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

        <label class="field coords">
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

        <div class="locales">
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

    <div class="ribbon">
      @if (zones.meta(); as meta) {
        <span class="data">{{
          i18n.t('source.published', { date: i18n.formatDate(meta.publishedAt) })
        }}</span>
        <a [href]="meta.sourceUrl" target="_blank" rel="noopener">{{
          i18n.t('source.official')
        }}</a>
        <span class="disclaimer">{{ i18n.t('disclaimer') }}</span>
      }
    </div>

    @if (staleDays(); as days) {
      <p class="stale" role="status">{{ i18n.t('source.stale', { days }) }}</p>
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
    }
    .input-row {
      display: flex;
      align-items: stretch;
      gap: 0.3rem;
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
    .ribbon {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 1rem;
      align-items: baseline;
      padding: 0.3rem 1.1rem;
      font-size: 0.72rem;
      color: var(--ink-2);
      border-bottom: 1px solid var(--rule);
    }
    .disclaimer {
      color: var(--ink-3);
    }
    .stale,
    .error {
      margin: 0;
      padding: 0.4rem 1.1rem;
      font-size: 0.78rem;
      border-bottom: 1px solid var(--rule);
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
      }
      .brand p {
        display: none;
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
  readonly sourceChanged = output<string>();

  protected typedCoords = '';

  /** Whole days since the mirror last refreshed, or null while it is still fresh. */
  protected readonly staleDays = computed(() => {
    const meta = this.zones.meta();
    if (!meta) return null;
    const days = Math.floor((Date.now() - new Date(meta.fetchedAt).getTime()) / 86_400_000);
    return days > this.config.required.staleAfterDays ? days : null;
  });

  protected submitCoords(): void {
    const match = this.typedCoords.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return;
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
    this.coordsSubmitted.emit([lon, lat]);
  }
}
