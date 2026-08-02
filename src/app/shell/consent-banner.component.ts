import { Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { AnalyticsService } from '../core/analytics.service';

/**
 * Asked once, before anything is loaded from Google. It sits at the foot of the page rather
 * than over the map, because a pilot who lands here from a shared link should be able to read
 * the answer without dismissing anything first.
 */
@Component({
  selector: 'dz-consent-banner',
  template: `
    @if (analytics.shouldAsk()) {
      <aside role="region" [attr.aria-label]="i18n.t('consent.title')">
        <p>{{ i18n.t('consent.body') }}</p>
        <div class="actions">
          <button type="button" class="decline" (click)="analytics.decline()">
            {{ i18n.t('consent.decline') }}
          </button>
          <button type="button" (click)="analytics.accept()">
            {{ i18n.t('consent.accept') }}
          </button>
        </div>
      </aside>
    }
  `,
  styles: `
    aside {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1.5rem;
      padding: 0.55rem 1.1rem;
      border-top: 1px solid var(--rule);
      background: var(--paper-2);
    }
    p {
      margin: 0;
      flex: 1 1 18rem;
      font-size: 0.76rem;
      color: var(--ink-2);
    }
    .actions {
      display: flex;
      gap: 0.4rem;
    }
    button {
      border: 1px solid var(--ink);
      background: var(--ink);
      color: var(--paper-2);
      font-size: 0.76rem;
      font-weight: 600;
      padding: 0.28rem 0.7rem;
      cursor: pointer;
    }
    button:hover {
      background: var(--ink-2);
    }
    /* Declining must be no harder than accepting. */
    .decline {
      background: transparent;
      color: var(--ink);
      border-color: var(--rule);
    }
    .decline:hover {
      background: var(--paper);
    }
    @media (max-width: 720px) {
      aside {
        padding: 0.5rem 0.8rem;
      }
      .actions {
        flex: 1 1 100%;
      }
      button {
        flex: 1;
      }
    }
  `,
})
export class ConsentBannerComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly analytics = inject(AnalyticsService);
}
