// core/auth/public.decorator.ts
// Marks a route as public (no authenticated user required). AuthGuard still runs
// — tenant context is resolved from the JWT if present, or from the X-Tenant-Id
// header for anonymous storefront browsing — but it will not reject a missing user.
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'is_public_route';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
