// modules/contract-farming/policies/contract-farming.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded 0004).
//   contract.manage — the BUYER (corporate/processor/FPO): create templates + contracts, enrol growers,
//                     record milestones, disburse input advances, settle growers.
//   contract.grow   — a grower (farmer) view-only of the contracts they are enrolled on (reads).
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const ContractFarmingPermissions = { Manage: 'contract.manage', Grow: 'contract.grow' } as const;
export const canManageContracts = (ctx: RequestContext) => ctx.permissions.has('contract.manage') || ctx.permissions.has('*');
export const isContractAdmin = (ctx: RequestContext) => ctx.permissions.has('booking.manage') || ctx.permissions.has('*');
