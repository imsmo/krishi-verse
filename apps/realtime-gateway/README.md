# README

WebSocket fan-out gateway. Stateless pods behind a sticky LB; state lives in Redis Pub/Sub (and Redis Streams for replay). Carries live auction bids, order-status pushes, MCC live dashboards. Scales to millions of concurrent sockets by adding pods — no socket state on the pod. Auth = same JWT; tenant-scoped channels. · [P1]
