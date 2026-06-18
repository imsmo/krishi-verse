// modules/memberships/memberships.module.ts
// Memberships (PRD M13): subscription tiers (free or wallet-paid) with a benefits bundle, and user
// subscriptions. Tier admin (membership.manage) + self-serve subscribe/renew/cancel. Paid tiers DEBIT the
// wallet (userMain → platform fees) via the wallet boundary (Law 2); free tiers move no money. Gated by
// the `memberships` feature flag (default OFF).
//
// SCOPE: this build ships the tier + subscription engine (wallet-paid). The card-payment activation path
// (payment intent → payments.payment_succeeded → activate) is left as a documented stub
// (events/handlers/payment-succeeded.handler.ts); auto-renew (stored-mandate wallet auto-debit) and the
// charge-engine member-fee override are deferred.
import { Module } from '@nestjs/common';
import { MembershipTiersController } from './controllers/v1/membership-tiers.controller';
import { MembershipsController } from './controllers/v1/memberships.controller';
import { MembershipTierService } from './services/membership-tier.service';
import { UserMembershipService } from './services/user-membership.service';
import { MembershipTierRepository } from './repositories/membership-tier.repository';
import { UserMembershipRepository } from './repositories/user-membership.repository';

// The expiry worker job (jobs/membership-renewals.job.ts) is instantiated by apps/worker with a
// privileged kv_relay Pool — not a DI provider (it takes a Pool), mirroring the other expiry jobs.
@Module({
  controllers: [MembershipTiersController, MembershipsController],
  providers: [MembershipTierService, UserMembershipService, MembershipTierRepository, UserMembershipRepository],
  exports: [MembershipTierService, UserMembershipService],
})
export class MembershipsModule {}
