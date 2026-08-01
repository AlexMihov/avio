import { inject, provideAppInitializer, provideBrowserGlobalErrorListeners, } from '@angular/core';
import { ConfigService } from './core/config.service';
import { ZonesService } from './core/zones.service';
export const appConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideAppInitializer(async () => {
            const config = inject(ConfigService);
            const zones = inject(ZonesService);
            await config.load();
            await zones.loadManifests();
            await zones.select(config.required.defaultSource);
        }),
    ],
};
