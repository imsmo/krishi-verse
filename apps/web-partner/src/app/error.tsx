'use client';
// apps/web-partner/src/app/error.tsx · the route-segment error boundary. MUST be a client component (Next
// requirement), so it can't use the server i18n helper — but web-partner is en-only, so it reads the en catalog
// directly. A partner error is often an expired session, so this offers BOTH a retry (`reset()`) and a sign-in
// link to /login. No PII/secret/token is ever shown (degrade, never die).
import { useEffect } from 'react';
import { en } from '../i18n/en';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { /* hook for client telemetry; never logs PII/secrets/tokens */ }, [error]);
  return (
    <section className="kv-empty-state" role="alert">
      <h1>{en['common.errorTitle']}</h1>
      <p>{en['common.errorBody']}</p>
      <div className="kv-actions">
        <button type="button" className="kv-btn" onClick={() => reset()}>{en['common.retry']}</button>
        <a className="kv-btn kv-btn--muted" href="/login">{en['common.signInAgain']}</a>
      </div>
    </section>
  );
}
