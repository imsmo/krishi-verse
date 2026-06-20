// modules/services-marketplace/policies/services-marketplace.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   service.offer — a provider lists/manages their service offerings + drives the booking lifecycle.
//   service.book  — a customer requests + completes-and-pays bookings.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const ServicesPermissions = { Offer: 'service.offer', Book: 'service.book' } as const;
export const canOffer = (ctx: RequestContext) => ctx.permissions.has('service.offer') || ctx.permissions.has('*');
export const canBook = (ctx: RequestContext) => ctx.permissions.has('service.book') || ctx.permissions.has('*');
export const isServicesAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
