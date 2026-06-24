'use client';
// apps/web-tenant/src/components/LocaleSwitcher.tsx · the console language picker. A real <form> that POSTs to
// /api/lang (which validates + sets the kvt_lang cookie + redirects back) — so it works WITHOUT client JS; the
// only reason this is a client component is to capture the current path/query into `from` so the redirect
// returns the user to where they were. No token, no PII.
import { usePathname, useSearchParams } from 'next/navigation';
import { LANGUAGES } from '@krishi-verse/i18n';

export function LocaleSwitcher({ active, label }: { active: string; label: string }) {
  const pathname = usePathname() || '/dashboard';
  const qs = useSearchParams()?.toString();
  const from = qs ? `${pathname}?${qs}` : pathname;
  return (
    <form action="/api/lang" method="post" className="kv-locale" aria-label={label}>
      <input type="hidden" name="from" value={from} />
      <span className="kv-locale__label" aria-hidden="true">{label}:</span>
      {LANGUAGES.map((l) => (
        <button key={l.code} type="submit" name="lang" value={l.code} lang={l.code} aria-pressed={l.code === active}
          className={`kv-locale__btn${l.code === active ? ' is-active' : ''}`}>{l.nameNative}</button>
      ))}
    </form>
  );
}
