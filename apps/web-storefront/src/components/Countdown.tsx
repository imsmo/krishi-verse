'use client';
// apps/web-storefront/src/components/Countdown.tsx · a live countdown to an auction's end time. Client component
// purely for the ticking clock — it takes an ISO timestamp + already-localized unit labels as props; it holds no
// data and no secret. Renders "ended" once the deadline passes. SSR-safe: the first paint uses the server time,
// then the effect takes over per second.
import { useEffect, useState } from 'react';

export type CountdownLabels = { ended: string; d: string; h: string; m: string; s: string };

function remaining(endsAtMs: number, nowMs: number): { ended: boolean; d: number; h: number; m: number; s: number } {
  const diff = Math.max(0, endsAtMs - nowMs);
  const total = Math.floor(diff / 1000);
  return { ended: diff <= 0, d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function Countdown({ endsAt, labels }: { endsAt: string; labels: CountdownLabels }) {
  const endsAtMs = new Date(endsAt).getTime();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const r = remaining(endsAtMs, nowMs);
  if (Number.isNaN(endsAtMs)) return null;
  if (r.ended) return <span className="kv-countdown kv-countdown--ended">{labels.ended}</span>;

  const parts = [r.d ? `${r.d}${labels.d}` : '', r.h ? `${r.h}${labels.h}` : '', `${r.m}${labels.m}`, `${r.s}${labels.s}`].filter(Boolean);
  return <span className="kv-countdown" aria-live="polite">{parts.join(' ')}</span>;
}
