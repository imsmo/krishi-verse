// modules/livestock/__tests__/livestock.integration.spec.ts
// REAL end-to-end proof of the livestock spine against a live Postgres:
//   1. a farmer registers an animal (FK-validated species/breed from seeded taxonomy);
//   2. a vet self-registers + publishes a priced service (₹300 consult);
//   3. the farmer books that service (fee SNAPSHOTTED from the service price) → vet accepts → in_consult →
//      the farmer COMPLETES+PAYS: the wallet moves farmer → vet (zero-sum, txnType service_fee), booking paid;
//   4. ROW-LEVEL SECURITY: tenant B cannot see tenant A's vet booking.
// Schema/seeds come from the REAL db/migrations + db/seeds (test/integration-global-setup.js).
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { makeTenant, makeUser } from '../../../../test/helpers/fixtures';

import { AppConfig } from '../../../core/config/app-config';
import { PgPoolProvider } from '../../../core/database/pg-pool.provider';
import { ShardRouter } from '../../../core/sharding/shard-router';
import { PgUnitOfWork } from '../../../core/database/unit-of-work.pg';
import { PgReadReplicaProvider } from '../../../core/database/read-replica.pg';
import { PgOutboxWriter } from '../../../core/outbox/outbox.writer.pg';
import { PgIdempotencyService } from '../../../core/idempotency/idempotency.service.pg';
import { PromMetrics } from '../../../core/observability/metrics.prom';
import { LedgerRepository } from '../../../core/wallet/ledger.repository';
import { InProcessWalletClient } from '../../../core/wallet/wallet.client.inprocess';
import { userMain, platform, PlatformAccount } from '../../../core/wallet/account-codes';
import { QuotaService } from '../../../core/quota/quota.service';

import { AnimalRepository } from '../repositories/animal.repository';
import { AnimalSpeciesRepository } from '../repositories/animal-species.repository';
import { AnimalBreedRepository } from '../repositories/animal-breed.repository';
import { VetProfileRepository } from '../repositories/vet-profile.repository';
import { VetServiceRepository } from '../repositories/vet-service.repository';
import { VetBookingRepository } from '../repositories/vet-booking.repository';
import { AnimalService } from '../services/animal.service';
import { VetService } from '../services/vet.service';
import { VetBookingService } from '../services/vet-booking.service';

const APP_URL = process.env.DATABASE_URL;
const ADMIN_URL = process.env.DATABASE_ADMIN_URL;
const run = APP_URL ? describe : describe.skip;
class AllowAllQuota extends QuotaService { async assertWithinLimit(): Promise<void> {} async increment(): Promise<void> {} }

run('livestock spine (integration, real Postgres + RLS + vet fee settlement)', () => {
  let pools: PgPoolProvider; let admin: Pool; let inspect: Pool;
  let animals: AnimalService; let vets: VetService; let bookings: VetBookingService; let wallet: InProcessWalletClient; let uow: PgUnitOfWork;

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const farmer = randomUUID();
  const vetUser = randomUUID();
  let speciesId = ''; let breedId = ''; let vetId = ''; let serviceId = ''; let animalId = ''; let bookingId = '';
  const farmerActor = { userId: farmer, canBook: true, canManageVet: false, isAdmin: false, canManage: true };
  const vetActor = { userId: vetUser, canBook: false, canManageVet: true, isAdmin: false };

  const bal = async (userId: string) =>
    BigInt((await admin.query(`SELECT COALESCE(cached_balance_minor,0) b FROM wallet_accounts WHERE owner_kind='user' AND account_code='main' AND owner_user_id=$1`, [userId])).rows[0]?.b ?? '0');
  const fund = (u: string, amount: bigint) => uow.run(tenantA, (tx) => wallet.post(tx, { tenantId: tenantA, txnType: 'order_payment', idempotencyKey: `fund:${randomUUID()}`, initiatedBy: 'system', legs: [{ account: userMain(u), amountMinor: amount }, { account: platform(PlatformAccount.Gateway), amountMinor: -amount }] }), { userId: 'system' });

  beforeAll(async () => {
    admin = new Pool({ connectionString: ADMIN_URL ?? APP_URL });
    await makeTenant(admin, tenantA, 'A'); await makeTenant(admin, tenantB, 'B');
    await makeUser(admin, farmer); await makeUser(admin, vetUser);
    speciesId = (await admin.query(`SELECT id FROM animal_species WHERE code='cattle'`)).rows[0].id;
    breedId = (await admin.query(`SELECT id FROM animal_breeds WHERE code='gir' AND species_id=$1`, [speciesId])).rows[0].id;

    const config = new AppConfig({ NODE_ENV: 'test', DATABASE_URL: APP_URL, JWT_ACCESS_SECRET: 'itest-secret-itest-secret', AUTH_HASH_PEPPER: 'itest-pepper-itest-pepper-32x!!', SHARD_COUNT: '1' });
    pools = new PgPoolProvider(config);
    const shards = new ShardRouter(config);
    uow = new PgUnitOfWork(pools, shards);
    const replica = new PgReadReplicaProvider(pools, shards);
    const outbox = new PgOutboxWriter();
    const idem = new PgIdempotencyService(pools);
    const metrics = new PromMetrics();
    wallet = new InProcessWalletClient(new LedgerRepository());
    const animalRepo = new AnimalRepository(replica as any);
    const speciesRepo = new AnimalSpeciesRepository(replica as any);
    const breedRepo = new AnimalBreedRepository(replica as any);
    const vetRepo = new VetProfileRepository(replica as any);
    const svcRepo = new VetServiceRepository(replica as any);
    const bookingRepo = new VetBookingRepository(replica as any);
    animals = new AnimalService(uow, outbox, idem, new AllowAllQuota(), metrics, animalRepo, speciesRepo, breedRepo);
    vets = new VetService(uow, outbox, idem, metrics, vetRepo, svcRepo);
    bookings = new VetBookingService(uow, outbox, idem, metrics, wallet, bookingRepo, vetRepo, svcRepo, animalRepo);

    await fund(farmer, 500_000n);
    inspect = new Pool({ connectionString: APP_URL });
  }, 30000);

  afterAll(async () => { await pools?.onModuleDestroy(); await inspect?.end(); await admin?.end(); });

  it('farmer registers an animal (FK-validated species + breed)', async () => {
    const a = await animals.register(tenantA, farmerActor, `idem-${randomUUID()}`, { speciesId, breedId, name: 'Gauri', sex: 'female' } as any);
    animalId = a.id; expect(a.status).toBe('active'); expect(a.speciesId).toBe(speciesId);
  });

  it('vet self-registers + publishes a ₹300 consult service', async () => {
    const v = await vets.register(tenantA, vetActor, `idem-${randomUUID()}`, { registrationNo: 'VCI-12345' } as any);
    vetId = v.id;
    const svc = await vets.upsertService(tenantA, vetActor, { serviceTypeCode: 'consult', priceMinor: '30000', pricingUnit: 'per_visit', isEmergencyAvailable: false } as any);
    serviceId = svc.id; expect(svc.priceMinor).toBe('30000');
  });

  it('farmer books → vet accepts → in_consult; fee snapshotted from the service price', async () => {
    const b = await bookings.book(tenantA, farmerActor, `idem-${randomUUID()}`, { vetId, serviceId, animalId, urgency: 'routine', mode: 'visit' } as any);
    bookingId = b.id; expect(b.status).toBe('requested'); expect(b.feeMinor).toBe('30000');
    expect((await bookings.progress(tenantA, vetActor, bookingId, { action: 'accept' } as any)).status).toBe('accepted');
    expect((await bookings.progress(tenantA, vetActor, bookingId, { action: 'in_consult' } as any)).status).toBe('in_consult');
  });

  it('farmer COMPLETES+PAYS: wallet moves farmer → vet (zero-sum), booking → completed', async () => {
    const fBefore = await bal(farmer); const vBefore = await bal(vetUser);
    const res = await bookings.completeAndPay(tenantA, farmerActor, bookingId, `idem-${randomUUID()}`);
    expect(res.status).toBe('completed'); expect(res.feePaidMinor).toBe('30000');
    const fAfter = await bal(farmer); const vAfter = await bal(vetUser);
    expect(fBefore - fAfter).toBe(30000n);     // farmer debited
    expect(vAfter - vBefore).toBe(30000n);     // vet credited
    expect((fAfter - fBefore) + (vAfter - vBefore)).toBe(0n);   // ZERO-SUM
  });

  it('double-pay is refused (booking already completed)', async () => {
    await expect(bookings.completeAndPay(tenantA, farmerActor, bookingId, `idem-${randomUUID()}`)).rejects.toThrow();
  });

  it('RLS: tenant B cannot see tenant A\'s vet booking', async () => {
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantB]);
    expect((await inspect.query(`SELECT id FROM vet_bookings WHERE id=$1`, [bookingId])).rows.length).toBe(0);
    await inspect.query(`SELECT set_config('app.tenant_id',$1,false)`, [tenantA]);
    expect((await inspect.query(`SELECT id FROM vet_bookings WHERE id=$1`, [bookingId])).rows.length).toBe(1);
  });
});
