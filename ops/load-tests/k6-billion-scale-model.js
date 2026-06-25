// ops/load-tests/k6-billion-scale-model.js · NOT a live run — a capacity MODEL. Extrapolates the measured per-pod
// throughput (from the runs above) to the billion-ops target and prints the required pod/shard/replica counts.
// Run: k6 run -e RPS_PER_POD=350 -e TARGET_RPS=120000 ops/load-tests/k6-billion-scale-model.js
import { check } from 'k6';
export const options = { vus: 1, iterations: 1 };
export default function () {
  const rpsPerPod = Number(__ENV.RPS_PER_POD || 350);     // measured sustainable RPS/api-pod at p95<500ms
  const targetRps = Number(__ENV.TARGET_RPS || 120000);   // projected peak (tune per launch plan)
  const pods = Math.ceil(targetRps / rpsPerPod);
  const apiNodes = Math.ceil(pods / 6);                   // ~6 api pods per t3.large
  console.log(`Capacity model → api pods: ${pods}, est. nodes: ${apiNodes}, shards (≈40k tps/shard): ${Math.max(1, Math.ceil(targetRps/40000))}`);
  check(pods, { 'model computed': (p) => p > 0 });
}
