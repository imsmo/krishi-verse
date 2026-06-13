# README

Kafka (MSK) stream processors for high-volume async: notification fan-out, search indexing, analytics ETL, fraud signals, mandi ingestion. outbox-relay publishes to Kafka; these consume. Partitioned by tenant_id for ordered, parallel processing. Phase 2 (SQS is fine until ~10k msg/s). · [P2]
