import { provideBrowserGlobalErrorListeners } from '@angular/core';
export const appConfig = {
    providers: [provideBrowserGlobalErrorListeners()],
};
