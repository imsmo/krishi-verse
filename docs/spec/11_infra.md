# Infrastructure (Terraform, Helm, gateway)

136 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `README.md`

### `infra/README.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `docker`

### `infra/docker/ai-services.Dockerfile` 
- **Layer:** Infra Script/Dockerfile
- **Implement:** DR failover drill / backup-verify / cost report; container builds. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `infra/docker/api.Dockerfile` 
- **Layer:** Infra Script/Dockerfile
- **Implement:** DR failover drill / backup-verify / cost report; container builds. 
- **Laws:** general
- **Priority:** see build plan

### `infra/docker/node-base.Dockerfile` 
- **Layer:** Infra Script/Dockerfile
- **Implement:** DR failover drill / backup-verify / cost report; container builds. 
- **Laws:** general
- **Priority:** see build plan


---
## `gateway`

### `infra/gateway/alb-routing.tf` 
- **Layer:** Edge Gateway/WAF
- **Implement:** ALB routing (admin-api on its own allowlisted listener), WAF rate/geo rules, per-plan edge throttling. 
- **Laws:** general
- **Priority:** see build plan

### `infra/gateway/api-throttling.tf` 
- **Layer:** Edge Gateway/WAF
- **Implement:** ALB routing (admin-api on its own allowlisted listener), WAF rate/geo rules, per-plan edge throttling. 
- **Laws:** general
- **Priority:** see build plan

### `infra/gateway/waf-rules.tf` 
- **Layer:** Edge Gateway/WAF
- **Implement:** ALB routing (admin-api on its own allowlisted listener), WAF rate/geo rules, per-plan edge throttling. 
- **Laws:** Law6 dynamic data not code
- **Priority:** see build plan


---
## `helm`

### `infra/helm/admin-api/Chart.yaml` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** see build plan

### `infra/helm/admin-api/templates/deployment.yaml` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys, Law11 god-mode separate realm
- **Priority:** see build plan

### `infra/helm/admin-api/templates/hpa.yaml` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys, Law11 god-mode separate realm
- **Priority:** see build plan

### `infra/helm/admin-api/templates/service.yaml` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys, Law11 god-mode separate realm
- **Priority:** see build plan

### `infra/helm/admin-api/values.yaml` 
- **Layer:** God-Mode (admin-api)
- **Implement:** Owner/platform plane — SEPARATE security realm (FIDO2, IP allowlist, step-up re-auth, every action audited). Connects as kv_admin. Implement the owner operation behind this file: tenant approve/suspend/impersonate/billing/flags/compliance/recon. NEVER reachable from tenant API (Law11). 
- **Laws:** Law11 god-mode separate realm
- **Priority:** see build plan

### `infra/helm/ai-services/Chart.yaml` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `infra/helm/ai-services/templates/deployment.yaml` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/ai-services/templates/hpa.yaml` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/ai-services/templates/service.yaml` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/ai-services/values.yaml` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `infra/helm/analytics-pipeline/Chart.yaml` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/analytics-pipeline/templates/deployment.yaml` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/analytics-pipeline/templates/hpa.yaml` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/analytics-pipeline/templates/service.yaml` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/analytics-pipeline/values.yaml` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/api/Chart.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/api/templates/deployment.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/api/templates/hpa.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/api/templates/pdb.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/api/templates/rollout.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/api/templates/service.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/api/values.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/ivr-ussd-gateway/Chart.yaml` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/ivr-ussd-gateway/templates/deployment.yaml` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/ivr-ussd-gateway/templates/hpa.yaml` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/ivr-ussd-gateway/templates/service.yaml` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/ivr-ussd-gateway/values.yaml` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/outbox-relay/Chart.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/outbox-relay/templates/deployment.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/outbox-relay/templates/hpa.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/outbox-relay/templates/pdb.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/outbox-relay/templates/rollout.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/outbox-relay/templates/service.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/outbox-relay/values.yaml` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/realtime-gateway/Chart.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/realtime-gateway/templates/deployment.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/realtime-gateway/templates/hpa.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/realtime-gateway/templates/pdb.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/realtime-gateway/templates/service.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/realtime-gateway/templates/sticky-svc.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/realtime-gateway/values.yaml` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/stream-processor/Chart.yaml` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/stream-processor/templates/deployment.yaml` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/stream-processor/templates/hpa.yaml` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/stream-processor/templates/pdb.yaml` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/stream-processor/templates/service.yaml` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/stream-processor/values.yaml` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/wallet-service/Chart.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `infra/helm/wallet-service/templates/deployment.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** Wave 0/1

### `infra/helm/wallet-service/templates/hpa.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** Wave 0/1

### `infra/helm/wallet-service/templates/pdb.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** Wave 0/1

### `infra/helm/wallet-service/templates/rollout.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** Wave 0/1

### `infra/helm/wallet-service/templates/service.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** Wave 0/1

### `infra/helm/wallet-service/values.yaml` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `infra/helm/web-partner/Chart.yaml` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/web-partner/templates/deployment.yaml` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web-partner/templates/hpa.yaml` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web-partner/templates/service.yaml` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web-partner/values.yaml` 
- **Layer:** Partner Portal (Next.js)
- **Implement:** Bank/NBFC/insurer surface. Partner-scoped auth; loan-queue decisioning / claim survey; sees only consented applications, never raw tenant data. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/web/Chart.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/web/templates/deployment.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web/templates/hpa.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web/templates/pdb.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web/templates/rollout.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web/templates/service.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/web/values.yaml` 
- **Layer:** Helm Chart
- **Implement:** Per-app K8s chart: deployment/service/HPA/PDB/canary rollout; realtime-gateway adds sticky session LB. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/whatsapp-bot/Chart.yaml` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/whatsapp-bot/templates/deployment.yaml` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/whatsapp-bot/templates/hpa.yaml` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/whatsapp-bot/templates/service.yaml` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/whatsapp-bot/values.yaml` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/worker/Chart.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `infra/helm/worker/templates/deployment.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/worker/templates/hpa.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/worker/templates/pdb.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/worker/templates/rollout.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/worker/templates/service.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `infra/helm/worker/values.yaml` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan


---
## `scripts`

### `infra/scripts/backup-verify.sh` 
- **Layer:** Infra Script/Dockerfile
- **Implement:** DR failover drill / backup-verify / cost report; container builds. 
- **Laws:** general
- **Priority:** see build plan

### `infra/scripts/cost-report.sh` 
- **Layer:** Infra Script/Dockerfile
- **Implement:** DR failover drill / backup-verify / cost report; container builds. 
- **Laws:** general
- **Priority:** see build plan

### `infra/scripts/dr-failover.sh` 
- **Layer:** Infra Script/Dockerfile
- **Implement:** DR failover drill / backup-verify / cost report; container builds. 
- **Laws:** general
- **Priority:** see build plan


---
## `terraform`

### `infra/terraform/envs/dev/backend.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/dev/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/dev/terraform.tfvars` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/dev/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/prod/backend.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/prod/dr.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/prod/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/prod/terraform.tfvars` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/prod/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/staging/backend.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/staging/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/staging/terraform.tfvars` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan

### `infra/terraform/envs/staging/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** general
- **Priority:** see build plan


---
## `aurora`

### `infra/terraform/modules/aurora/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/aurora/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/aurora/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `cdn`

### `infra/terraform/modules/cdn/cache-policies.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/cdn/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/cdn/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/cdn/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `eks`

### `infra/terraform/modules/eks/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/eks/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/eks/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `msk`

### `infra/terraform/modules/msk/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/msk/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/msk/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `observability`

### `infra/terraform/modules/observability/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/observability/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/observability/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `opensearch`

### `infra/terraform/modules/opensearch/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/opensearch/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/opensearch/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `redis`

### `infra/terraform/modules/redis/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/redis/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/redis/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `terraform`

### `infra/terraform/modules/s3-cdn/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/s3-cdn/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/s3-cdn/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `secrets`

### `infra/terraform/modules/secrets/README.md` 
- **Layer:** Module README
- **Implement:** Document this module against the listings blueprint: entities, state machines, events in/out, tables owned, PRD mapping, screens served. 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/secrets/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/secrets/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/secrets/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `vpc`

### `infra/terraform/modules/vpc/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/vpc/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/vpc/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan


---
## `waf`

### `infra/terraform/modules/waf/main.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/waf/outputs.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan

### `infra/terraform/modules/waf/variables.tf` 
- **Layer:** Terraform
- **Implement:** IaC module/env composition (vpc/eks/aurora/redis/opensearch/cdn/secrets/observability/waf/msk; dev/staging/prod + Hyderabad DR; cell per country). 
- **Laws:** Law1 tenant-scope, Law10 feature flag
- **Priority:** see build plan
