// apps/admin-api/src/modules/providers-ops/domain/provider.entity.ts · the integration-provider registry entry
// (pure, no I/O). The only mutation is the platform-wide ENABLE/DISABLE toggle (Law 12 — pull a failing provider
// out of rotation; payments/comm degrade to alternatives). enable/disable reject a no-op (already-in-state → 409)
// so the audit trail only records real changes. Carries NO secret material — credentials live in the vault,
// referenced (never read) by tenant_integrations.secret_ref.
import { ProviderCategory } from './category';
import { ProviderAlreadyInStateError } from './providers-ops.errors';

export interface ProviderProps {
  code: string;
  defaultName: string;
  category: ProviderCategory | string;
  isActive: boolean;
  createdAt?: Date | null;
}
export interface ProviderChange { action: 'enabled' | 'disabled'; oldValue: { isActive: boolean }; newValue: { isActive: boolean }; }

export class IntegrationProvider {
  private constructor(private p: ProviderProps) {}
  static rehydrate(p: ProviderProps): IntegrationProvider { return new IntegrationProvider(p); }

  get code(): string { return this.p.code; }
  get isActive(): boolean { return this.p.isActive; }

  private set(to: boolean): ProviderChange {
    if (this.p.isActive === to) throw new ProviderAlreadyInStateError(this.p.code, to);
    const from = this.p.isActive; this.p.isActive = to;
    return { action: to ? 'enabled' : 'disabled', oldValue: { isActive: from }, newValue: { isActive: to } };
  }
  enable(): ProviderChange { return this.set(true); }
  disable(): ProviderChange { return this.set(false); }

  toJSON() {
    return { code: this.p.code, defaultName: this.p.defaultName, category: this.p.category, isActive: this.p.isActive, createdAt: this.p.createdAt ?? null };
  }
}
