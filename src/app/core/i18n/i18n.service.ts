import { Injectable, computed, signal } from '@angular/core';
import en from './en.json';
import bg from './bg.json';
import de from './de.json';
import { formatAtOffset, offsetLabel, offsetMinutesOf } from '../instant';

export const LOCALES = ['en', 'de', 'bg'] as const;
export type Locale = (typeof LOCALES)[number];

const CATALOGUES: Record<Locale, Record<string, string>> = { en, de, bg };
const STORAGE_KEY = 'avio.locale';

/** Aviation reads 24-hour, zero-padded, in every language; h23 keeps midnight as 00, not 24. */
const CLOCK = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;

function initialLocale(): Locale {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  const preferred = globalThis.navigator?.language?.slice(0, 2);
  return (LOCALES as readonly string[]).includes(preferred ?? '') ? (preferred as Locale) : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(initialLocale());
  private readonly catalogue = computed(() => CATALOGUES[this.locale()]);

  setLocale(locale: Locale): void {
    this.locale.set(locale);
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
  }

  /** Missing keys render as the key itself, which makes gaps obvious rather than invisible. */
  t(key: string, params: Record<string, string | number> = {}): string {
    const template = this.catalogue()[key] ?? CATALOGUES.en[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      name in params ? String(params[name]) : `{${name}}`,
    );
  }

  /** Picks the source's own label for the active locale, falling back to English. */
  pick(values: Record<string, string>): string {
    return values[this.locale()] ?? values['en'] ?? Object.values(values)[0] ?? '';
  }

  /**
   * An instant as the authority published it — its own wall clock, with the offset named so
   * the line reads the same from any timezone.
   */
  formatInstant(iso: string): string {
    const text = formatAtOffset(iso, this.locale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...CLOCK,
    });
    const label = offsetLabel(offsetMinutesOf(iso));
    return label ? `${text} ${label}` : text;
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.valueOf())
      ? iso
      : d.toLocaleDateString(this.locale(), { year: 'numeric', month: 'short', day: 'numeric' });
  }
}
