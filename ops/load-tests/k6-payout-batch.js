// ops/load-tests/k6-payout-batch.js · drive the weekly payout batch at volume to validate FOR UPDATE SKIP LOCKED
// throughput + RazorpayX rate-limit backpressure. Run against staging with the sandbox payout gateway.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.ADMIN_BASE || 'http://localhost:4001';
const TOKEN = __ENV.ADMIN_TOKEN || '';

export const options = { vus: 20, duration: '5m', thresholds: { http_req_failed: ['rate<0.02'] } };

export default function () {
  if (!TOKEN) return;
  const res = http.post(`${BASE}/v1/payout-batches/run`, '{}',
    { headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', 'idempotency-key': `batch-${__VU}-${__ITER}` } });
  check(res, { 'batch accepted/idempotent': (r) => [200, 202, 409].includes(r.status) });
}
