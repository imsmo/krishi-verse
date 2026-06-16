// modules/identity/events/handlers/dispute-resolved.handler.ts
// A dispute lost against a user is a negative trust signal → record a risk event.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../core/database/unit-of-work';
import { RiskScoreRepository } from '../../repositories/risk-score.repository';

interface DisputeResolvedV1 { v: 1; tenantId: string; againstUserId: string; disputeId: string; lost: boolean; }

@Injectable()
export class DisputeResolvedHandler {
  constructor(@Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork, private readonly risk: RiskScoreRepository) {}
  async handle(evt: DisputeResolvedV1): Promise<void> {
    if (!evt.lost) return;
    await this.uow.run(evt.tenantId, (tx) => this.risk.recordEvent(tx, { tenantId: evt.tenantId, userId: evt.againstUserId, eventCode: 'dispute_lost', weight: -15, referenceType: 'dispute', referenceId: evt.disputeId }));
  }
}
