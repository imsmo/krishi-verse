# Capacity plan (lean launch → scale triggers)

Sizing is variable-driven (Terraform tfvars + HPA). Start lean; scale on the triggers below (proven by the P0-6
load runs). Use `ops/load-tests/k6-billion-scale-model.js` to convert measured RPS/pod into required counts.

| Tier | API pods (HPA) | Aurora | Redis | Trigger to scale up |
|------|----------------|--------|-------|---------------------|
| Launch (lean) | 2→8 | Serverless v2 0.5–4 ACU, 1 reader | t4g.micro ×2 | p99 > SLO, or CPU > 70% sustained |
| Growth | 8→24 | 2–16 ACU, 2 readers | t4g.small cluster | replica lag, connections > 85% |
| Scale | shard split (P3-2) | sharded | cluster-mode | one shard hot / write ceiling |

SLO budgets in `slo.md`. Re-run the load suite after each tier change; record measured RPS/pod here.
