# Shared Packages

68 files. Each row: **path** → layer · what to implement · DB tables · laws · priority.


---
## `config`

### `packages/config/eslint/index.js` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/config/eslint/rules/no-float-money.js` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `packages/config/eslint/rules/tenant-guard.js` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** Law6 dynamic data not code
- **Priority:** Wave 0/1

### `packages/config/package.json` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/config/prettier/index.js` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/config/tsconfig.json` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/config/tsconfig/base.json` 
- **Layer:** Package · config
- **Implement:** Shared eslint (tenant-guard, no-float-money rules), tsconfig base, prettier. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `contracts`

### `packages/contracts/package.json` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/src/dto/auctions.dto.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/src/dto/index.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/src/dto/labour.dto.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/src/dto/listings.dto.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/src/dto/orders.dto.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/dto/payments.dto.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law2 BIGINT money
- **Priority:** Wave 0/1

### `packages/contracts/src/enums/statuses.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/src/events/auctions.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/dairy.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/fintech.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/identity.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/index.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/labour.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/listings.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/livestock.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/logistics.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/orders.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/payments.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law2 BIGINT money, Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/schemes.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/events/tenancy.events.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** Law4 outbox in same txn, Law8 partition pruning
- **Priority:** Wave 0/1

### `packages/contracts/src/openapi/generate.ts` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1

### `packages/contracts/tsconfig.json` 
- **Layer:** Contracts (shared)
- **Implement:** THE API source of truth: DTO + event + enum schemas shared by api/web/mobile/sdk. A field change here propagates everywhere via the compiler. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `i18n`

### `packages/i18n/package.json` 
- **Layer:** Package · shared
- **Implement:** shared package 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `packages/i18n/src/format.ts` 
- **Layer:** Package · shared
- **Implement:** shared package 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `packages/i18n/src/languages.ts` 
- **Layer:** Package · shared
- **Implement:** shared package 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `packages/i18n/src/loader.ts` 
- **Layer:** Package · shared
- **Implement:** shared package 
- **Laws:** Law7 i18n keys
- **Priority:** see build plan

### `packages/i18n/tsconfig.json` 
- **Layer:** Package · shared
- **Implement:** shared package 
- **Laws:** Law7 i18n keys
- **Priority:** Wave 0/1


---
## `sdk-js`

### `packages/sdk-js/package.json` 
- **Layer:** Package · sdk-js
- **Implement:** Generated client SDK from OpenAPI — later published to tenant developers. 
- **Laws:** general
- **Priority:** see build plan

### `packages/sdk-js/src/index.ts` 
- **Layer:** Package · sdk-js
- **Implement:** Generated client SDK from OpenAPI — later published to tenant developers. 
- **Laws:** general
- **Priority:** see build plan

### `packages/sdk-js/tsconfig.json` 
- **Layer:** Package · sdk-js
- **Implement:** Generated client SDK from OpenAPI — later published to tenant developers. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `testing`

### `packages/testing/package.json` 
- **Layer:** Package · testing
- **Implement:** Factories, fixtures, two-tenant isolation harness, ledger zero-sum assertions. 
- **Laws:** general
- **Priority:** see build plan

### `packages/testing/src/factories.ts` 
- **Layer:** Package · testing
- **Implement:** Factories, fixtures, two-tenant isolation harness, ledger zero-sum assertions. 
- **Laws:** general
- **Priority:** see build plan

### `packages/testing/src/ledger-helpers.ts` 
- **Layer:** Package · testing
- **Implement:** Factories, fixtures, two-tenant isolation harness, ledger zero-sum assertions. 
- **Laws:** Law2 BIGINT money, Law8 partition pruning
- **Priority:** see build plan

### `packages/testing/src/tenant-helpers.ts` 
- **Layer:** Package · testing
- **Implement:** Factories, fixtures, two-tenant isolation harness, ledger zero-sum assertions. 
- **Laws:** general
- **Priority:** see build plan

### `packages/testing/tsconfig.json` 
- **Layer:** Package · testing
- **Implement:** Factories, fixtures, two-tenant isolation harness, ledger zero-sum assertions. 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `tokens`

### `packages/tokens/package.json` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** see build plan

### `packages/tokens/src/colors.ts` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** see build plan

### `packages/tokens/src/index.ts` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** see build plan

### `packages/tokens/src/spacing.ts` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** see build plan

### `packages/tokens/src/typography.ts` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** see build plan

### `packages/tokens/sync-from-design-system.js` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** see build plan

### `packages/tokens/tsconfig.json` 
- **Layer:** Package · tokens
- **Implement:** Design tokens generated from Krishi_Verse_Design_System (colors/typography/spacing). 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `ui-native`

### `packages/ui-native/package.json` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/components/Button.tsx` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/components/EmptyState.tsx` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/components/MoneyText.tsx` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/components/OtpInput.tsx` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/components/SkeletonCard.tsx` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/components/VoiceButton.tsx` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/src/index.ts` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui-native/tsconfig.json` 
- **Layer:** Package · ui-native
- **Implement:** RN component kit on tokens (VoiceButton, OtpInput, MoneyText, SkeletonCard). 
- **Laws:** general
- **Priority:** Wave 0/1


---
## `ui`

### `packages/ui/package.json` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/components/AiBadge.tsx` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/components/Button.tsx` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/components/DataTable.tsx` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/components/Input.tsx` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/components/MoneyText.tsx` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/components/StatusPill.tsx` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/src/index.ts` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** see build plan

### `packages/ui/tsconfig.json` 
- **Layer:** Package · ui
- **Implement:** Web component kit on tokens (Button, DataTable, MoneyText, AiBadge, StatusPill). 
- **Laws:** general
- **Priority:** Wave 0/1
