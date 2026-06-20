// Unit tests for the feature-flag / kill-switch resolver. Pure, no React.
import { flags } from '../flags/flags';

describe('feature flags', () => {
  afterEach(() => flags.hydrate({})); // reset remote overrides between tests

  it('defaults: shipped vertical ON, unbuilt features OFF', () => {
    expect(flags.isEnabled('farmer_app')).toBe(true);
    expect(flags.isEnabled('voice_listing')).toBe(false);
    expect(flags.isEnabled('buyer_app')).toBe(false);
  });

  it('remote config is the kill-switch (wins over default)', () => {
    flags.hydrate({ farmer_app: false });
    expect(flags.isEnabled('farmer_app')).toBe(false); // killed for everyone, no app release
  });

  it('remote can also turn a future vertical ON for a pilot cohort', () => {
    flags.hydrate({ buyer_app: true });
    expect(flags.isEnabled('buyer_app')).toBe(true);
  });

  it('ignores unknown remote keys', () => {
    flags.hydrate({ not_a_flag: true } as Record<string, boolean>);
    expect(flags.isEnabled('farmer_app')).toBe(true);
  });

  it('notifies subscribers on hydrate', () => {
    let calls = 0;
    const unsub = flags.subscribe(() => { calls++; });
    flags.hydrate({ voice_listing: true });
    expect(calls).toBe(1);
    unsub();
  });
});
