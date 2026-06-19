// modules/livestock/policies/livestock.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   animal.manage — a farmer/pashupalak manages their OWN animal registry.
//   vet.book      — a farmer books a vet + pays the fee.
//   vet.manage    — a veterinarian manages their own profile + service catalog + drives the booking lifecycle.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const LivestockPermissions = { AnimalManage: 'animal.manage', VetBook: 'vet.book', VetManage: 'vet.manage' } as const;
export const canManageAnimals = (ctx: RequestContext) => ctx.permissions.has('animal.manage') || ctx.permissions.has('*');
export const canBookVet = (ctx: RequestContext) => ctx.permissions.has('vet.book') || ctx.permissions.has('*');
export const canManageVet = (ctx: RequestContext) => ctx.permissions.has('vet.manage') || ctx.permissions.has('*');
export const isLivestockAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
