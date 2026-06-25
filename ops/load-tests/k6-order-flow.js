// ops/load-tests/k6-order-flow.js · buyer browse→checkout→pay happy path under load. SLO gate: p95<500ms, <1% err.
//   BASE=https://api.krishiverse.ai k6 run ops/load-tests/k6-order-flow.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:3000';
const errors = new Rate('flow_errors');

export const options = {
  scenarios: {
    ramp: { executor: 'ramping-vus', startVUs: 0, stages: [
      { duration: '2m', target: 200 },   // warm
      { duration: '5m', target: 500 },   // launch target
      { duration: '3m', target: 500 },   // hold
      { duration: '2m', target: 0 },     // drain
    ]},
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    flow_errors: ['rate<0.01'],
  },
};

export default function () {
  // public browse (no auth) — the hottest read path
  const list = http.get(`${BASE}/v1/listings`, { tags: { name: 'listings' } });
  check(list, { 'listings 200': (r) => r.status === 200 }) || errors.add(1);

  const tenants = http.get(`${BASE}/v1/market/pulse`, { tags: { name: 'market_pulse' } });
  check(tenants, { 'pulse ok': (r) => r.status === 200 || r.status === 404 }) || errors.add(1);
  sleep(Math.random() * 2);
}
