# P0-13 · Dev-only affordances: decommission-for-prod checklist

Every dev/no-op/demo/sandbox affordance below is **provably absent or fail-closed** in production. The single
trigger is `NODE_ENV=production`: it (a) makes `AppConfig.assertProductionSecurity()` run at boot and **refuse to
start** on any listed misconfig, (b) makes adapter factories bind the real provider (never the sandbox), and (c)
makes the seed runner skip demo data. The regression matrix lives in
`apps/api/src/core/config/__tests__/app-config.security.spec.ts` (one case per row → prod boot throws) plus the
"fully-secure production env has ZERO problems" + "constructor boots on a secure env" cases.

| Dev affordance | Risk if shipped | How it fails-closed in prod | Enforced by |
|---|---|---|---|
| `AUTH_EXPOSE_OTP=true` (OTP echoed in API response) | OTP leak → account takeover | boot refuses; `config.auth.exposeOtp` is false in prod regardless | assertProductionSecurity + AppConfig.auth |
| `[dev SMS]` log line (NoopSmsSender prints the code) | OTP in logs | `SMS_PROVIDER=noop` refuses boot; even if constructed, prod path only warns "dropped", never logs the message | assertProductionSecurity + sms.noop.ts (isProd guard) |
| Sandbox **pay-in** gateway (deterministic, fake money) | fake "paid" intents | registered only when `allowSandbox` (`!isProd`); a real Razorpay gateway is required at boot | payments.module + assertProductionSecurity |
| Sandbox **payout** gateway (fake money-OUT) | real payout "settled" by a fake | `PAYOUT_GATEWAY` factory throws FATAL in prod unless RazorpayX is configured | payments.module |
| `PAYMENTS_DEFAULT_PROVIDER=sandbox` | new intents route to a non-existent/fake rail | boot refuses | assertProductionSecurity (P0-13) |
| eKYC **sandbox** provider (fixed OTP `123456`) | identity verification backdoor | boot refuses unless a real `EKYC_PROVIDER_KIND` + URL + strong key | assertProductionSecurity |
| `MEDIA_SCAN_SECRET` empty/weak | AV scan-result webhook unverifiable → malware marked clean | boot refuses (strong required); webhook also HMAC-fails-closed at runtime | assertProductionSecurity (P0-13) + media-links.service |
| `SANDBOX_WEBHOOK_SECRET` default | forgeable sandbox webhook | boot refuses the shared default; sandbox gateway isn't registered in prod so its webhook route 404s | assertProductionSecurity + GatewayRegistry |
| LocalStack / static S3 keys (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`) | long-lived keys / fake object store | boot refuses (IRSA only, no endpoint) | assertProductionSecurity |
| Localhost / weak-password DB & Redis | dev data store in prod | boot refuses (managed host, least-priv role, strong pw, TLS) | assertProductionSecurity |
| Demo seeds (`demo/0901…`, `demo/0902…`) | demo tenants/users in prod DB | `seed.js` skips `--demo` when `NODE_ENV=production` **and** when `DATABASE_URL` looks like a managed endpoint; `db/prod/apply.sh` force-exports `NODE_ENV=production` | seed.js (P0-13 belt-and-suspenders) + apply.sh |
| `db/local/local-login-roles.sql` | weak local login roles | never referenced by any prod pipeline; prod uses `db/prod/bootstrap-roles.sql` | repo layout (audited) |
| Noop notify / masking / stream / push providers | dropped messages (degrade) | acceptable degrade — they DROP, never leak a dev code; configured providers take over when their URL/key is set | gateway factories (config-bound) |

## Done-when (verified)
- A prod-config boot with **any** row's dev affordance enabled refuses to start (one regression test per row).
- A clean prod env boots with zero problems (`collectProductionProblems` returns `[]`).
- `pnpm typecheck` + unit suite green (170 suites / 1084 tests).
