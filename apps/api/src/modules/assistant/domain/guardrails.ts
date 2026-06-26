// modules/assistant/domain/guardrails.ts · PURE prompt-injection + input guardrails for the governed farmer
// assistant (no I/O → unit-tested). The model NEVER sees raw user text without passing through here. Two jobs:
//   1. sanitize — trim, collapse whitespace, strip control chars, bound length (cost + abuse cap).
//   2. detectInjection — heuristic scan for jailbreak / instruction-override / exfiltration attempts. A hit means
//      the orchestrator REFUSES (records a blocked inference, returns a safe refusal) — it never forwards the
//      text to the model. This is defence-in-depth; the model+system-prompt on ai-services is the other layer.
// Regexes are anchored / bounded character classes (ReDoS-safe). Language is restricted to the UI set.

export const ASSISTANT_LANGUAGES = ['hi', 'en', 'gu'] as const;
export type AssistantLanguage = (typeof ASSISTANT_LANGUAGES)[number];

export const MAX_MESSAGE_CHARS = 2000;

/** Normalise the user message: strip control chars, collapse runs of whitespace, trim, hard-cap length. */
export function sanitizeMessage(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const noControl = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ');
  const collapsed = noControl.replace(/[ \t\r\n]{2,}/g, ' ').trim();
  return collapsed.slice(0, MAX_MESSAGE_CHARS);
}

export function isValidLanguage(code: string): code is AssistantLanguage {
  return (ASSISTANT_LANGUAGES as readonly string[]).includes(code);
}

// Heuristic injection signatures. Each is a fixed, bounded pattern (no catastrophic backtracking). We match on a
// lowercased copy. These catch the common "ignore previous instructions / reveal your system prompt / act as
// DAN / exfiltrate secrets" families — not a silver bullet, but a cheap first gate before spending a model call.
const INJECTION_PATTERNS: ReadonlyArray<{ code: string; re: RegExp }> = [
  { code: 'override_instructions', re: /\bignore (all |the |your )?(previous|prior|above) (instructions|prompts?|rules)\b/ },
  { code: 'override_instructions', re: /\bdisregard (all |the |your )?(previous|prior|above|system)\b/ },
  { code: 'reveal_system_prompt', re: /\b(reveal|show|print|repeat|output|leak) (me )?(your |the )?(system |initial )?(prompt|instructions|rules)\b/ },
  { code: 'role_jailbreak', re: /\b(you are|act as|pretend to be|roleplay as) (now )?(dan|an? (unrestricted|jailbroken|uncensored)|a different ai)\b/ },
  { code: 'developer_mode', re: /\b(developer|debug|god|admin) mode\b/ },
  { code: 'exfiltrate_secret', re: /\b(api[_ ]?key|secret|password|token|env(ironment)? variable|credentials?)\b/ },
  { code: 'tool_escape', re: /(^|\s)(system|assistant|user)\s*:/ },   // fake chat-role injection
];

/** Scan sanitized text for injection signatures. Returns the matched codes (deduped); empty ⇒ clean. */
export function detectInjection(text: string): string[] {
  const hay = text.toLowerCase();
  const hits = new Set<string>();
  for (const { code, re } of INJECTION_PATTERNS) if (re.test(hay)) hits.add(code);
  return [...hits];
}

/** A message is acceptable to forward iff it is non-empty after sanitize and shows no injection signature. */
export function screenMessage(raw: string): { ok: boolean; clean: string; reasons: string[] } {
  const clean = sanitizeMessage(raw);
  if (clean.length === 0) return { ok: false, clean, reasons: ['empty'] };
  const reasons = detectInjection(clean);
  return { ok: reasons.length === 0, clean, reasons };
}

/** A safe, non-fabricated refusal the orchestrator returns when input is blocked or the provider degrades.
 *  It NEVER answers the agronomic question — it explains the request can't be served and suggests human help. */
export function safeFallbackReply(lang: string, kind: 'blocked' | 'needs_review'): string {
  const L = isValidLanguage(lang) ? lang : 'en';
  const msg: Record<AssistantLanguage, { blocked: string; needs_review: string }> = {
    en: {
      blocked: 'I can’t help with that request. Please rephrase your farming question, or contact support for help.',
      needs_review: 'The assistant isn’t available right now, so I can’t give a verified answer. Please try again later or contact support.',
    },
    hi: {
      blocked: 'मैं इस अनुरोध में मदद नहीं कर सकता। कृपया अपना कृषि प्रश्न दोबारा लिखें, या सहायता से संपर्क करें।',
      needs_review: 'सहायक अभी उपलब्ध नहीं है, इसलिए मैं सत्यापित उत्तर नहीं दे सकता। कृपया बाद में पुनः प्रयास करें या सहायता से संपर्क करें।',
    },
    gu: {
      blocked: 'હું આ વિનંતીમાં મદદ કરી શકતો નથી. કૃપા કરી તમારો ખેતી પ્રશ્ન ફરી લખો, અથવા સહાયનો સંપર્ક કરો.',
      needs_review: 'સહાયક અત્યારે ઉપલબ્ધ નથી, તેથી હું ચકાસાયેલ જવાબ આપી શકતો નથી. કૃપા કરી પછી પ્રયાસ કરો અથવા સહાયનો સંપર્ક કરો.',
    },
  };
  return msg[L][kind];
}
