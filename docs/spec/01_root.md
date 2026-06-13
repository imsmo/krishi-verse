# Root & Workspace

34 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `root`

### `CLAUDE.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `CODEOWNERS` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `FILE_MANIFEST.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `README.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `api`

### `apps/api/Dockerfile` 
- **Layer:** App Config
- **Implement:** Build/runtime config. .env.example documents every variable; prod values come from Secrets Manager. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/jest.config.js` 
- **Layer:** App Config
- **Implement:** Build/runtime config. .env.example documents every variable; prod values come from Secrets Manager. 
- **Laws:** general
- **Priority:** Wave 0/1

### `apps/api/nest-cli.json` 
- **Layer:** App Config
- **Implement:** Build/runtime config. .env.example documents every variable; prod values come from Secrets Manager. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/package.json` 
- **Layer:** App Config
- **Implement:** Build/runtime config. .env.example documents every variable; prod values come from Secrets Manager. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/app.module.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** Law10 feature flag
- **Priority:** see build plan

### `apps/api/src/main.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/router.v1.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/constants/limits.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/errors/app-error.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/errors/error-codes.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/pagination/cursor.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/types/common.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/utils/dates.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/utils/money.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/src/shared/utils/phone.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/test/e2e/smoke.e2e-spec.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/test/factories/index.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/test/integration/db-connection.int-spec.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/test/tenant-isolation.global.e2e.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `apps/api/tsconfig.json` 
- **Layer:** App Config
- **Implement:** Build/runtime config. .env.example documents every variable; prod values come from Secrets Manager. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `root`

### `docker-compose.yml` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan

### `package.json` 
- **Layer:** App Config
- **Implement:** Build/runtime config. .env.example documents every variable; prod values come from Secrets Manager. 
- **Laws:** general
- **Priority:** see build plan

### `pnpm-workspace.yaml` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `codegen`

### `tools/codegen/generate-module.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** Law10 feature flag
- **Priority:** see build plan

### `tools/codegen/generate-sdk.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `eslint-rules`

### `tools/eslint-rules/README.md` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** Law6 dynamic data not code
- **Priority:** see build plan


---
## `scripts`

### `tools/scripts/check-module-boundaries.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** Law10 feature flag
- **Priority:** see build plan

### `tools/scripts/screen-coverage.ts` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `tools/scripts/verify-structure.sh` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan


---
## `root`

### `turbo.json` 
- **Layer:** File
- **Implement:** See purpose header in file. 
- **Laws:** general
- **Priority:** see build plan
