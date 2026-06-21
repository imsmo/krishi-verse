// @krishi-verse/sdk-js · messaging resources (communication module): chat conversations + masked (privacy-proxy)
// calls. Conversations are membership-gated SERVER-SIDE (a non-participant gets 404 — no IDOR). open + postMessage
// + initiate(call) carry an Idempotency-Key (Law 3). A message body is text OR a media id (voice/attachment) — the
// bytes live in S3, referenced by id. A masked call bridges the two real numbers server-side; NO phone number is
// ever sent to the client. Gated server-side by the `communication` flag.
import { HttpClient } from '../http';
import { Conversation, Message, MaskedCall, Page } from '../types';

export class ConversationsResource {
  constructor(private readonly http: HttpClient) {}

  /** Open (or get the existing) conversation for a context with the given participants (the caller is auto-added). */
  async open(input: { contextType: string; contextId?: string | null; participantUserIds: string[] }, idempotencyKey: string): Promise<Conversation> {
    return (await this.http.request<Conversation>('POST', 'conversations', { idempotencyKey, body: input })).data;
  }
  async list(params: { contextType?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<Conversation>> {
    const r = await this.http.request<Conversation[]>('GET', 'conversations', { query: { contextType: params.contextType, cursor: params.cursor, limit: params.limit ?? 20 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
  async get(id: string, signal?: AbortSignal): Promise<Conversation> {
    return (await this.http.request<Conversation>('GET', `conversations/${encodeURIComponent(id)}`, { signal })).data;
  }
  async markRead(id: string): Promise<{ ok: boolean }> {
    return (await this.http.request<{ ok: boolean }>('POST', `conversations/${encodeURIComponent(id)}/read`, { body: {} })).data;
  }
  /** Post a message: text body and/or a voice/attachment media id (at least one). Idempotent. */
  async postMessage(conversationId: string, input: { body?: string; voiceMediaId?: string; attachmentMediaId?: string }, idempotencyKey: string): Promise<Message> {
    return (await this.http.request<Message>('POST', `conversations/${encodeURIComponent(conversationId)}/messages`, { idempotencyKey, body: input })).data;
  }
  /** Messages newest-first (keyset). */
  async listMessages(conversationId: string, params: { cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<Message>> {
    const r = await this.http.request<Message[]>('GET', `conversations/${encodeURIComponent(conversationId)}/messages`, { query: { cursor: params.cursor, limit: params.limit ?? 30 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
}

export class MaskedCallsResource {
  constructor(private readonly http: HttpClient) {}
  /** Initiate a privacy-proxy call to a user. The server bridges the two real numbers — no number is returned. */
  async initiate(input: { calleeUserId: string; contextType?: string; contextId?: string }, idempotencyKey: string): Promise<MaskedCall> {
    return (await this.http.request<MaskedCall>('POST', 'masked-calls', { idempotencyKey, body: input })).data;
  }
  async list(params: { cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<Page<MaskedCall>> {
    const r = await this.http.request<MaskedCall[]>('GET', 'masked-calls', { query: { cursor: params.cursor, limit: params.limit ?? 20 }, signal });
    return { items: r.data, nextCursor: (r.meta?.nextCursor as string | null) ?? null };
  }
}
