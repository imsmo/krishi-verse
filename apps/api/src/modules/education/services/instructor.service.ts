// modules/education/services/instructor.service.ts · become/manage an instructor profile.
// Idempotent: a user has at most one instructor row per tenant (return the existing one). royalty_bps is NOT
// client-settable here (defaults to the playbook 80%); changing it is an admin/Law-11 concern. authz THROWS.
import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, UnitOfWork } from '../../../core/database/unit-of-work';
import { METRICS, Metrics, timed } from '../../../core/observability/metrics';
import { uuidv7 } from '../../../core/database/uuid.util';
import { Instructor } from '../domain/instructor.entity';
import { InstructorRepository } from '../repositories/instructor.repository';
import { InstructorNotFoundError, EducationForbiddenError } from '../domain/education.errors';

export interface EducationActor { userId: string; canAuthor: boolean; canPublish: boolean; isAdmin: boolean; canHost: boolean; canModerate: boolean; }

@Injectable()
export class InstructorService {
  constructor(
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
    @Inject(METRICS) private readonly metrics: Metrics,
    private readonly repo: InstructorRepository,
  ) {}

  async become(tenantId: string, actor: EducationActor, bio: string | null) {
    if (!actor.canAuthor) throw new EducationForbiddenError('requires course.author');
    return timed(this.metrics, 'education.instructor.become', { tenant: tenantId }, () =>
      this.uow.run(tenantId, async (tx) => {
        const existing = await this.repo.findByUser(tenantId, actor.userId, tx);
        if (existing) { existing.update({ bio }); await this.repo.update(tx, existing, tenantId); return existing.toJSON(); }
        const i = Instructor.create({ id: uuidv7(), userId: actor.userId, tenantId, bio });
        await this.repo.insert(tx, i, tenantId);
        return i.toJSON();
      }, { userId: actor.userId }));
  }
  async getMine(tenantId: string, actor: EducationActor) {
    const i = await this.repo.findByUser(tenantId, actor.userId);
    if (!i) throw new InstructorNotFoundError('me');
    return i.toJSON();
  }
}
