// Unit tests for the PURE worker-help constants (features/labour/worker-help) behind screen 144.
import { HELP_FAQS, HELP_RIGHTS, WAGE_TICKET_SEVERITY } from '../../features/labour/worker-help';

describe('worker-help constants', () => {
  it('lists the six common questions in design order', () => {
    expect(HELP_FAQS).toEqual(['payTiming', 'lessWage', 'cancelJob', 'pmsby', 'minWage', 'multipleFarmers']);
  });
  it('lists the five worker rights in design order', () => {
    expect(HELP_RIGHTS).toEqual(['minWage', 'wages24h', 'refuseUnsafe', 'pmsby', 'noBonded']);
  });
  it('treats a wage complaint as high-priority support', () => {
    expect(WAGE_TICKET_SEVERITY).toBe('P1');
  });
});
