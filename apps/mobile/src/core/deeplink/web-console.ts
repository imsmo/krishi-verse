// apps/mobile/src/core/deeplink/web-console.ts · open the tenant web-console (apps/web-tenant) for heavy editing
// that the mobile-lite admin hands off (P-18). HTTPS-only, validated against the PURE buildWebUrl (anti
// open-redirect), opened via the OS browser (Linking) — we never embed a WebView with native bridges (§4).
// Resilient: if the console origin isn't configured or the URL is unsafe/unopenable, returns false (the screen
// shows a friendly "console not available") — never throws (Law 12).
import { Linking } from 'react-native';
import { config } from '../config';
import { buildWebUrl } from '../../features/tenant/web-console';

/** Build the absolute console URL for a safe relative path, or null if unavailable. */
export function webConsoleUrl(path: string): string | null {
  return buildWebUrl(config.tenantConsoleUrl, path);
}

/** Open the console at a safe relative path. Returns false if it couldn't (degrade-never-die). */
export async function openWebConsole(path: string): Promise<boolean> {
  const url = webConsoleUrl(path);
  if (!url) return false;
  try {
    const ok = await Linking.canOpenURL(url);
    if (!ok) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
