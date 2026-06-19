// modules/livestock/__tests__/livestock-domain.spec.ts · pure-domain unit tests: the animal + vet-booking
// state machines (Law 5), the Animal aggregate (register/update/retire guards), the VetService price
// invariant (bigint minor units), and the VetBooking lifecycle incl. the completion gate (only a rendered
// service can be completed + paid). No infra — UoW/outbox/wallet/authz are covered by the integration spec.
import { canTransition as aCan, assertTransition as aAssert, isActive, ANIMAL_STATUSES, AnimalStatus, IllegalAnimalTransitionError } from '../domain/animal.state';
import { canTransition as vCan, isTerminal, isCompletable, VET_BOOKING_STATUSES, VetBookingStatus, IllegalVetBookingTransitionError } from '../domain/vet-booking.state';
import { Animal } from '../domain/animal.entity';
import { VetService } from '../domain/vet-service.entity';
import { VetBooking } from '../domain/vet-booking.entity';
import { LivestockEventType } from '../domain/livestock.events';
import { LivestockForbiddenError, InvalidVetServiceError, BookingNotCompletableError } from '../domain/livestock.errors';

const animal = (over: any = {}) => Animal.register({ id: 'an1', tenantId: 't1', ownerUserId: 'u1', speciesId: 'sp1', breedId: null,
  pashuAadhaar: null, name: 'Gauri', sex: 'female', dobEstimated: null, parity: null, lactationStage: null, currentYieldLpd: null,
  pregnancyStatus: null, bodyConditionScore: null, acquiredVia: 'born', ...over });
const booking = (over: any = {}) => VetBooking.request({ id: 'b1', tenantId: 't1', farmerUserId: 'f1', vetId: 'v1', serviceId: 's1',
  animalId: null, urgency: 'routine', mode: 'visit', symptomsText: null, scheduledAt: null, feeMinor: 30000n, ...over });

describe('animal.state machine', () => {
  it('active → sold/deceased/lost, all terminal', () => {
    expect(aCan('active', 'sold')).toBe(true); expect(aCan('active', 'deceased')).toBe(true); expect(aCan('active', 'lost')).toBe(true);
    expect(aCan('sold', 'active')).toBe(false); expect(isActive('active')).toBe(true); expect(isActive('sold')).toBe(false);
  });
  it('covers every status + throws typed 409 on illegal move', () => {
    for (const s of ANIMAL_STATUSES) expect(() => aCan(s, 'lost' as AnimalStatus)).not.toThrow();
    expect(() => aAssert('sold', 'active')).toThrow(IllegalAnimalTransitionError);
  });
});

describe('Animal aggregate', () => {
  it('registers active + emits animal_registered', () => {
    const a = animal(); expect(a.status).toBe('active');
    expect(a.pullEvents().map((e) => e.type)).toContain(LivestockEventType.AnimalRegistered);
  });
  it('retire moves to a terminal state + emits animal_retired', () => {
    const a = animal(); a.pullEvents(); a.retire('sold');
    expect(a.status).toBe('sold'); expect(a.pullEvents().map((e) => e.type)).toContain(LivestockEventType.AnimalRetired);
  });
  it('refuses husbandry edits on a retired animal', () => {
    const a = animal(); a.retire('deceased');
    expect(() => a.updateHusbandry({ name: 'X' })).toThrow(LivestockForbiddenError);
  });
});

describe('VetService price invariant', () => {
  it('rejects a non-positive price; price is bigint minor units', () => {
    expect(() => VetService.create({ id: 's1', vetId: 'v1', serviceTypeId: 'st1', priceMinor: 0n })).toThrow(InvalidVetServiceError);
    const s = VetService.create({ id: 's1', vetId: 'v1', serviceTypeId: 'st1', priceMinor: 30000n });
    expect(typeof s.priceMinor).toBe('bigint'); expect(s.priceMinor).toBe(30000n);
  });
});

describe('vet-booking.state machine + lifecycle', () => {
  it('requested→accepted→en_route→in_consult→prescribed→completed', () => {
    expect(vCan('requested', 'accepted')).toBe(true);
    expect(vCan('accepted', 'en_route')).toBe(true);
    expect(vCan('en_route', 'in_consult')).toBe(true);
    expect(vCan('in_consult', 'prescribed')).toBe(true);
    expect(vCan('prescribed', 'completed')).toBe(true);
    expect(vCan('requested', 'completed')).toBe(false);
    expect(isTerminal('completed')).toBe(true); expect(isTerminal('cancelled')).toBe(true); expect(isTerminal('no_show')).toBe(true);
    expect(isCompletable('in_consult')).toBe(true); expect(isCompletable('prescribed')).toBe(true); expect(isCompletable('requested')).toBe(false);
  });
  it('covers every status', () => { for (const s of VET_BOOKING_STATUSES) expect(() => vCan(s, 'cancelled' as VetBookingStatus)).not.toThrow(); });
  it('drives the lifecycle + completes from in_consult, stamping completedAt', () => {
    const b = booking(); b.pullEvents();
    b.accept(); b.enRoute(); b.startConsult();
    expect(b.status).toBe('in_consult');
    b.complete(new Date('2026-06-20T10:00:00Z'));
    expect(b.status).toBe('completed'); expect(b.toProps().completedAt).toBeInstanceOf(Date);
    expect(b.pullEvents().map((e) => e.type)).toContain(LivestockEventType.VetBookingCompleted);
  });
  it('refuses to complete a not-yet-rendered booking', () => {
    const b = booking(); b.accept();
    expect(() => b.complete(new Date())).toThrow(BookingNotCompletableError);
  });
  it('illegal transition throws a typed 409', () => {
    expect(new IllegalVetBookingTransitionError('completed', 'accepted').code).toBe('VET_BOOKING_ILLEGAL_TRANSITION');
  });
});
