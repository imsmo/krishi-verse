// modules/payments/domain/settlement-statement.entity.ts · a seller's settlement statement for one billing cycle
// (0006 settlement_statements). Pure TS value object. ALL bigint minor units. Enforces the zero-sum invariant the
// payout depends on: net = gross − commission − tax. The statement is DERIVED from settlement_lines (the worker
// aggregates them); this object is the validated, immutable result the generator + tests reason about.
import { SettlementConfigError } from './commission.errors';

export interface SettlementStatementProps {
  id: string; tenantId: string; sellerUserId: string; statementNo: string; periodStart: string; periodEnd: string;
  grossMinor: bigint; commissionMinor: bigint; taxMinor: bigint; netMinor: bigint; createdAt?: Date | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;   // accepts YYYY-MM-DD (and ISO timestamps — only the day is significant)
function nonNeg(v: bigint, label: string): bigint { if (typeof v !== 'bigint' || v < 0n) throw new SettlementConfigError({ [label]: String(v) }); return v; }

export class SettlementStatement {
  private constructor(private p: SettlementStatementProps) {}

  /** Build from an aggregate; validates non-negativity, the period window, and net = gross − commission − tax. */
  static fromAggregate(input: Omit<SettlementStatementProps, 'netMinor'> & { netMinor?: bigint }): SettlementStatement {
    if (!DATE_RE.test(input.periodStart) || !DATE_RE.test(input.periodEnd)) throw new SettlementConfigError({ period: `${input.periodStart}..${input.periodEnd}` });
    if (input.periodStart.slice(0, 10) >= input.periodEnd.slice(0, 10)) throw new SettlementConfigError({ period: 'start must be before end' });
    const gross = nonNeg(input.grossMinor, 'grossMinor');
    const commission = nonNeg(input.commissionMinor, 'commissionMinor');
    const tax = nonNeg(input.taxMinor, 'taxMinor');
    const net = gross - commission - tax;
    if (net < 0n) throw new SettlementConfigError({ grossMinor: String(gross), commissionMinor: String(commission), taxMinor: String(tax) });
    if (input.netMinor !== undefined && input.netMinor !== net) throw new SettlementConfigError({ expectedNet: String(net), gotNet: String(input.netMinor) });
    return new SettlementStatement({ ...input, netMinor: net });
  }
  static rehydrate(p: SettlementStatementProps): SettlementStatement { return new SettlementStatement(p); }

  get id() { return this.p.id; }
  get netMinor() { return this.p.netMinor; }
  /** Nothing to pay out (a zero-net cycle) — the generator/job can skip emitting a payout. */
  get isZero() { return this.p.netMinor === 0n; }
  toProps(): Readonly<SettlementStatementProps> { return Object.freeze({ ...this.p }); }
  toJSON() {
    return { id: this.p.id, statementNo: this.p.statementNo, sellerUserId: this.p.sellerUserId, periodStart: this.p.periodStart, periodEnd: this.p.periodEnd,
      grossMinor: this.p.grossMinor.toString(), commissionMinor: this.p.commissionMinor.toString(), taxMinor: this.p.taxMinor.toString(), netMinor: this.p.netMinor.toString() };
  }
}
