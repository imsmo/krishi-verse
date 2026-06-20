// apps/mobile/src/core/voice/locale.ts · PURE mapping from a UI language code to the device STT locale tag.
// hi → hi-IN, gu → gu-IN, en → en-IN (Indian English). Dependency-free → unit-tested.
export function sttLocaleFor(langCode: string): string {
  switch ((langCode || '').slice(0, 2)) {
    case 'hi': return 'hi-IN';
    case 'gu': return 'gu-IN';
    default: return 'en-IN';
  }
}
