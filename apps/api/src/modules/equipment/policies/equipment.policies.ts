// modules/equipment/policies/equipment.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   equipment.manage — an equipment owner / CHC operator: list assets, set rate cards, quote/start/
//                       complete/settle bookings on their OWN assets.
//   equipment.rent   — a renter: request a booking, confirm (escrow), cancel their own.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const EquipmentPermissions = { Manage: 'equipment.manage', Rent: 'equipment.rent' } as const;
export const canManageEquipment = (ctx: RequestContext) => ctx.permissions.has('equipment.manage') || ctx.permissions.has('*');
export const canRentEquipment = (ctx: RequestContext) => ctx.permissions.has('equipment.rent') || ctx.permissions.has('*');
export const isEquipmentAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
