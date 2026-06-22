// modules/requirements/domain/requirement.entity.ts
// Requirement aggregate — a buyer's demand post in the REVERSE marketplace (buyers post needs,
// sellers quote). Pure domain: money (budget) in bigint minor units, status transitions ONLY via the
// state machine (Law 5). NO money moves here. No version column on requirements (add_std_columns) →
// the service serializes mutations with SELECT … FOR UPDATE on the row.
import { RequirementStatus, assertTransition, isAcceptingResponses } from './requirement.state';
import { RequirementEventType, DomainEvent } from './requirements.events';
import { InvalidRequirementError, RequirementNotOpenError } from './requirements.errors';

export interface RequirementProps {
  id: string; tenantId: string; buyerUserId: string; productId: string | null; categoryId: string | null;
  title: string; quantity: string; unitCode: string;
  budgetMinMinor: bigint | null; budgetMaxMinor: bigint | null; currencyCode: string;
  needBy: Date | null; deliveryPincode: string | null; status: RequirementStatus; isUrgent: boolean; createdAt: Date;
}
const QTY_RE = /^\d{1,11}(\.\d{1,3})?$/;

export class Requirement {
  private readonly events: DomainEvent[] = [];
  private constructor(private props: RequirementProps) {}

  static post(input: {
    id: string; tenantId: string; buyerUserId: string; productId?: string | null; categoryId?: string | null;
    title: string; quantity: string; unitCode: string; budgetMinMinor?: bigint | null; budgetMaxMinor?: bigint | null;
    currencyCode?: string; needBy?: Date | null; deliveryPincode?: string | null; isUrgent?: boolean; now?: Date;
  }): Requirement {
    const now = input.now ?? new Date();
    if (!QTY_RE.test(input.quantity) || Number(input.quantity) <= 0) throw new InvalidRequirementError('quantity must be a positive number (max 3 decimals)');
    if (!input.title?.trim()) throw new InvalidRequirementError('title is required');
    if (input.budgetMinMinor != null && input.budgetMinMinor < 0n) throw new InvalidRequirementError('budget cannot be negative');
    if (input.budgetMaxMinor != null && input.budgetMaxMinor < 0n) throw new InvalidRequirementError('budget cannot be negative');
    if (input.budgetMinMinor != null && input.budgetMaxMinor != null && input.budgetMinMinor > input.budgetMaxMinor) throw new InvalidRequirementError('budget_min cannot exceed budget_max');
    const r = new Requirement({
      id: input.id, tenantId: input.tenantId, buyerUserId: input.buyerUserId, productId: input.productId ?? null, categoryId: input.categoryId ?? null,
      title: input.title.trim(), quantity: input.quantity, unitCode: input.unitCode, budgetMinMinor: input.budgetMinMinor ?? null,
      budgetMaxMinor: input.budgetMaxMinor ?? null, currencyCode: input.currencyCode ?? 'INR', needBy: input.needBy ?? null,
      deliveryPincode: input.deliveryPincode ?? null, status: 'open', isUrgent: input.isUrgent ?? false, createdAt: now,
    });
    r.events.push({ type: RequirementEventType.Posted, payload: { requirementId: r.props.id, buyerUserId: r.props.buyerUserId, categoryId: r.props.categoryId, productId: r.props.productId } });
    return r;
  }
  static rehydrate(props: RequirementProps): Requirement { return new Requirement(props); }

  get id() { return this.props.id; }
  get status() { return this.props.status; }
  get buyerUserId() { return this.props.buyerUserId; }
  get needBy() { return this.props.needBy; }
  toProps(): Readonly<RequirementProps> { return Object.freeze({ ...this.props }); }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }

  /** First shortlist moves an open requirement to partially_matched (idempotent if already there). */
  markPartiallyMatched(): void {
    if (this.props.status !== 'open') return;
    this.to('partially_matched', RequirementEventType.PartiallyMatched, {});
  }
  /** A quote was accepted — the requirement is fulfilled (the order is created downstream). */
  fulfill(acceptedResponseId: string): void {
    if (!isAcceptingResponses(this.props.status)) throw new RequirementNotOpenError(this.props.status);
    this.to('fulfilled', RequirementEventType.Fulfilled, { acceptedResponseId });
  }
  /** Worker job: lapse a requirement past its need_by. */
  expire(): void {
    if (!isAcceptingResponses(this.props.status)) throw new RequirementNotOpenError(this.props.status);
    this.to('expired', RequirementEventType.Expired, {});
  }
  /** Buyer withdraws the requirement. */
  close(): void {
    if (!isAcceptingResponses(this.props.status)) throw new RequirementNotOpenError(this.props.status);
    this.to('closed', RequirementEventType.Closed, {});
  }

  /** Buyer edits an OPEN/partially-matched requirement (status unchanged). Re-validates every invariant
   *  on the way in (no mass-assignment past the DTO; never trusts the caller). Emits Updated. `undefined`
   *  fields are left as-is; explicit `null` clears a nullable field. */
  editDetails(patch: {
    title?: string; quantity?: string; unitCode?: string; productId?: string | null; categoryId?: string | null;
    budgetMinMinor?: bigint | null; budgetMaxMinor?: bigint | null; needBy?: Date | null; deliveryPincode?: string | null; isUrgent?: boolean;
  }): void {
    if (!isAcceptingResponses(this.props.status)) throw new RequirementNotOpenError(this.props.status);
    const next = { ...this.props };
    if (patch.title !== undefined) { if (!patch.title.trim()) throw new InvalidRequirementError('title is required'); next.title = patch.title.trim(); }
    if (patch.quantity !== undefined) { if (!QTY_RE.test(patch.quantity) || Number(patch.quantity) <= 0) throw new InvalidRequirementError('quantity must be a positive number (max 3 decimals)'); next.quantity = patch.quantity; }
    if (patch.unitCode !== undefined) { if (!patch.unitCode.trim()) throw new InvalidRequirementError('unitCode is required'); next.unitCode = patch.unitCode; }
    if (patch.productId !== undefined) next.productId = patch.productId;
    if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
    if (patch.budgetMinMinor !== undefined) next.budgetMinMinor = patch.budgetMinMinor;
    if (patch.budgetMaxMinor !== undefined) next.budgetMaxMinor = patch.budgetMaxMinor;
    if (patch.needBy !== undefined) next.needBy = patch.needBy;
    if (patch.deliveryPincode !== undefined) next.deliveryPincode = patch.deliveryPincode;
    if (patch.isUrgent !== undefined) next.isUrgent = patch.isUrgent;
    if (next.budgetMinMinor != null && next.budgetMinMinor < 0n) throw new InvalidRequirementError('budget cannot be negative');
    if (next.budgetMaxMinor != null && next.budgetMaxMinor < 0n) throw new InvalidRequirementError('budget cannot be negative');
    if (next.budgetMinMinor != null && next.budgetMaxMinor != null && next.budgetMinMinor > next.budgetMaxMinor) throw new InvalidRequirementError('budget_min cannot exceed budget_max');
    this.props = next;
    this.events.push({ type: RequirementEventType.Updated, payload: { requirementId: this.props.id, categoryId: this.props.categoryId, productId: this.props.productId } });
  }

  private to(status: RequirementStatus, evt: string, payload: Record<string, unknown>): void {
    assertTransition(this.props.status, status);
    this.props.status = status;
    this.events.push({ type: evt, payload: { requirementId: this.props.id, ...payload } });
  }
}
