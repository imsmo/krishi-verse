// modules/fintech/policies/fintech.policies.ts · permission keys (DB-backed RBAC, Law 6; seeded in 0004).
//   loan.borrow — a farmer applies for / repays loans on their own account.
//   loan.manage — the lender officer (banker / FPO admin): review, approve/reject, disburse applications.
// Browsing partners + loan products (global reference data) is any authenticated tenant user.
import { RequestContext } from '../../../core/tenancy-context/request-context';
export const FintechPermissions = { Borrow: 'loan.borrow', Manage: 'loan.manage' } as const;
export const canBorrow = (ctx: RequestContext) => ctx.permissions.has('loan.borrow') || ctx.permissions.has('*');
export const canManageLoans = (ctx: RequestContext) => ctx.permissions.has('loan.manage') || ctx.permissions.has('*');
