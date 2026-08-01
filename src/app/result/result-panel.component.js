import { __decorate } from "tslib";
import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { AltitudeLadderComponent } from './altitude-ladder.component';
import { ZoneStripComponent } from './zone-strip.component';
let ResultPanelComponent = class ResultPanelComponent {
    i18n = inject(I18nService);
    matches = input([]);
    heightM = input(120);
    point = input(null);
    hovered = output();
    /** The strictest applicable restriction; matches arrive already sorted strictest-first. */
    headline = computed(() => this.matches()[0]?.zone.restriction ?? 'clear');
    countLabel = computed(() => {
        const count = this.matches().length;
        return count === 1
            ? this.i18n.t('verdict.zonesApply', { count })
            : this.i18n.t('verdict.zonesApplyPlural', { count });
    });
};
ResultPanelComponent = __decorate([
    Component({
        selector: 'dz-result-panel',
        imports: [AltitudeLadderComponent, ZoneStripComponent],
        template: `
    @if (point(); as p) {
      <section class="verdict" [attr.data-restriction]="headline()">
        <p class="coords data">{{ p[1].toFixed(5) }}, {{ p[0].toFixed(5) }}</p>
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
    .coords {
      margin: 0;
      font-size: 0.72rem;
      color: var(--ink-3);
      letter-spacing: 0.02em;
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
], ResultPanelComponent);
export { ResultPanelComponent };
