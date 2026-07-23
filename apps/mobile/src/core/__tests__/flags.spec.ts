// Unit tests for the feature-flag / kill-switch resolver. Pure, no React.
import { flags } from '../flags/flags';

describe('feature flags', () => {
  afterEach(() => flags.hydrate({})); // reset remote overrides between tests

  it('defaults: shipped vertical ON, unbuilt features OFF', () => {
    expect(flags.isEnabled('farmer_app')).toBe(true);
    expect(flags.isEnabled('voice_listing')).toBe(false);
    expect(flags.isEnabled('buyer_app')).toBe(false);
  });

  // R2-06 (founder screenshot review): the wallet HUB's Send tile is P2P wallet transfer — no backend endpoint
  // exists yet, so it must stay hidden at pilot (never a dead "Coming soon" button). Defaults OFF; ops can flip
  // it on for a cohort once the transfer endpoint ships, same kill-switch convention as every other flag here.
  it('wallet_p2p (Send tile) defaults OFF — hidden until the P2P transfer endpoint ships', () => {
    expect(flags.isEnabled('wallet_p2p')).toBe(false);
    flags.hydrate({ wallet_p2p: true });
    expect(flags.isEnabled('wallet_p2p')).toBe(true);
  });

  // R2-03: the Farm Assistant's "Tap to speak" mic is gated separately from the (already-wired, honestly
  // degrading) text Q&A — this flag only ever hides/shows the mic affordance, never the composer.
  it('voice_assistant (assistant mic) defaults OFF — ops can enable once STT is verified for freeform Qs', () => {
    expect(flags.isEnabled('voice_assistant')).toBe(false);
    flags.hydrate({ voice_assistant: true });
    expect(flags.isEnabled('voice_assistant')).toBe(true);
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

  // KV-MF-03/04: `support` defaults OFF and relays the server's own `support` flag verbatim (same key name, no
  // mapping needed — unlike `offers_chat`, which has no matching server-side key at all and so can never be
  // turned on via hydrate()).
  it('support flag mirrors the server key verbatim', () => {
    expect(flags.isEnabled('support')).toBe(false);
    flags.hydrate({ support: false, communication: true, disputes: true }); // matches the reported repro
    expect(flags.isEnabled('support')).toBe(false); // "Chat with support" + "Raise a complaint" still fail until this flips
    flags.hydrate({ support: true, communication: true, disputes: true });
    expect(flags.isEnabled('support')).toBe(true); // ops flips the SAME `support` flag → unblocks instantly, no client rebuild
  });

  it('notifies subscribers on hydrate', () => {
    let calls = 0;
    const unsub = flags.subscribe(() => { calls++; });
    flags.hydrate({ voice_listing: true });
    expect(calls).toBe(1);
    unsub();
  });
});
