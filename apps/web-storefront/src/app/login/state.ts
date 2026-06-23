// apps/web-storefront/src/app/login/state.ts · the login form's state shape + initial value. Kept OUT of
// actions.ts because a 'use server' module may only export async functions — this plain module can be imported
// by both the server actions and the client <LoginForm>. No secrets: `phone` is display-only, the OTP is never
// carried here.
export type LoginState = {
  step: 'phone' | 'code';
  /** E.164 phone carried into the verify step (display + hidden field); never a secret. */
  phone?: string;
  /** Neutral, enumeration-safe notice shown after requesting a code. */
  notice?: string;
  /** A user-facing, non-leaky error message (already localized). */
  error?: string;
};

export const initialLoginState: LoginState = { step: 'phone' };
