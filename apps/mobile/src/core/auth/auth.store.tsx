// apps/mobile/src/core/auth/auth.store.tsx · the React-facing session store. It owns the in-memory SessionState
// (via the pure sessionReducer), persists tokens to encrypted secure storage, registers the live access-token
// getter with the API client, and keeps the i18n runtime's language in sync. Screens consume `useAuth()`.
//
// Security notes (Law 4): tokens live in the Keychain/Keystore (token-store), never in AsyncStorage or logs.
// A proactive refresh runs at boot if the access token is near expiry; a failed refresh signs the user out
// (fail closed). The client always re-enforces RBAC server-side — the role here is a UI convenience only.
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import type { AuthTokens, UserProfile } from '@krishi-verse/sdk-js';
import { sessionReducer, initialSession, needsRefresh, type SessionState } from './session.reducer';
import { tokenStore } from './token-store';
import { apiClient, anonClient, registerAccessTokenGetter } from '../api/client';
import { setCacheScope, clearCacheScope } from '../offline/scope';
import { i18n } from '../i18n/i18n';

interface AuthApi {
  state: SessionState;
  /** Persist tokens + flip to authenticated (used by the OTP verify screen). */
  signIn: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
  selectRole: (role: string) => Promise<void>;
  setLanguage: (code: string) => Promise<void>;
  /** Fetch the profile for the bottom-tab greeting etc.; degrades silently on failure. */
  loadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  // keep a ref so the client's token getter always reads the latest token without re-registering
  const tokenRef = useRef<string | undefined>(undefined);
  tokenRef.current = state.accessToken;
  useEffect(() => { registerAccessTokenGetter(() => tokenRef.current); }, []);

  // Boot: restore language + tokens, refresh if near expiry, else go anonymous.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lang, role, tokens] = await Promise.all([tokenStore.readLanguage(), tokenStore.readRole(), tokenStore.readTokens()]);
      const language = lang ?? i18n.lang;
      i18n.setLanguage(language);
      if (cancelled) return;
      dispatch({ type: 'BOOT_RESTORED', language, activeRole: role, tokens: tokens ?? undefined });
      if (tokens && needsRefresh({ ...initialSession, status: 'authenticated', refreshToken: tokens.refreshToken, expiresAtMs: tokens.expiresAtMs }, Date.now())) {
        try {
          const fresh = await anonClient().auth.refresh(tokens.refreshToken);
          const now = Date.now();
          await tokenStore.saveTokens(fresh, now);
          if (!cancelled) dispatch({ type: 'TOKENS_REFRESHED', tokens: fresh, nowMs: now });
        } catch {
          await tokenStore.clearTokens();
          if (!cancelled) dispatch({ type: 'SIGNED_OUT' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const api = useMemo<AuthApi>(() => ({
    state,
    async signIn(tokens) {
      const now = Date.now();
      await tokenStore.saveTokens(tokens, now);
      dispatch({ type: 'SIGNED_IN', tokens, nowMs: now });
    },
    async signOut() {
      await tokenStore.clearTokens();
      await clearCacheScope();        // wipe this user's cached reads so the next user can't see them
      dispatch({ type: 'SIGNED_OUT' });
    },
    async selectRole(role) {
      await tokenStore.saveRole(role);
      dispatch({ type: 'ROLE_SELECTED', role });
    },
    async setLanguage(code) {
      await tokenStore.saveLanguage(code);
      i18n.setLanguage(code);
      dispatch({ type: 'LANGUAGE_SET', language: i18n.lang });
    },
    async loadProfile() {
      try {
        const profile: UserProfile = await apiClient().auth.me();
        setCacheScope(profile.id);    // scope the read-cache to this user (anti-IDOR across accounts)
        dispatch({ type: 'PROFILE_LOADED', profile });
      } catch { /* degrade-never-die: the greeting falls back to a default */ }
    },
  }), [state]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
