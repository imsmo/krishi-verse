# Channels, Partner Portal & AI

68 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `ai-services`

### `apps/ai-services/Dockerfile` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/feature-store/README.md` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/pyproject.toml` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/common/auth.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/common/config.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** Wave 0/1

### `apps/ai-services/src/common/inference_logger.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/common/telemetry.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/fraud_signals/graph_features.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/fraud_signals/router.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/fraud_signals/rules.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn, Law6 dynamic data not code
- **Priority:** see build plan

### `apps/ai-services/src/main.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/photo_grading/model.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/photo_grading/preprocess.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/photo_grading/router.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/price_bands/features.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/price_bands/model.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/price_bands/router.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/voice_extraction/confidence.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/voice_extraction/extractor.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/voice_extraction/prompts.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/src/voice_extraction/router.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/tests/test_grading.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/tests/test_voice_extraction.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/training/photo_grading/labelling_spec.md` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/training/price_bands/backtest.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan

### `apps/ai-services/training/voice_extraction/dataset_builder.py` 
- **Layer:** AI Service (Python)
- **Implement:** FastAPI inference: voice→structured listing / photo grading / price bands / fraud signals. Logs to ai_inferences (governance); confidence thresholds route low-confidence to ai_review_queue; service-to-service auth. 
- **Laws:** Law3 idempotency on mutations, Law4 outbox in same txn
- **Priority:** see build plan


---
## `analytics-pipeline`

### `apps/analytics-pipeline/Dockerfile` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/README.md` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/clickhouse/ddl/001_events.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** see build plan

### `apps/analytics-pipeline/clickhouse/ddl/002_orders_flat.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/analytics-pipeline/clickhouse/ddl/003_mandi_prices_history.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/clickhouse/ddl/004_tenant_daily_rollups.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/dbt/dbt_project.yml` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/dbt/models/marts/farmer_cohorts.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/dbt/models/marts/gmv_daily.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/dbt/models/marts/mandi_pulse_pro.sql` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/exports/mandi-pulse-pro.exporter.ts` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/package.json` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/src/consumers/app-analytics.consumer.ts` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** general
- **Priority:** see build plan

### `apps/analytics-pipeline/src/consumers/domain-events.consumer.ts` 
- **Layer:** Analytics Pipeline
- **Implement:** Events→ClickHouse consumers + dbt marts + sellable data-product exporters (anonymised, consented — PRD §49). Never queries OLTP. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** see build plan


---
## `ivr-ussd-gateway`

### `apps/ivr-ussd-gateway/Dockerfile` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/README.md` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/package.json` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/call-router.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/exotel.adapter.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/flows/order-status.flow.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/flows/price-check.flow.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/flows/sell-intent.flow.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/menus/en.menu.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/menus/gu.menu.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ivr/menus/hi.menu.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/main.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ussd/session-store.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/src/ussd/ussd-router.ts` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/ivr-ussd-gateway/tsconfig.json` 
- **Layer:** IVR/USSD Gateway
- **Implement:** Voice menus (Exotel/Asterisk) + *123# (telco USSD) for feature-phone farmers: price-check, order-status, sell-intent (agent callback). Vernacular menus; Redis session store. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `whatsapp-bot`

### `apps/whatsapp-bot/Dockerfile` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/whatsapp-bot/README.md` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/whatsapp-bot/package.json` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/whatsapp-bot/src/flows/browse-catalogue.flow.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law6 dynamic data not code
- **Priority:** see build plan

### `apps/whatsapp-bot/src/flows/language-select.flow.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/whatsapp-bot/src/flows/order-status.flow.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/whatsapp-bot/src/flows/place-order.flow.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/whatsapp-bot/src/flows/repeat-order.flow.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `apps/whatsapp-bot/src/main.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/whatsapp-bot/src/session.store.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** see build plan

### `apps/whatsapp-bot/src/templates/sync-templates.job.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law6 dynamic data not code, Law7 i18n keys
- **Priority:** see build plan

### `apps/whatsapp-bot/src/webhook.controller.ts` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** Law3 idempotency on mutations, Law7 i18n keys, Law10 feature flag
- **Priority:** see build plan

### `apps/whatsapp-bot/tsconfig.json` 
- **Layer:** WhatsApp Bot
- **Implement:** Conversational commerce over Gupshup BSP (Phase 2): catalogue browse, order, status, repeat-order, OTP; template sync; session store. 
- **Laws:** general
- **Priority:** Wave 0/1
