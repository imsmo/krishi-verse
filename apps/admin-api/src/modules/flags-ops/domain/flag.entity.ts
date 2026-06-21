// apps/admin-api/src/modules/flags-ops/domain/flag.entity.ts · the feature-flag aggregate (pure, no I/O). It is
// the ONLY place flag invariants + the kill-switch LOCK are enforced (Law 10): a locked flag refuses enable /
// rollout / targeting changes until explicitly unlocked. Every mutator returns a ChangeRecord (action + old→new)
// the service writes to feature_flag_changes + audit_log in the same tx. rollout_pct is an int 0..100; targeting
// `rules` are the persisted snake_case shape the runtime evaluator reads.
import { TargetingRules, assertRolloutPct } from './rollout';
import { FlagLockedError, FlagNotLockedError } from './flags-ops.errors';

export type FlagChangeAction = 'created' | 'enabled' | 'disabled' | 'rollout_changed' | 'targeting_changed' | 'killed' | 'unlocked';

export interface FlagProps {
  key: string;
  description: string | null;
  isEnabled: boolean;
  rolloutPct: number;
  rules: TargetingRules;
  isLocked: boolean;
  createdAt?: Date | null;
}

export interface ChangeRecord { action: FlagChangeAction; oldValue: Record<string, unknown>; newValue: Record<string, unknown>; }

export class FeatureFlag {
  private constructor(private p: FlagProps) {}
  static rehydrate(p: FlagProps): FeatureFlag { return new FeatureFlag(p); }

  get key(): string { return this.p.key; }
  get isLocked(): boolean { return this.p.isLocked; }
  get isEnabled(): boolean { return this.p.isEnabled; }

  private assertUnlocked(): void { if (this.p.isLocked) throw new FlagLockedError(this.p.key); }

  /** Turn the flag ON (subject to rollout/targeting). Refused while kill-switch locked. */
  enable(): ChangeRecord {
    this.assertUnlocked();
    const old = this.p.isEnabled; this.p.isEnabled = true;
    return { action: 'enabled', oldValue: { isEnabled: old }, newValue: { isEnabled: true } };
  }
  /** Turn the flag OFF for everyone (allowed always — only ever reduces exposure). */
  disable(): ChangeRecord {
    const old = this.p.isEnabled; this.p.isEnabled = false;
    return { action: 'disabled', oldValue: { isEnabled: old }, newValue: { isEnabled: false } };
  }
  /** Set the deterministic percentage rollout (0..100). Refused while locked. */
  setRollout(pct: number): ChangeRecord {
    this.assertUnlocked();
    assertRolloutPct(pct);
    const old = this.p.rolloutPct; this.p.rolloutPct = pct;
    return { action: 'rollout_changed', oldValue: { rolloutPct: old }, newValue: { rolloutPct: pct } };
  }
  /** Replace the targeting allowlist (already validated/normalised by the caller). Refused while locked. */
  setTargeting(rules: TargetingRules): ChangeRecord {
    this.assertUnlocked();
    const old = this.p.rules; this.p.rules = rules;
    return { action: 'targeting_changed', oldValue: { rules: old }, newValue: { rules } };
  }
  /** KILL-SWITCH (Law 10): disable for everyone AND lock so nobody can re-enable until unlocked. Always allowed. */
  kill(): ChangeRecord {
    const old = { isEnabled: this.p.isEnabled, isLocked: this.p.isLocked };
    this.p.isEnabled = false; this.p.isLocked = true;
    return { action: 'killed', oldValue: old, newValue: { isEnabled: false, isLocked: true } };
  }
  /** Release the kill-switch lock (does NOT re-enable — a deliberate separate step). */
  unlock(): ChangeRecord {
    if (!this.p.isLocked) throw new FlagNotLockedError(this.p.key);
    this.p.isLocked = false;
    return { action: 'unlocked', oldValue: { isLocked: true }, newValue: { isLocked: false } };
  }

  snapshot() { return { isEnabled: this.p.isEnabled, rolloutPct: this.p.rolloutPct, rules: this.p.rules }; }
  toJSON() {
    return { key: this.p.key, description: this.p.description, isEnabled: this.p.isEnabled, rolloutPct: this.p.rolloutPct, rules: this.p.rules, isLocked: this.p.isLocked, createdAt: this.p.createdAt ?? null };
  }
}
