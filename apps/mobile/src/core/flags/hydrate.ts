// apps/mobile/src/core/flags/hydrate.ts · best-effort remote-config fetch at boot. Pulls the server's flag map
// (the KILL-SWITCH channel) and applies it; on ANY failure it silently no-ops so the built-in defaults stand
// (degrade-never-die — a flaky network must never brick the app). Assumed contract: GET /v1/config/flags →
// { data: { <flagKey>: boolean } }. Until that endpoint exists this is a no-op fallback; never fakes values.
import { apiClient } from '../api/client';
import { flags } from './flags';

export async function hydrateFlags(): Promise<void> {
  try {
    const r = await apiClient().request<Record<string, boolean>>('GET', 'config/flags');
    if (r?.data && typeof r.data === 'object') flags.hydrate(r.data);
  } catch {
    /* keep built-in defaults */
  }
}
