// apps/mobile/src/features/kyc/bank-setup.ts · PURE helpers for the Add-Bank-Account (penny-drop) screen (74). No
// React/native — unit-tested. §4: the raw account number is held ONLY in component state and sent ONCE to the
// server-side tokenise endpoint (never logged/persisted). These helpers normalise + validate for UX only — the
// SERVER (+ penny-drop) is the real authority on ownership/validity.

export type AccountType = 'savings' | 'current';

/** IFSC format: 4 letters + '0' + 6 alphanumerics (RBI standard). UX-only; the server re-validates. Pure. */
export function isValidIfsc(ifsc: string | null | undefined): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test((ifsc ?? '').trim().toUpperCase());
}

/** Uppercase + strip spaces from a typed IFSC (banks print it with spaces sometimes). Capped at 11. Pure. */
export function normalizeIfsc(raw: string): string {
  return (raw ?? '').replace(/\s/g, '').toUpperCase().slice(0, 11);
}

/** Keep digits only, capped at 18 (longest Indian account numbers). Pure. */
export function normalizeAccountNumber(raw: string): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, 18);
}

/** Indian bank account numbers are 9–18 digits. UX gate only; server re-validates. Pure. */
export function isValidAccountNumber(n: string): boolean {
  const d = normalizeAccountNumber(n);
  return d.length >= 9 && d.length <= 18;
}

export interface BankForm {
  holderName?: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  ifsc?: string;
  accountType?: AccountType;
}
export type BankFormReason = 'name' | 'account' | 'mismatch' | 'ifsc';
export type BankValidation =
  | { ok: true; input: { accountNumber: string; ifsc: string; holderName: string; accountType: AccountType } }
  | { ok: false; reason: BankFormReason };

/** Validate the add-bank form and build the tokenise payload. Order of checks is the field order the user reads
 * top→bottom (name → account → confirm-match → IFSC). Trims + normalises. Pure — no I/O. */
export function validateBankForm(form: BankForm): BankValidation {
  const holderName = (form.holderName ?? '').trim();
  if (holderName.length < 2 || holderName.length > 200) return { ok: false, reason: 'name' };
  const accountNumber = normalizeAccountNumber(form.accountNumber ?? '');
  if (!isValidAccountNumber(accountNumber)) return { ok: false, reason: 'account' };
  if (accountNumber !== normalizeAccountNumber(form.confirmAccountNumber ?? '')) return { ok: false, reason: 'mismatch' };
  const ifsc = normalizeIfsc(form.ifsc ?? '');
  if (!isValidIfsc(ifsc)) return { ok: false, reason: 'ifsc' };
  return { ok: true, input: { accountNumber, ifsc, holderName, accountType: form.accountType ?? 'savings' } };
}
