// ops/load-tests/soak-72h.js · 72-hour endurance soak at moderate steady load — catches leaks, connection-pool
// exhaustion, partition-runway gaps, and slow drift. CLUSTER-ONLY (run from a dedicated load box). Watch the
// golden-signals + db-health + wallet-invariants dashboards throughout; the run passes if SLOs hold for 72h.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:3000';
export const options = {
  scenarios: { soak: { executor: 'constant-vus', vus: 300, duration: '72h' } },
  thresholds: { http_req_duration: ['p(99)<2000'], http_req_failed: ['rate<0.01'] },
};
export default function () {
  http.get(`${BASE}/v1/listings`, { tags: { name: 'listings' } });
  check(http.get(`${BASE}/healthz`), { 'healthy': (r) => r.status === 200 });
  sleep(1 + Math.random() * 3);
}
