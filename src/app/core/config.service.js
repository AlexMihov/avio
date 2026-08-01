import { __decorate } from "tslib";
import { Injectable, signal } from '@angular/core';
/**
 * Loaded at runtime rather than compiled in, so anyone self-hosting can point the site at
 * different sources by editing one file next to index.html.
 */
let ConfigService = class ConfigService {
    value = signal(null);
    config = this.value.asReadonly();
    get required() {
        const cfg = this.value();
        if (!cfg)
            throw new Error('configuration was read before it finished loading');
        return cfg;
    }
    async load() {
        const res = await fetch('config/app.config.json');
        if (!res.ok)
            throw new Error(`config/app.config.json returned ${res.status}`);
        const cfg = (await res.json());
        if (!cfg.enabledSources?.length) {
            throw new Error('no enabledSources configured');
        }
        if (!cfg.enabledSources.includes(cfg.defaultSource)) {
            throw new Error(`defaultSource "${cfg.defaultSource}" is not in enabledSources`);
        }
        this.value.set(cfg);
    }
};
ConfigService = __decorate([
    Injectable({ providedIn: 'root' })
], ConfigService);
export { ConfigService };
