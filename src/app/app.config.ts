import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { ConfigService } from './core/config.service';
import { ZonesService } from './core/zones.service';
import { parsePermalink } from './core/permalink';
import { AnalyticsService } from './core/analytics.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(async () => {
      // Every inject() happens before the first await; afterwards there is no injection
      // context and Angular throws NG0203.
      const config = inject(ConfigService);
      const zones = inject(ZonesService);
      const analytics = inject(AnalyticsService);
      await config.load();
      // Reloads the tag for a visitor who already said yes; does nothing otherwise.
      analytics.restore();
      await zones.loadManifests();
      // The address bar wins over the configured default, so a shared link opens with the
      // countries it was shared with rather than being loaded twice.
      const asked = parsePermalink(location.search).sources.filter((id) =>
        config.required.enabledSources.includes(id),
      );
      await zones.select(asked.length ? asked : config.required.defaultSources);
    }),
  ],
};
