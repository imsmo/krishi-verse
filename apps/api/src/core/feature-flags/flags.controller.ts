// core/feature-flags/flags.controller.ts
// Remote-config endpoint the mobile app hydrates at BOOT (apps/mobile/src/core/flags/hydrate.ts,
// wired from apps/mobile/src/app/_layout.tsx's top-level effect — this runs before any login, in parallel with
// AuthProvider's own boot effect, so there is no bearer token yet on a cold app open). That timing is why this
// route is @Public rather than behind AuthGuard: an authenticated-only endpoint would 401 on every fresh install
// and the client would silently fall back to its built-in defaults for the entire session (hydrateFlags degrades
// on ANY failure) — including the `release_gate` forced-update kill-switch, which is exactly the flag that most
// needs to reach a pre-login client. In exchange we keep the payload CLIENT-SAFE: FlagsService.allEnabled()
// returns is_enabled booleans only (never rollout_pct/tenant-allowlist targeting rules), so an anonymous caller
// learns "which features exist and are live" — the same information the app's own bundled DEFAULTS already
// encode — never anything about HOW a rollout is targeted.
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { FlagsService } from './flags.service';

@Controller({ path: 'config', version: '1' })
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  @Public() @Get('flags')
  async flagsMap() {
    return { data: await this.flags.allEnabled() };
  }
}
