// apps/realtime-gateway/src/channels/presence.ts · spectator counts per channel (e.g. "142 watching this
// auction"). PER-POD local count of subscribers to a channel; a cross-pod total would sum these over Redis
// (deferred — local count is a useful, cheap signal and never leaks identities, only a number).
export class PresenceCounter {
  private readonly counts = new Map<string, number>();

  join(channel: string): number { const n = (this.counts.get(channel) ?? 0) + 1; this.counts.set(channel, n); return n; }
  leave(channel: string): number {
    const n = Math.max(0, (this.counts.get(channel) ?? 0) - 1);
    if (n === 0) this.counts.delete(channel); else this.counts.set(channel, n);
    return n;
  }
  count(channel: string): number { return this.counts.get(channel) ?? 0; }
}
