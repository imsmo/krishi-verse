// apps/wallet-service/src/core/config/wallet-config.ts · the ONLY place process.env is read in the money service.
// Fail-closed (§4): in production it refuses to boot without a kv_wallet DB URL — the money authority must never
// start mis-wired. Plain class (no framework) so the ledger core stays dependency-light.
import { readWalletEnv, WalletEnv } from './env.validation';

export class WalletConfig {
  readonly env: WalletEnv;
  constructor(raw: Record<string, unknown> = process.env) {
    this.env = readWalletEnv(raw);
    this.assertProductionSecurity();
  }
  private assertProductionSecurity(): void {
    if (this.env.NODE_ENV !== 'production') return;
    const problems: string[] = [];
    if (!this.env.DATABASE_WALLET_URL) problems.push('DATABASE_WALLET_URL must be set (kv_wallet role)');
    if (/(^|:)(postgres|password|changeme)@/i.test(this.env.DATABASE_WALLET_URL)) problems.push('DATABASE_WALLET_URL must not use a default/dev password');
    if (problems.length) throw new Error(`FATAL: insecure wallet-service config -> ${problems.join('; ')}`);
  }
  get isProd() { return this.env.NODE_ENV === 'production'; }
}
