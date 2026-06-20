// @krishi-verse/sdk-js · auth resource (phone-OTP login, mirrors the identity module). The SDK never stores
// tokens — it returns them to the host, which decides storage (httpOnly cookie on the server, memory in the
// browser). requestOtp is enumeration-safe by API contract (same response whether or not the phone exists).
import { HttpClient } from '../http';
import { AuthTokens, UserProfile } from '../types';

export class AuthResource {
  constructor(private readonly http: HttpClient) {}
  /** Request a login OTP for a phone (E.164). Anonymous; rate-limited + enumeration-safe by the API. */
  async requestOtp(phone: string, idempotencyKey: string): Promise<{ requested: boolean }> {
    return (await this.http.request<{ requested: boolean }>('POST', 'auth/otp/request', { anonymous: true, idempotencyKey, body: { phone } })).data;
  }
  /** Verify an OTP → access + refresh tokens. Anonymous. */
  async verifyOtp(phone: string, code: string, idempotencyKey: string): Promise<AuthTokens> {
    return (await this.http.request<AuthTokens>('POST', 'auth/otp/verify', { anonymous: true, idempotencyKey, body: { phone, code } })).data;
  }
  /** Rotate the refresh token (the API invalidates the old one). */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    return (await this.http.request<AuthTokens>('POST', 'auth/refresh', { anonymous: true, body: { refreshToken } })).data;
  }
  /** The authenticated caller's profile (uses the bearer token). */
  async me(signal?: AbortSignal): Promise<UserProfile> {
    return (await this.http.request<UserProfile>('GET', 'auth/me', { signal })).data;
  }
}
