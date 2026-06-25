// modules/tenant-webhooks/domain/webhook-ssrf.ts · PURE SSRF guard for tenant-supplied webhook URLs. Outbound
// delivery to an attacker-chosen URL is a classic SSRF vector, so a destination is rejected unless it is plain
// https to a PUBLIC host. We block: non-https, credentials in the URL, non-default ports, localhost/.local/.internal,
// the cloud metadata host, and any IP literal in a private/loopback/link-local/ULA range (v4 + v6). DNS-rebinding
// (a public name that later resolves to a private IP) is a documented residual handled by network egress controls;
// this validator + the delivery worker's timeout/breaker are the app-layer defence. Pure + unit-tested.

export type SsrfResult = { ok: true } | { ok: false; reason: string };

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata']);

function isPrivateIpv4(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const o = m.slice(1).map(Number);
  if (o.some((n) => n > 255)) return true; // malformed → treat as unsafe
  const [a, b] = o;
  if (a === 10) return true;                       // 10/8
  if (a === 127) return true;                      // loopback
  if (a === 0) return true;                        // 0/8
  if (a === 169 && b === 254) return true;         // link-local + 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true;         // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (h === '::1' || h === '::') return true;            // loopback / unspecified
  if (h.startsWith('fe80') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true; // link-local fe80::/10
  if (/^f[cd]/.test(h)) return true;                     // unique-local fc00::/7
  if (h.startsWith('::ffff:')) return isPrivateIpv4(h.slice(7)); // IPv4-mapped
  return false;
}

/** Validate a tenant webhook URL. Returns ok or a stable reason code. */
export function isSafeWebhookUrl(raw: string): SsrfResult {
  let u: URL;
  try { u = new URL(raw); } catch { return { ok: false, reason: 'invalid_url' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'not_https' };
  if (u.username || u.password) return { ok: false, reason: 'has_credentials' };
  if (u.port && u.port !== '443') return { ok: false, reason: 'bad_port' };
  const host = u.hostname.toLowerCase();
  if (!host) return { ok: false, reason: 'no_host' };
  if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: 'blocked_host' };
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return { ok: false, reason: 'blocked_host' };
  if (host.includes(':') || /^\[/.test(u.host)) { if (isPrivateIpv6(host)) return { ok: false, reason: 'private_ip' }; }
  if (isPrivateIpv4(host)) return { ok: false, reason: 'private_ip' };
  return { ok: true };
}
