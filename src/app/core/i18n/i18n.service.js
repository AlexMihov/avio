import { __decorate } from "tslib";
import { Injectable, computed, signal } from '@angular/core';
import en from './en.json';
import bg from './bg.json';
export const LOCALES = ['en', 'bg'];
const CATALOGUES = { en, bg };
const STORAGE_KEY = 'drone-zones.locale';
function initialLocale() {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored && LOCALES.includes(stored))
        return stored;
    const preferred = globalThis.navigator?.language?.slice(0, 2);
    return preferred === 'bg' ? 'bg' : 'en';
}
let I18nService = class I18nService {
    locale = signal(initialLocale());
    catalogue = computed(() => CATALOGUES[this.locale()]);
    setLocale(locale) {
        this.locale.set(locale);
        globalThis.localStorage?.setItem(STORAGE_KEY, locale);
    }
    /** Missing keys render as the key itself, which makes gaps obvious rather than invisible. */
    t(key, params = {}) {
        const template = this.catalogue()[key] ?? CATALOGUES.en[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (_, name) => name in params ? String(params[name]) : `{${name}}`);
    }
    /** Picks the source's own label for the active locale, falling back to English. */
    pick(values) {
        return values[this.locale()] ?? values['en'] ?? Object.values(values)[0] ?? '';
    }
    formatDate(iso) {
        const d = new Date(iso);
        return Number.isNaN(d.valueOf())
            ? iso
            : d.toLocaleDateString(this.locale(), { year: 'numeric', month: 'short', day: 'numeric' });
    }
};
I18nService = __decorate([
    Injectable({ providedIn: 'root' })
], I18nService);
export { I18nService };
