# Backend Services (wallet, worker, outbox-relay, realtime, stream)

94 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `outbox-relay`

### `apps/outbox-relay/Dockerfile` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** see build plan

### `apps/outbox-relay/package.json` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** see build plan

### `apps/outbox-relay/src/main.ts` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** see build plan

### `apps/outbox-relay/src/poller.ts` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** see build plan

### `apps/outbox-relay/src/publishers/kafka.publisher.ts` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law4 outbox in same txn
- **Priority:** see build plan

### `apps/outbox-relay/src/publishers/opensearch.publisher.ts` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law4 outbox in same txn
- **Priority:** see build plan

### `apps/outbox-relay/src/publishers/sqs.publisher.ts` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law4 outbox in same txn
- **Priority:** see build plan

### `apps/outbox-relay/src/publishers/webhook.publisher.ts` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** Law4 outbox in same txn
- **Priority:** see build plan

### `apps/outbox-relay/tsconfig.json` 
- **Layer:** Outbox Relay
- **Implement:** Poll outbox_events (FOR UPDATE SKIP LOCKED) and publish to SQS/EventBridge/OpenSearch/webhooks; mark published; retry failed. Exactly the bridge to Kafka in Phase 2. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `realtime-gateway`

### `apps/realtime-gateway/Dockerfile` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/README.md` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/package.json` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/auth/socket-auth.guard.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/backpressure/slow-consumer.eviction.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law12 degrade-not-die / scale
- **Priority:** see build plan

### `apps/realtime-gateway/src/channels/auction.channel.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/channels/mcc.channel.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/channels/order.channel.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/realtime-gateway/src/channels/presence.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/main.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/metrics/socket-metrics.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/pubsub/redis-pubsub.adapter.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/pubsub/redis-streams.replay.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/src/ws-server.ts` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** see build plan

### `apps/realtime-gateway/tsconfig.json` 
- **Layer:** Realtime Gateway
- **Implement:** Stateless WebSocket pod; Redis Pub/Sub fan-out + Streams replay; JWT+tenant channel scoping; auction/order/MCC channels; slow-consumer eviction. Scales to millions of sockets by adding pods. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `stream-processor`

### `apps/stream-processor/Dockerfile` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/README.md` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/package.json` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/consumers/analytics-etl.consumer.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/consumers/fraud-signal.consumer.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/consumers/notification-fanout.consumer.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/consumers/projection-builder.consumer.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/consumers/search-indexer.consumer.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/dlq/dead-letter.handler.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/main.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/src/topics.ts` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** see build plan

### `apps/stream-processor/tsconfig.json` 
- **Layer:** Stream Processor
- **Implement:** Kafka(MSK) consumer (Phase 2): search-index, notification fan-out, analytics ETL, fraud signals, projection building. Partitioned by tenant_id for ordered parallelism; DLQ. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `wallet-service`

### `apps/wallet-service/Dockerfile` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/README.md` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/package.json` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/accounts/accounts.service.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/accounts/balance.service.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/accounts/hot-account-striping.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/core/config/env.validation.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/core/config/wallet-config.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/core/database/pg-pool.provider.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/core/observability/telemetry.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/grpc/wallet.grpc-controller.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/wallet-service/src/grpc/wallet.proto` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/ledger/hash-chain.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/wallet-service/src/ledger/ledger.repository.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law9 migrations as PRs, Law12 degrade-not-die / scale
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning, Law9 migrations as PRs, Law12 degrade-not-die / scale
- **Priority:** Wave 0/1

### `apps/wallet-service/src/ledger/post-transaction.service.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/wallet-service/src/ledger/txn-types.registry.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/wallet-service/src/main.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/payments/razorpay.client.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/payments/webhook.controller.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law7 i18n keys, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/wallet-service/src/payouts/failure-reversal.service.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/payouts/payout-queue.service.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/payouts/razorpayx.client.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/reconciliation/daily-gateway.job.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/reconciliation/hourly-internal.job.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/reconciliation/zero-sum-check.job.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/test/ledger-invariants.spec.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `apps/wallet-service/src/test/striping.spec.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/wallet-service/src/wallet.module.ts` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn, Law10 feature flag
- **Priority:** Wave 0/1

### `apps/wallet-service/tsconfig.json` 
- **Layer:** Wallet Service
- **Implement:** The ONLY writer of ledger tables (kv_wallet role). Implement: PostTransaction (entries sum to 0), GetBalance, HoldEMD/Release, QueuePayout via gRPC; hash-chain; hot-account striping (shard_no); hourly internal + daily gateway reconciliation; Razorpay/RazorpayX clients; failure-reversal. Append-only — never UPDATE/DELETE ledger. Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Laws:** Law1 tenant-scope, Law2 BIGINT money, Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1


---
## `worker`

### `apps/worker/Dockerfile` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/package.json` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/kyc/expiry-scanner.cron.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/kyc/karza-verify.processor.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/mandi-ingest/agmarknet.scraper.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/mandi-ingest/enam.client.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/mandi-ingest/normaliser.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/notifications/digest-batcher.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/notifications/dispatch.processor.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/notifications/push.sender.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/notifications/sms-budget-guard.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/notifications/whatsapp.sender.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/partitions/archive-partitions.cron.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/partitions/ensure-partitions.cron.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/reconciliation/recon-alert.processor.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/retention/idempotency-purge.cron.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/retention/retention-enforcer.cron.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/scheme-sync/pfms-status.poller.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/scheme-sync/rule-version.watcher.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law6 dynamic data not code
- **Laws:** Law6 dynamic data not code
- **Priority:** see build plan

### `apps/worker/src/jobs/settlements/order-settlement.processor.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law2 BIGINT money, Law8 partition pruning
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/worker/src/jobs/settlements/statement-generator.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. Law5 sole state machine
- **Laws:** Law5 sole state machine
- **Priority:** see build plan

### `apps/worker/src/jobs/sms-budget/daily-cost-report.cron.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/weather-ingest/alert-fanout.processor.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/jobs/weather-ingest/imd.client.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/main.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/queues/dlq.handler.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/queues/queue.registry.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/src/test/jobs.spec.ts` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** see build plan

### `apps/worker/tsconfig.json` 
- **Layer:** Worker / Queue Job
- **Implement:** BullMQ/SQS consumer. Idempotent, batched, resumable, tenant-aware, DLQ on repeated failure, respects backpressure. SMS jobs honour the daily budget cap. general
- **Laws:** general
- **Priority:** Wave 0/1
