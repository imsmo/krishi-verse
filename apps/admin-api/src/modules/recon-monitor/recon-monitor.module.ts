// apps/admin-api/src/modules/recon-monitor/recon-monitor.module.ts · the god-mode MONEY-SAFETY plane (Law 11 +
// Law 9). Owns: the wallet reconciliation dashboard (read-only zero-sum + recon-run health), mismatch
// investigations (workflow over a reconciliation alarm), and the emergency account FREEZE control (flips
// wallet_accounts.is_frozen — NEVER a ledger posting; money moves only via the wallet-service). Mounts under
// AdminCoreModule (auth/RBAC/FIDO2/step-up/audit are @Global).
import { Module } from '@nestjs/common';
import { ReconMonitorController } from './recon-monitor.controller';
import { ReconRepository } from './repositories/recon.repository';
import { WalletReconDashboardService } from './services/wallet-recon-dashboard.service';
import { MismatchInvestigationsService } from './services/mismatch-investigations.service';
import { LedgerFreezeControlsService } from './services/ledger-freeze-controls.service';

@Module({
  controllers: [ReconMonitorController],
  providers: [ReconRepository, WalletReconDashboardService, MismatchInvestigationsService, LedgerFreezeControlsService],
})
export class ReconMonitorModule {}
