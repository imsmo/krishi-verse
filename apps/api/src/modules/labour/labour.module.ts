// modules/labour/labour.module.ts
// Labour (PRD M28): the dignified-work spine. An employer (farmer/FPO, worker.book) POSTS a booking with
// THE DIGNITY FLOOR snapshotted from minimum_wages (an offer below the statutory minimum is impossible —
// enforced in the domain AND by chk_dignity_floor in the DB), assigns workers, workers CONSENT, and on
// completion WAGES ARE SETTLED through the wallet boundary (employer userMain → worker userMain,
// txnType 'wage_payout', zero-sum + idempotent — Law 2). Gated by the `labour` feature flag (default OFF).
//
// SCOPE (this build): worker profiles + bookings + assignments + wage settlement + the respond-timeout job.
// DEFERRED (documented in README): attendance (geo-fenced/dual-confirmed, partitioned), worker advances/baki,
// insurance, MGNREGA, migrant engagement, safety checklists, grievances, crews/sardars, worker availability,
// skills/minimum-wage admin CRUD + gazette-sync job, voice-consent capture, auto-accept, women-only matching.
import { Module } from '@nestjs/common';
import { WorkersController } from './controllers/v1/workers.controller';
import { BookingsController } from './controllers/v1/bookings.controller';
import { AssignmentsController } from './controllers/v1/assignments.controller';
import { WorkerProfileService } from './services/worker-profile.service';
import { LabourBookingService } from './services/labour-booking.service';
import { MinimumWageService } from './services/minimum-wage.service';
import { WorkerProfileRepository } from './repositories/worker-profile.repository';
import { LabourBookingRepository } from './repositories/labour-booking.repository';
import { BookingAssignmentRepository } from './repositories/booking-assignment.repository';
import { MinimumWageRepository } from './repositories/minimum-wage.repository';

// The respond-timeout worker job (jobs/booking-respond-timeout.job.ts) is instantiated by apps/worker with
// a privileged kv_relay Pool — not a DI provider (it takes a Pool), mirroring the other expiry jobs.
@Module({
  controllers: [WorkersController, BookingsController, AssignmentsController],
  providers: [
    WorkerProfileService, LabourBookingService, MinimumWageService,
    WorkerProfileRepository, LabourBookingRepository, BookingAssignmentRepository, MinimumWageRepository,
  ],
  exports: [WorkerProfileService, LabourBookingService],
})
export class LabourModule {}
