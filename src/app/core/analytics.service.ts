import { Injectable, computed, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';
import {
  CONSENT_KEY,
  isMeasurementId,
  pageLocation,
  queryEvent,
  readConsent,
  type Consent,
} from './analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics, loaded only after the visitor says yes. Nothing is requested from Google
 * before that — no script, no cookie, no beacon — so declining leaves the page exactly as it
 * would be without analytics at all.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly config = inject(ConfigService);
  private readonly state = signal<Consent>(
    readConsent(globalThis.localStorage?.getItem(CONSENT_KEY)),
  );

  readonly consent = this.state.asReadonly();

  /** Configured and not yet answered: the only case where the banner belongs on screen. */
  readonly shouldAsk = computed(() => this.available() && this.state() === 'unknown');

  /** No id, or a malformed one, means analytics is simply off — including in local dev. */
  private available(): boolean {
    return isMeasurementId(this.config.config()?.analytics?.measurementId);
  }

  /** Loads the tag if consent was already given on an earlier visit. */
  restore(): void {
    if (this.available() && this.state() === 'granted') this.load();
  }

  accept(): void {
    this.remember('granted');
    if (this.available()) this.load();
  }

  decline(): void {
    this.remember('denied');
  }

  /**
   * One event per query, carrying only which country's data was read, in which language, and
   * whether anything applied. Silently does nothing unless the visitor accepted.
   */
  trackQuery(
    sources: readonly string[],
    locale: string,
    zonesFound: number,
    point: readonly [number, number] | null,
  ): void {
    if (this.state() !== 'granted' || !window.gtag) return;
    window.gtag('event', 'zone_query', queryEvent(sources, locale, zonesFound, point));
  }

  /**
   * Re-asserts the sanitised page location after the address bar changes. Enhanced measurement
   * fires its own page_view on history changes, seconds later and reading location.href
   * directly, so a value set once at config time does not hold. A `set` default does.
   */
  syncPage(): void {
    if (this.state() !== 'granted' || !window.gtag) return;
    window.gtag('set', { page_location: pageLocation(location.href) });
  }

  private remember(value: Consent): void {
    this.state.set(value);
    globalThis.localStorage?.setItem(CONSENT_KEY, value);
  }

  private load(): void {
    const id = this.config.required.analytics?.measurementId?.trim();
    if (!id || window.gtag) return;

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(tag);

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js reads arguments off dataLayer verbatim, so this cannot use a rest parameter.
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    // A default, so every later event — including the ones gtag raises by itself — uses it.
    window.gtag('set', {
      page_location: pageLocation(location.href),
      page_referrer: pageLocation(document.referrer),
    });
    window.gtag('config', id, {
      // Overriding both keeps the query string — the coordinates and height — out of GA.
      page_location: pageLocation(location.href),
      page_referrer: pageLocation(document.referrer),
      // gtag would otherwise raise its own page_view here and again on every history change,
      // reading the address bar directly. Ours is sent explicitly, already sanitised.
      send_page_view: false,
    });
    window.gtag('event', 'page_view', {
      page_location: pageLocation(location.href),
      page_referrer: pageLocation(document.referrer),
    });
  }
}
