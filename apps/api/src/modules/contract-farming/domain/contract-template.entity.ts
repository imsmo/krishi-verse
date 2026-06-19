// modules/contract-farming/domain/contract-template.entity.ts · the contract_templates aggregate.
// tenant_id may be NULL (platform-standard Model-Act 2018 template, cross-tenant visible). Legal body +
// merge-field clauses. No money. No version → repo locks FOR UPDATE (rarely edited).
import { DomainEvent, ContractFarmingEventType } from './contract-farming.events';
import { InvalidContractError } from './contract-farming.errors';

export interface ContractTemplateProps {
  id: string; tenantId: string | null; defaultName: string; categoryId: string | null; bodyTemplate: string; clauses: unknown[]; isActive: boolean; createdAt?: Date;
}
export class ContractTemplate {
  private readonly events: DomainEvent[] = [];
  private constructor(private readonly props: ContractTemplateProps) {}
  static create(input: Omit<ContractTemplateProps, 'isActive'> & { isActive?: boolean }): ContractTemplate {
    if (!input.defaultName) throw new InvalidContractError('template name required');
    if (!input.bodyTemplate) throw new InvalidContractError('template body required');
    const t = new ContractTemplate({ ...input, isActive: input.isActive ?? true });
    t.events.push({ type: ContractFarmingEventType.TemplateCreated, payload: { templateId: t.props.id } });
    return t;
  }
  static rehydrate(props: ContractTemplateProps): ContractTemplate { return new ContractTemplate(props); }
  get id() { return this.props.id; }
  pullEvents(): DomainEvent[] { const e = [...this.events]; this.events.length = 0; return e; }
  toProps(): Readonly<ContractTemplateProps> { return Object.freeze({ ...this.props }); }
  toJSON() { const v = this.props; return { id: v.id, tenantId: v.tenantId, defaultName: v.defaultName, categoryId: v.categoryId, clauses: v.clauses, isActive: v.isActive, createdAt: v.createdAt }; }
}
