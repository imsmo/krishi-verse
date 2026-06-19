// modules/contract-farming/domain/contract-farming.events.ts · integration events (via outbox, Law 4).
export const ContractFarmingEventType = {
  TemplateCreated:   'contract_farming.template_created',
  ContractCreated:   'contract_farming.contract_created',
  ContractProposed:  'contract_farming.contract_proposed',
  ContractSigned:    'contract_farming.contract_signed',
  ContractActivated: 'contract_farming.contract_activated',
  ContractFulfilled: 'contract_farming.contract_fulfilled',
  ContractTerminated:'contract_farming.contract_terminated',
  GrowerEnrolled:    'contract_farming.grower_enrolled',
  MilestoneRecorded: 'contract_farming.milestone_recorded',
  MilestoneCompleted:'contract_farming.milestone_completed',
  AdvanceDisbursed:  'contract_farming.advance_disbursed',
  GrowerSettled:     'contract_farming.grower_settled',
} as const;
export type DomainEvent = { type: string; payload: Record<string, unknown> };

export const CONTRACT_KINDS = ['pre_sowing', 'forward', 'tripartite'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];
export const PRICE_MODELS = ['fixed', 'floor_ceiling', 'formula'] as const;
export type PriceModel = (typeof PRICE_MODELS)[number];
export const MILESTONE_TYPES = ['sowing_confirm', 'midseason', 'preharvest_estimate', 'delivery', 'payment'] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];
