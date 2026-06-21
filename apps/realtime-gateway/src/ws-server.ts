// apps/realtime-gateway/src/ws-server.ts · the WebSocket server. STATELESS per pod (no durable socket state):
// state lives in the sockets themselves + Redis. Lifecycle:
//   connect  → authenticate the handshake JWT (fail closed; 4401 on bad token);
//   message  → client sends {action:'subscribe'|'unsubscribe', channel}; we AUTHORIZE every subscribe via
//              canSubscribe(claims, channel) (cross-tenant/owner/perm checks) — bounded by maxSubscriptions;
//   fan-out  → dispatch(channel,payload) from the Redis adapter is forwarded to the sockets subscribed to that
//              exact channel on THIS pod, with backpressure (slow consumers are evicted);
//   close    → drop the socket from all channel indexes.
// We hold a channel→sockets index for O(1) fan-out and a per-socket subscription set for cleanup + limits.
import type { WebSocketServer, WebSocket } from 'ws';
import { authenticate, JwtVerifyConfig } from './auth/socket-auth.guard';
import { canSubscribe, SocketClaims } from './auth/channel-authz';
import { canAddSubscription, BackpressureLimits, DEFAULT_LIMITS } from './backpressure/policy';
import { sendWithBackpressure } from './backpressure/slow-consumer.eviction';
import { PresenceCounter } from './channels/presence';
import { SocketMetrics } from './metrics/socket-metrics';

const WS_CLOSE_UNAUTHORIZED = 4401;     // app-defined: handshake auth failed
const WS_CLOSE_POLICY = 1008;           // protocol/policy violation (bad message)

interface SocketState { claims: SocketClaims; subs: Set<string>; queued: number }

export interface WsServerDeps {
  jwt: JwtVerifyConfig;
  limits?: BackpressureLimits;
  metrics: SocketMetrics;
}

export class WsServer {
  private readonly limits: BackpressureLimits;
  private readonly state = new WeakMap<WebSocket, SocketState>();
  private readonly byChannel = new Map<string, Set<WebSocket>>();   // channel → local sockets (fan-out index)
  private readonly presence = new PresenceCounter();

  constructor(private readonly wss: WebSocketServer, private readonly deps: WsServerDeps) {
    this.limits = deps.limits ?? DEFAULT_LIMITS;
    this.wss.on('connection', (ws: WebSocket, req: { headers: Record<string, string | string[] | undefined>; url?: string }) => {
      this.onConnection(ws, req);
    });
  }

  private onConnection(ws: WebSocket, req: { headers: Record<string, string | string[] | undefined>; url?: string }): void {
    const authHeader = (req.headers['authorization'] as string | undefined);
    const claims = authenticate(authHeader, req.url, this.deps.jwt);
    if (!claims) {
      this.deps.metrics.authFailed();
      try { ws.close(WS_CLOSE_UNAUTHORIZED, 'unauthorized'); } catch { /* noop */ }
      return;
    }
    this.state.set(ws, { claims, subs: new Set(), queued: 0 });
    this.deps.metrics.connOpened();
    ws.on('message', (raw: unknown) => this.onMessage(ws, String(raw)));
    ws.on('close', () => this.onClose(ws));
    ws.on('error', () => this.onClose(ws));
  }

  private onMessage(ws: WebSocket, raw: string): void {
    const st = this.state.get(ws);
    if (!st) return;
    if (raw.length > 1024) { try { ws.close(WS_CLOSE_POLICY, 'message_too_large'); } catch { /* noop */ } return; }
    let msg: { action?: string; channel?: string };
    try { msg = JSON.parse(raw); } catch { return; }   // ignore malformed frames (don't crash)
    const channel = typeof msg.channel === 'string' ? msg.channel : '';
    if (msg.action === 'subscribe') this.subscribe(ws, st, channel);
    else if (msg.action === 'unsubscribe') this.unsubscribe(ws, st, channel);
    // unknown actions are ignored (forward-compatible)
  }

  private subscribe(ws: WebSocket, st: SocketState, channel: string): void {
    if (st.subs.has(channel)) return;                       // idempotent
    if (!canAddSubscription(st.subs.size, this.limits)) { this.deps.metrics.subDenied('too_many'); return; }
    const authz = canSubscribe(st.claims, channel);
    if (!authz.ok) {                                        // the security gate — cross-tenant/owner/perm
      this.deps.metrics.subDenied(authz.reason);
      this.safeSend(ws, st, JSON.stringify({ type: 'subscribe_denied', channel, reason: authz.reason }));
      return;
    }
    st.subs.add(channel);
    let set = this.byChannel.get(channel);
    if (!set) { set = new Set(); this.byChannel.set(channel, set); }
    set.add(ws);
    const watching = this.presence.join(channel);
    this.deps.metrics.subscribed();
    this.safeSend(ws, st, JSON.stringify({ type: 'subscribed', channel, watching }));
  }

  private unsubscribe(ws: WebSocket, st: SocketState, channel: string): void {
    if (!st.subs.delete(channel)) return;
    this.byChannel.get(channel)?.delete(ws);
    if (this.byChannel.get(channel)?.size === 0) this.byChannel.delete(channel);
    this.presence.leave(channel);
  }

  private onClose(ws: WebSocket): void {
    const st = this.state.get(ws);
    if (!st) return;
    for (const ch of st.subs) {
      this.byChannel.get(ch)?.delete(ws);
      if (this.byChannel.get(ch)?.size === 0) this.byChannel.delete(ch);
      this.presence.leave(ch);
    }
    this.state.delete(ws);
    this.deps.metrics.connClosed();
  }

  /** Forward a published message to every LOCAL socket subscribed to `channel`. Called by the Redis adapter. */
  dispatch(channel: string, payload: string): void {
    const set = this.byChannel.get(channel);
    if (!set || set.size === 0) return;
    for (const ws of set) {
      const st = this.state.get(ws);
      if (!st) { set.delete(ws); continue; }
      const result = sendWithBackpressure(ws, payload, st.queued, this.limits);
      if (result === 'sent') this.deps.metrics.messageOut();
      else if (result === 'dropped') this.deps.metrics.messageDropped();
      else { this.deps.metrics.slowConsumerEvicted(); /* close handler will clean up indexes */ }
    }
  }

  private safeSend(ws: WebSocket, st: SocketState, payload: string): void {
    const r = sendWithBackpressure(ws, payload, st.queued, this.limits);
    if (r === 'sent') this.deps.metrics.messageOut(); else this.deps.metrics.messageDropped();
  }
}
