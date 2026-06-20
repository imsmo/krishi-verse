// apps/mobile/src/core/i18n/useTranslation.ts · the React hook screens use to translate. Subscribes to the
// i18n runtime so a language switch re-renders every consumer. Returns `t` (translate) and `lang` (active code).
import { useSyncExternalStore, useCallback } from 'react';
import { i18n } from './i18n';

export function useTranslation() {
  const lang = useSyncExternalStore(
    (cb) => i18n.subscribe(cb),
    () => i18n.lang,
    () => i18n.lang,
  );
  const t = useCallback((key: string, vars?: Record<string, string | number>) => i18n.t(key, vars), [lang]);
  return { t, lang };
}
