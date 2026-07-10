// ops/load-tests/soak-72h.js · endurance soak at moderate steady load — catches leaks, connection-pool
// exhaustion, partition-runway gaps, and slow drift. CLUSTER-ONLY (run from a dedicated load box). Watch the
// golden-signals + db-health + wallet-invariants dashboards throughout; the run passes if SLOs hold for the
// full configured duration. Default remains the PRD-scale 300 VUs / 72h; VUS/DURATION are env-overridable
// (S5 patch below) so ops/load-tests/pilot/run-pilot-gate.sh --soak can reuse this same script at pilot scale
// (e.g. VUS=15 DURATION=60m) instead of duplicating it.
//
// S5 PATCH (Sprint S5):
//   1. Real bug fix, independent of pilot scope: `${BASE}/healthz` is missing the `/v1` prefix. NestJS
//      versioning is `app.enableVersioning({ type: URI, defaultVersion: '1' })` (apps/api/src/main.ts) —
//      that applies to EVERY controller including the unprefixed `HealthController` (`@Controller()`,
//      apps/api/src/core/health/health.controller.ts), so the real route is `/v1/healthz`. The old path
//      would 404 every single iteration (proven working equivalent: scripts/pilot-e2e/flow.mjs calls
//      `/v1/healthz` and passes). Fixed.
//   2. Added `VUS`/`DURATION` env overrides (default unchanged: 300 / '72h') so this script is reusable at
//      pilot scale via the `--soak` flag in ops/load-tests/pilot/run-pilot-gate.sh, and `SOAK_P99_MS` /
//      `SOAK_ERR_RATE` threshold overrides (pilot infra — 2-node t3.medium, Aurora Serverless 0.5-2 ACU —
//      can show more ACU-scaling tail latency under sustained load than the PRD-scale defaults assume).
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:3000';
const VUS = Number(__ENV.VUS || 300);
const DURATION = __ENV.DURATION || '72h';

export const options = {
  scenarios: { soak: { executor: 'constant-vus', vus: VUS, duration: DURATION } },
  thresholds: {
    http_req_duration: [`p(99)<${Number(__ENV.SOAK_P99_MS || 2000)}`],
    http_req_failed: [`rate<${Number(__ENV.SOAK_ERR_RATE || 0.01)}`],
  },
};
export default function () {
  http.get(`${BASE}/v1/listings`, { tags: { name: 'listings' } });
  check(http.get(`${BASE}/v1/healthz`), { 'healthy': (r) => r.status === 200 });
  sleep(1 + Math.random() * 3);
}
