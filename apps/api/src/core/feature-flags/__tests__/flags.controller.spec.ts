// core/feature-flags/__tests__/flags.controller.spec.ts
// GET /v1/config/flags — the mobile remote-config endpoint (apps/mobile/src/core/flags/hydrate.ts). @Public
// because hydrateFlags() runs pre-login at app boot (apps/mobile/src/app/_layout.tsx), before any bearer token
// exists. Proves the envelope shape the client expects: { data: { <flagKey>: boolean } }.
import { FlagsController } from '../flags.controller';

describe('FlagsController', () => {
  it('returns { data: <flag map> } from FlagsService.allEnabled', async () => {
    const flags: any = { allEnabled: jest.fn().mockResolvedValue({ farmer_app: true, auctions: false }) };
    const controller = new FlagsController(flags);
    const res = await controller.flagsMap();
    expect(res).toEqual({ data: { farmer_app: true, auctions: false } });
  });

  it('an empty flag table still returns a well-formed (empty) map, never throws', async () => {
    const flags: any = { allEnabled: jest.fn().mockResolvedValue({}) };
    const controller = new FlagsController(flags);
    await expect(controller.flagsMap()).resolves.toEqual({ data: {} });
  });
});
