// apps/mobile/src/core/errors/sdk-error-message.ts · pure helper: pick the REAL server-reported reason off a
// caught SdkError (or any Error) instead of swallowing it into a static string. Established as its own tested
// helper after KV-MF-03/04 (support "Chat with support" + "Raise a complaint" both showed an identical generic
// alert whether the real cause was a 404 "Not found" — a `support` feature flag off server-side — a 422 field
// error, or a genuine network blip; the farmer/founder had no way to tell which). The exact inline pattern was
// first established ad hoc in KV-MF-02 (apps/mobile/src/app/(farmer)/listings/new.tsx); this extracts it so it can
// be unit-tested and reused. No React/native deps → pure.
export function sdkErrorMessage(e: unknown): string | undefined {
  return e instanceof Error && e.message ? e.message : undefined;
}
