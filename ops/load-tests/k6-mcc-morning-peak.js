// ops/load-tests/k6-mcc-morning-peak.js · dairy MCC morning collection peak — bursty writes from many centres
// at 5–7am. Models the spikiest write workload. Gate: p95<700ms on collection record.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:3000';
const TOKEN = __ENV.OPERATOR_TOKEN || '';

export const options = {
  scenarios: { peak: { executor: 'ramping-arrival-rate', startRate: 100, timeUnit: '1s',
    preAllocatedVUs: 300, maxVUs: 1500, stages: [
      { duration: '1m', target: 300 }, { duration: '4m', target: 1200 }, { duration: '2m', target: 0 } ] } },
  thresholds: { http_req_duration: ['p(95)<700'], http_req_failed: ['rate<0.02'] },
};

export default function () {
  if (!TOKEN) return;
  const res = http.post(`${BASE}/v1/dairy/collections`,
    JSON.stringify({ memberId: __ENV.MEMBER_ID, shift: 'morning', quantityMl: 5000 + (__ITER % 5000), fatPct: 38 }),
    { headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'idempotency-key': `mcc-${__VU}-${__ITER}` }, tags: { name: 'mcc_collection' } });
  check(res, { 'recorded': (r) => [200, 201, 409].includes(r.status) });
}
