# Makefile · convenience entrypoints (MNC dev ergonomics)
.PHONY: install dev build test lint typecheck db-up db-down api-test

install:    ; pnpm install
dev:        ; pnpm dev
build:      ; pnpm build
test:       ; pnpm test
lint:       ; pnpm lint
typecheck:  ; pnpm -r typecheck
db-up:      ; docker compose -f apps/api/docker-compose.dev.yml up -d
db-down:    ; docker compose -f apps/api/docker-compose.dev.yml down
api-test:   ; cd apps/api && pnpm typecheck && pnpm test:unit && pnpm build
