// modules/listings/domain/group-lot.state.ts · FPO group-lot state machine (Law 5).
import { DomainError } from '../../../shared/errors/app-error';
export const GROUP_LOT_STATUSES = ['pledging','ready','listed','sold','settled','cancelled'] as const;
export type GroupLotStatus = (typeof GROUP_LOT_STATUSES)[number];
const T: Record<GroupLotStatus, GroupLotStatus[]> = {
  pledging: ['ready','cancelled'], ready: ['listed','pledging','cancelled'],
  listed: ['sold','cancelled'], sold: ['settled'], settled: [], cancelled: [],
};
export function assertGroupLotTransition(from: GroupLotStatus, to: GroupLotStatus) {
  if (!T[from]?.includes(to))
    throw new DomainError('GROUP_LOT_ILLEGAL_TRANSITION', `Cannot move group lot ${from}->${to}`, 409, { from, to });
}
