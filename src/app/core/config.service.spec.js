import { describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigService } from './config.service';
function stubFetch(body, ok = true) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: async () => body }));
}
const valid = {
    enabledSources: ['bulgaria'],
    defaultSource: 'bulgaria',
    map: { tileUrl: 't', attribution: 'a', maxZoom: 19 },
    defaultHeightM: 120,
    staleAfterDays: 7,
};
afterEach(() => vi.unstubAllGlobals());
describe('ConfigService', () => {
    it('rejects a defaultSource that is not enabled', async () => {
        stubFetch({ ...valid, defaultSource: 'switzerland' });
        await expect(new ConfigService().load()).rejects.toThrow(/not in enabledSources/);
    });
    it('rejects an empty source list', async () => {
        stubFetch({ ...valid, enabledSources: [] });
        await expect(new ConfigService().load()).rejects.toThrow(/no enabledSources/);
    });
    it('reports an unreachable config file', async () => {
        stubFetch(null, false);
        await expect(new ConfigService().load()).rejects.toThrow(/404/);
    });
    it('accepts a valid config', async () => {
        stubFetch(valid);
        const svc = new ConfigService();
        await svc.load();
        expect(svc.required.defaultSource).toBe('bulgaria');
    });
    it('refuses to hand out config before it is loaded', () => {
        expect(() => new ConfigService().required).toThrow(/before it finished loading/);
    });
});
