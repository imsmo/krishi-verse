'use client';
// apps/web-storefront/src/components/LoginForm.tsx · the phone-OTP login UI. A two-step form backed by ONE
// useFormState over loginAction: step 'phone' (enter number → request code) then step 'code' (enter the OTP →
// verify). The clicked submit button carries the `intent` (request | verify | reset), so no client branching
// logic mutates server state. The OTP is a normal one-time-code input; the code is never rendered back. All copy
// arrives pre-localized via `labels` (this is a client component, so it can't call the server-only i18n helper)
// and via the action's already-localized notice/error. Keyboard- and screen-reader-accessible.
import { useFormState, useFormStatus } from 'react-dom';
import { loginAction } from '../app/login/actions';
import { initialLoginState, type LoginState } from '../app/login/state';

export type LoginLabels = {
  phoneLabel: string; phonePlaceholder: string; phoneHint: string; sendCode: string;
  codeLabel: string; codePlaceholder: string; codeHint: string; verify: string; changeNumber: string;
  sending: string; verifying: string;
};

/** A submit button that carries an `intent` and reflects the form's pending state (disable + busy label). */
function IntentButton(
  { intent, idle, busy, className = 'kv-btn', formNoValidate = false }:
  { intent: string; idle: string; busy?: string; className?: string; formNoValidate?: boolean },
) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="intent" value={intent} className={className} disabled={pending} formNoValidate={formNoValidate}>
      {pending && busy ? busy : idle}
    </button>
  );
}

export function LoginForm({ next, labels }: { next: string; labels: LoginLabels }) {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, initialLoginState);
  const onCodeStep = state.step === 'code';

  return (
    <form action={formAction} className="kv-form" noValidate>
      {/* preserve where to return after a successful login */}
      <input type="hidden" name="next" value={next} />

      {state.notice && <p className="kv-form__notice" role="status">{state.notice}</p>}
      {state.error && <p className="kv-form__error" role="alert">{state.error}</p>}

      {!onCodeStep && (
        <div className="kv-field">
          <label htmlFor="kv-phone" className="kv-field__label">{labels.phoneLabel}</label>
          <input
            id="kv-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel"
            placeholder={labels.phonePlaceholder} aria-describedby="kv-phone-hint"
            className="kv-field__input" required
          />
          <p id="kv-phone-hint" className="kv-field__hint">{labels.phoneHint}</p>
          <IntentButton intent="request" idle={labels.sendCode} busy={labels.sending} />
        </div>
      )}

      {onCodeStep && (
        <div className="kv-field">
          {/* carry the validated phone into the verify step (display only — not a secret) */}
          <input type="hidden" name="phone" value={state.phone ?? ''} />
          <label htmlFor="kv-code" className="kv-field__label">{labels.codeLabel}</label>
          <input
            id="kv-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
            pattern="\d{4,8}" placeholder={labels.codePlaceholder} aria-describedby="kv-code-hint"
            className="kv-field__input" required autoFocus
          />
          <p id="kv-code-hint" className="kv-field__hint">{labels.codeHint} {state.phone}</p>
          <IntentButton intent="verify" idle={labels.verify} busy={labels.verifying} />
          <IntentButton intent="reset" idle={labels.changeNumber} className="kv-btn--link" formNoValidate />
        </div>
      )}
    </form>
  );
}
