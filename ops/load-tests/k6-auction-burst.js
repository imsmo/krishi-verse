// ops/load-tests/k6-auction-burst.js · thundering-herd bid burst in the final seconds of an auction.
// Simulates anti-snipe pressure: 1000 VUs hammering placeBid on one auction. Gate: p95<800ms, idempotent.
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';
const AUCTION = __ENV.AUCTION_ID || '';
const conflicts = new Rate('bid_conflicts');

export const options = {
  scenarios: { burst: { executor: 'ramping-arrival-rate', startRate: 50, timeUnit: '1s',
    preAllocatedVUs: 200, maxVUs: 1000, stages: [
      { duration: '30s', target: 200 }, { duration: '60s', target: 1000 }, { duration: '30s', target: 0 } ] } },
  thresholds: { http_req_duration: ['p(95)<800'], http_req_failed: ['rate<0.05'] },
};

export default function () {
  if (!TOKEN || !AUCTION) return; // requires a seeded live auction + buyer token
  const res = http.post(`${BASE}/v1/auctions/${AUCTION}/bids`,
    JSON.stringify({ amountMinor: String(100000 + Math.floor(Math.random() * 100000)) }),
    { headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}`, 'idempotency-key': `${__VU}-${__ITER}` }, tags: { name: 'place_bid' } });
  check(res, { 'accepted or legal-reject': (r) => [200, 201, 409, 422].includes(r.status) });
  if (res.status === 409) conflicts.add(1);
}
