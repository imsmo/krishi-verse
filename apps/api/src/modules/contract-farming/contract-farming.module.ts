// modules/contract-farming/contract-farming.module.ts
// Contract Farming (PRD M22): a corporate/processor BUYER contracts FPO/grower farmers to produce a crop at
// an agreed price. The buyer disburses INPUT ADVANCES (seed/inputs) to growers and, at harvest, SETTLES each
// grower — paying for the delivered quantity at the contract price, automatically RECOVERING outstanding
// advances. Both money moves go through the wallet boundary (buyer userMain → grower userMain, txnType
// 'contract_payment', zero-sum + idempotent — Law 2). Gated by the `contract_farming` feature flag (default OFF).
//
// SCOPE (this build): contract templates (incl. platform-standard Model-Act, cross-tenant visible) +
// farming contracts (draft→proposed→signed→active→fulfilled) + grower enrolment + milestones (geo-photo
// tracking) + input-advance disbursement + grower settlement (FIXED price, advance recovery).
// DEFERRED (schema in 0010, not wired): floor_ceiling / formula pricing + quality premium-discount slabs,
// tripartite financier/bank flow, e-sign envelope integration, negotiating/breached/disputed states,
// milestone-due reminder job, contract-from-order linkage, land_parcels FK (land-soil-weather module).
import { Module } from '@nestjs/common';
import { ContractsController } from './controllers/v1/contracts.controller';
import { GrowersController } from './controllers/v1/growers.controller';
import { MilestonesController } from './controllers/v1/milestones.controller';
import { ContractTemplateService } from './services/contract-template.service';
import { FarmingContractService } from './services/farming-contract.service';
import { ContractGrowerService } from './services/contract-grower.service';
import { ContractMilestoneService } from './services/contract-milestone.service';
import { InputAdvanceService } from './services/input-advance.service';
import { ContractTemplateRepository } from './repositories/contract-template.repository';
import { FarmingContractRepository } from './repositories/farming-contract.repository';
import { ContractGrowerRepository } from './repositories/contract-grower.repository';
import { ContractMilestoneRepository } from './repositories/contract-milestone.repository';
import { InputAdvanceRepository } from './repositories/input-advance.repository';

@Module({
  controllers: [ContractsController, GrowersController, MilestonesController],
  providers: [
    ContractTemplateService, FarmingContractService, ContractGrowerService, ContractMilestoneService, InputAdvanceService,
    ContractTemplateRepository, FarmingContractRepository, ContractGrowerRepository, ContractMilestoneRepository, InputAdvanceRepository,
  ],
  exports: [ContractTemplateService, FarmingContractService, ContractGrowerService, ContractMilestoneService, InputAdvanceService],
})
export class ContractFarmingModule {}
