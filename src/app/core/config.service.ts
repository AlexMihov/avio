import { Injectable, signal } from '@angular/core';

export interface AppConfig {
  enabledSources: string[];
  defaultSource: string;
  map: { tileUrl: string; attribution: string; maxZoom: number };
  defaultHeightM: number;
  staleAfterDays: number;
}

/**
 * Loaded at runtime rather than compiled in, so anyone self-hosting can point the site at
 * different sources by editing one file next to index.html.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly value = signal<AppConfig | null>(null);

  readonly config = this.value.asReadonly();

  get required(): AppConfig {
    const cfg = this.value();
    if (!cfg) throw new Error('configuration was read before it finished loading');
    return cfg;
  }

  async load(): Promise<void> {
    const res = await fetch('config/app.config.json');
    if (!res.ok) throw new Error(`config/app.config.json returned ${res.status}`);
    const cfg = (await res.json()) as AppConfig;

    if (!cfg.enabledSources?.length) {
      throw new Error('no enabledSources configured');
    }
    if (!cfg.enabledSources.includes(cfg.defaultSource)) {
      throw new Error(`defaultSource "${cfg.defaultSource}" is not in enabledSources`);
    }
    this.value.set(cfg);
  }
}
