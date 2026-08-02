import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { AltitudeLadderComponent } from './altitude-ladder.component';
import { ZoneStripComponent } from './zone-strip.component';
import { ZonesService } from '../core/zones.service';
import type { ZoneMatch } from '../core/geo/query';
import type { LonLat } from '../core/geo/geometry';

@Component({
  selector: 'dz-result-panel',
  imports: [AltitudeLadderComponent, ZoneStripComponent],
  template: `
    @if (point(); as p) {
      <section class="verdict" [attr.data-restriction]="headline()">
        <p class="where">
          <span class="coords data">{{ p[1].toFixed(5) }}, {{ p[0].toFixed(5) }}</span>
          @if (countries().length) {
            <!-- A point sits in one country the overwhelming majority of the time, so naming it
                 once here beats repeating it on every strip. -->
            <span class="country">
              @for (country of countries(); track country.id) {
                <span class="one">
                  <img
                    class="flag"
                    [src]="'flags/' + country.id + '.svg'"
                    [alt]="''"
                    width="18"
                    height="12"
                  />
                  <span class="data">{{ country.name }}</span>
                </span>
              }
            </span>
          }
        </p>
        <h2>{{ i18n.t('verdict.' + headline()) }}</h2>
        <p class="count">
          {{ countLabel() }} · {{ i18n.t('verdict.at', { height: heightM() }) }}
        </p>
      </section>

      @if (matches().length) {
        <dz-altitude-ladder [matches]="matches()" [heightM]="heightM()" />
        <div class="strips">
          @for (match of matches(); track match.zone.id; let i = $index) {
            <dz-zone-strip
              [zone]="match.zone"
              [rank]="i + 1"
              [showOrigin]="countries().length > 1"
              (hovered)="hovered.emit($event)"
            />
          }
        </div>
      } @else {
        <p class="clear-body">{{ i18n.t('verdict.clearBody', { height: heightM() }) }}</p>
      }
    } @else {
      <p class="hint">{{ i18n.t('query.hint') }}</p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.9rem;
      align-content: start;
    }
    .verdict {
      --edge: var(--clear);
      border-left: 5px solid var(--edge);
      padding-left: 0.7rem;
    }
    .verdict[data-restriction='PROHIBITED'] {
      --edge: var(--prohibited);
    }
    .verdict[data-restriction='REQ_AUTHORISATION'] {
      --edge: var(--authorisation);
    }
    .verdict[data-restriction='CONDITIONAL'] {
      --edge: var(--conditional);
    }
    h2 {
      margin: 0.1rem 0 0.15rem;
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--edge);
    }
    /* Coordinates left, country right, on one rule-width line above the verdict. */
    .where {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0;
    }
    .coords {
      font-size: 0.72rem;
      color: var(--ink-3);
      letter-spacing: 0.02em;
    }
    .country {
      flex: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-2);
    }
    .country .one {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
    /* A hairline keeps a white-edged flag (Bulgaria, Luxembourg) from bleeding into the paper. */
    .flag {
      display: block;
      width: 1.1rem;
      height: auto;
      box-shadow: 0 0 0 1px var(--rule);
    }
    .count {
      margin: 0;
      font-size: 0.8rem;
      color: var(--ink-2);
    }
    .strips {
      display: grid;
      gap: 0.5rem;
    }
    .clear-body,
    .hint {
      margin: 0;
      font-size: 0.85rem;
      color: var(--ink-2);
      max-width: 34ch;
    }
    .hint {
      color: var(--ink-3);
    }
  `,
})
export class ResultPanelComponent {
  protected readonly i18n = inject(I18nService);
  private readonly zones = inject(ZonesService);

  readonly matches = input<ZoneMatch[]>([]);
  readonly heightM = input(120);
  readonly point = input<LonLat | null>(null);
  readonly hovered = output<string | null>();

  /** The strictest applicable restriction; matches arrive already sorted strictest-first. */
  protected readonly headline = computed(() => this.matches()[0]?.zone.restriction ?? 'clear');

  /**
   * The countries the applicable zones come from, in strip order. Usually one; more only where
   * two authorities' zones genuinely overlap, which happens along a border.
   */
  protected readonly countries = computed(() => {
    const seen: { id: string; name: string }[] = [];
    for (const match of this.matches()) {
      const id = match.zone.sourceId;
      if (seen.some((entry) => entry.id === id)) continue;
      const manifest = this.zones.manifest(id);
      seen.push({ id, name: manifest ? this.i18n.pick(manifest.names) : id });
    }
    return seen;
  });

  protected readonly countLabel = computed(() => {
    const count = this.matches().length;
    return count === 1
      ? this.i18n.t('verdict.zonesApply', { count })
      : this.i18n.t('verdict.zonesApplyPlural', { count });
  });
}
