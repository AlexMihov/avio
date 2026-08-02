import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { MarkedTextComponent } from './marked-text.component';
import { ZonesService } from '../core/zones.service';
import type { NormalizedZone } from '../../../shared/zone';

/**
 * One zone rendered as an ATC-style flight progress strip: fixed compartments, monospace
 * values, colour-coded edge. Overlapping zones stack as separate strips and are never merged.
 */
@Component({
  selector: 'dz-zone-strip',
  imports: [MarkedTextComponent],
  template: `
    <article
      class="strip"
      [attr.data-restriction]="zone().restriction"
      (mouseenter)="hovered.emit(zone().id)"
      (mouseleave)="hovered.emit(null)"
      (focusin)="hovered.emit(zone().id)"
      (focusout)="hovered.emit(null)"
      tabindex="0"
    >
      <header>
        <span class="rank data" aria-hidden="true">{{ rank() }}</span>
        <h3 class="data">{{ zone().name }}</h3>
        @if (sourceName(); as country) {
          <span class="origin data">{{ country }}</span>
        }
      </header>

      <p class="status">{{ i18n.t('verdict.' + zone().restriction) }}</p>

      <div class="compartments">
        <div class="compartment limits">
          <span class="compartment-label">{{ i18n.t('strip.limits') }}</span>
          <div class="stack data">
            <span class="upper">{{
              zone().altitude.upper ?? i18n.t('strip.noCeiling')
            }}</span>
            <span class="rule"></span>
            <span class="lower">{{
              zone().altitude.lower === 0 ? i18n.t('strip.ground') : zone().altitude.lower
            }}</span>
          </div>
          <span class="unit compartment-label">m {{ zone().altitude.reference }}</span>
        </div>

        <div class="compartment">
          <span class="compartment-label">{{ i18n.t('strip.reasons') }}</span>
          <p>{{ reasons() }}</p>

          @if (zone().authority.noticeDays) {
            <span class="compartment-label">{{ i18n.t('strip.notice') }}</span>
            <p class="data">
              {{ i18n.t('strip.noticeDays', { days: zone().authority.noticeDays! }) }}
            </p>
          }
        </div>
      </div>

      @if (temporary(); as window) {
        <p class="temporary data">
          {{ i18n.t('strip.until', { when: i18n.formatInstant(window.end) }) }}
        </p>
      } @else {
        <!-- Saying so beats saying nothing: an absent line reads as missing data. -->
        <p class="no-expiry">{{ i18n.t('strip.noExpiry') }}</p>
      }

      @if (zone().text.source; as source) {
        @if (translation(); as translated) {
          @if (!multilingualSource()) {
            <span class="compartment-label">{{ i18n.t('strip.translation') }}</span>
          }
          <p class="translation"><dz-marked-text [text]="translated" /></p>
        }
        <!-- With no other text standing in for it, the official text is the only text there
             is, so it should not be behind a disclosure. -->
        <details [open]="!translation()">
          <summary class="compartment-label">{{ officialTextLabel() }}</summary>
          <p class="official"><dz-marked-text [text]="source" /></p>
        </details>
      } @else {
        <p class="muted">{{ i18n.t('strip.noText') }}</p>
      }

      @if (conditions().length) {
        <span class="compartment-label">{{ i18n.t('strip.conditions') }}</span>
        <ul>
          @for (condition of conditions(); track $index) {
            <li><dz-marked-text [text]="condition" /></li>
          }
        </ul>
      }

      <footer>
        <span class="compartment-label">{{ i18n.t('strip.authority') }}</span>
        <p class="data">
          {{ authorityName() }}
          @if (contactName(); as contact) {
            · {{ contact }}
          }
        </p>
        <p class="contacts data">
          @if (zone().authority.email) {
            <a [href]="'mailto:' + zone().authority.email">{{ zone().authority.email }}</a>
          }
          @if (zone().authority.phone) {
            <a [href]="'tel:' + zone().authority.phone!.replace(' ', '')">{{
              zone().authority.phone
            }}</a>
          }
        </p>
      </footer>
    </article>
  `,
  styles: `
    .strip {
      --edge: var(--ink-3);
      background: var(--paper-2);
      border: 1px solid var(--rule);
      border-left: 5px solid var(--edge);
      padding: 0.7rem 0.85rem 0.75rem;
      display: grid;
      gap: 0.5rem;
    }
    .strip[data-restriction='PROHIBITED'] {
      --edge: var(--prohibited);
    }
    .strip[data-restriction='REQ_AUTHORISATION'] {
      --edge: var(--authorisation);
    }
    .strip[data-restriction='CONDITIONAL'] {
      --edge: var(--conditional);
    }
    .strip[data-restriction='NO_RESTRICTION'] {
      --edge: var(--informational);
    }
    .strip:hover,
    .strip:focus-within {
      background: #fff;
      border-color: var(--edge);
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .rank {
      flex: none;
      align-self: center;
      display: grid;
      place-items: center;
      width: 1.25rem;
      height: 1.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--ink);
      border: 1px solid var(--edge);
    }
    header h3 {
      flex: 1;
    }
    .origin {
      flex: none;
      align-self: center;
      padding: 0 0.28rem;
      border: 1px solid var(--rule);
      font-size: 0.65rem;
      font-weight: 500;
      color: var(--ink-2);
      vertical-align: 0.1em;
      white-space: nowrap;
    }
    h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    /* The band is where this strip spends its boldness: one filled block, full width, so the
       restriction is unmissable and never competes with the zone name for room. */
    .status {
      margin: 0;
      padding: 0.2rem 0.5rem;
      background: var(--edge);
      color: var(--paper-2);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    /* Amber is too light to reverse type out of; amber-on-ink is the caution convention. */
    .strip[data-restriction='CONDITIONAL'] .status {
      color: var(--ink);
    }
    .compartments {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.85rem;
      border-block: 1px solid var(--rule);
      padding-block: 0.5rem;
    }
    .compartment {
      display: grid;
      gap: 0.1rem;
      align-content: start;
    }
    .limits {
      justify-items: center;
      border-right: 1px solid var(--rule);
      padding-right: 0.85rem;
    }
    /* Vertical limits are written the way a chart writes them: upper over lower. */
    .stack {
      display: grid;
      justify-items: center;
      line-height: 1.15;
      font-size: 1.05rem;
      font-weight: 500;
    }
    .stack .rule {
      width: 2.4rem;
      height: 1px;
      background: var(--ink);
      margin: 0.12rem 0;
    }
    .stack .lower {
      font-size: 0.85rem;
      color: var(--ink-2);
    }
    p {
      margin: 0;
      font-size: 0.82rem;
      color: var(--ink-2);
    }
    .translation {
      color: var(--ink);
      font-size: 0.85rem;
    }
    .official {
      font-size: 0.8rem;
      margin-top: 0.3rem;
    }
    .muted {
      color: var(--ink-3);
      font-style: italic;
    }
    .temporary {
      color: var(--conditional);
      font-size: 0.78rem;
    }
    /* Standing restrictions are the normal case, so this stays quiet next to a live window. */
    .no-expiry {
      color: var(--ink-3);
      font-size: 0.78rem;
    }
    details summary {
      cursor: pointer;
    }
    ul {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.82rem;
      color: var(--ink-2);
    }
    footer {
      border-top: 1px solid var(--rule);
      padding-top: 0.45rem;
      display: grid;
      gap: 0.05rem;
    }
    .contacts {
      display: flex;
      gap: 0.9rem;
      flex-wrap: wrap;
      font-size: 0.78rem;
    }
  `,
})
export class ZoneStripComponent {
  protected readonly i18n = inject(I18nService);
  private readonly zones = inject(ZonesService);

  readonly zone = input.required<NormalizedZone>();
  /** Position in the strictest-first list; the altitude ladder labels its bands the same way. */
  readonly rank = input.required<number>();
  /** Set when the result spans several countries and each strip has to say which it is from. */
  readonly showOrigin = input(false);
  readonly hovered = output<string | null>();

  protected readonly reasons = computed(() =>
    this.zone()
      .reasons.map((r) => this.i18n.t(`reason.${r}`))
      .join(' · '),
  );

  /**
   * The country a zone came from. The summary names it once for the whole result, so this only
   * appears when the applicable zones actually span more than one authority.
   */
  protected readonly sourceName = computed(() => {
    if (!this.showOrigin()) return null;
    const manifest = this.zones.manifest(this.zone().sourceId);
    return manifest ? this.i18n.pick(manifest.names) : this.zone().sourceId;
  });

  protected readonly translation = computed(() => {
    const { source, translations } = this.zone().text;
    const locale = this.i18n.locale();
    // Reading the authority's own language needs no second line; the official text is already
    // in it. Which language that is comes from the source, not from a fixed guess.
    const sourceLocale = this.zones.manifest(this.zone().sourceId)?.sourceLocale;
    if (locale === sourceLocale) return null;
    const text = translations[locale] ?? translations['en'] ?? null;
    return text === source ? null : text;
  });

  /** True when the source publishes several languages itself, so none is a translation. */
  protected readonly multilingualSource = computed(
    () => (this.zones.manifest(this.zone().sourceId)?.officialLocales?.length ?? 1) > 1,
  );

  /** Label for the disclosure holding `text.source`, naming its language when it is one of many. */
  protected readonly officialTextLabel = computed(() => {
    const sourceLocale = this.zones.manifest(this.zone().sourceId)?.sourceLocale ?? '';
    return this.multilingualSource()
      ? this.i18n.t('strip.officialTextIn', { lang: sourceLocale.toUpperCase() })
      : this.i18n.t('strip.officialText');
  });

  /** Conditions in the reader's language where the authority publishes them. */
  protected readonly conditions = computed(() => {
    const zone = this.zone();
    return zone.conditionTranslations?.[this.i18n.locale()] ?? zone.conditions;
  });

  protected readonly authorityName = computed(() => {
    const { name, nameTranslations } = this.zone().authority;
    return nameTranslations?.[this.i18n.locale()] ?? name;
  });

  /** Some records repeat the authority's name inside the contact field; show it once. */
  protected readonly contactName = computed(() => {
    const { name, contactName } = this.zone().authority;
    if (!contactName) return null;
    const trimmed = contactName.replace(name, '').trim();
    return trimmed.length ? trimmed : null;
  });

  protected readonly temporary = computed(() => {
    const a = this.zone().applicability;
    return a.permanent ? null : a;
  });
}
