import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { ConfigService } from './core/config.service';
import { ZonesService } from './core/zones.service';
import { parsePermalink } from './core/permalink';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(async () => {
      const config = inject(ConfigService);
      const zones = inject(ZonesService);
      await config.load();
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
