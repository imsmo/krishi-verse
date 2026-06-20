// modules/education/domain/instructor.entity.ts · the instructors aggregate. royalty_bps = the instructor's
// revenue share in basis points (default 8000 = 80% per the Revenue Playbook). Platform-scoped instructors
// (tenant_id NULL, e.g. KVK) are created only via admin (Law 11) — never through the tenant API.
import { InvalidRoyaltyError } from './education.errors';

export interface InstructorProps {
  id: string; userId: string; tenantId: string | null; bio: string | null; royaltyBps: number; isVerified: boolean; createdAt?: Date;
}
export class Instructor {
  private constructor(private props: InstructorProps) {}
  static create(input: Omit<InstructorProps, 'isVerified' | 'royaltyBps'> & { royaltyBps?: number }): Instructor {
    const bps = input.royaltyBps ?? 8000;
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000) throw new InvalidRoyaltyError(bps);
    return new Instructor({ ...input, royaltyBps: bps, isVerified: false });
  }
  static rehydrate(p: InstructorProps): Instructor { return new Instructor(p); }
  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get royaltyBps() { return this.props.royaltyBps; }
  get isVerified() { return this.props.isVerified; }
  toProps(): Readonly<InstructorProps> { return Object.freeze({ ...this.props }); }
  update(patch: { bio?: string | null }): void { if (patch.bio !== undefined) this.props.bio = patch.bio; }
  toJSON() { const v = this.props; return { id: v.id, userId: v.userId, bio: v.bio, royaltyBps: v.royaltyBps, isVerified: v.isVerified, createdAt: v.createdAt }; }
}
