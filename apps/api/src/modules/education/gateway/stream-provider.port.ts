// modules/education/gateway/stream-provider.port.ts
// Port to the EXTERNAL live-streaming provider (Mux/Cloudflare-Stream/IVS-style). createStream issues an
// ingest + playback target for a session; the provider owns the RTMP/HLS infra. Adapters are resilience-wrapped
// and DEGRADE (return ok:false) rather than throw — a hung streamer must never cascade into a request path.
export const STREAM_PROVIDER = Symbol('STREAM_PROVIDER');

export interface CreateStreamInput { idempotencyKey: string; tenantId: string | null; sessionId: string; hostUserId: string; title: string; }
export interface CreateStreamResult { ok: boolean; providerStreamRef?: string; playbackUrl?: string; failureReason?: string; }

export interface StreamProvider {
  readonly providerCode: string;
  createStream(input: CreateStreamInput): Promise<CreateStreamResult>;
}
