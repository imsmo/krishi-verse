// modules/identity/dto/onboard-role.dto.ts · POST /v1/onboarding/roles (KV-BL-066).
// `role` is intentionally a free string (not z.enum(['farmer','customer'])): rejecting an
// ineligible role at the zod layer would only surface a generic 400/validation error, whereas
// the service can look the code up and return a typed 403 that distinguishes platform-role /
// invite-only / not-yet-GA / unknown — much better UX for the app's role picker. The pilot
// allow-list itself lives in onboarding.service.ts (SELF_SERVE_ALLOWED), not here.
import { z } from 'zod';
export const OnboardRoleSchema = z.object({
  role: z.string().trim().min(2).max(50),
}).strict();
export type OnboardRoleDto = z.infer<typeof OnboardRoleSchema>;
