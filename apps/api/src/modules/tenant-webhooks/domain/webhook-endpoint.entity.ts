// modules/tenant-webhooks/domain/webhook-endpoint.entity.ts · a tenant's webhook endpoint (0002 webhook_endpoints).
// secret_hash stores the ENCRYPTED signing secret (AES-256-GCM via core/crypto) — never plaintext, never returned.
// serialize() is the wire shape: url + eventTypes + isActive, NEVER the secret material.
export interface WebhookEndpointProps {
  id: string; tenantId: string; url: string; secretEnc: string;
  eventTypes: string[]; isActive: boolean; createdAt?: string | null;
}

export class WebhookEndpoint {
  constructor(private readonly props: WebhookEndpointProps) {}
  get id() { return this.props.id; }
  get url() { return this.props.url; }
  get eventTypes() { return this.props.eventTypes; }
  toProps(): WebhookEndpointProps { return this.props; }

  serialize() {
    const p = this.props;
    return { id: p.id, url: p.url, eventTypes: p.eventTypes ?? [], isActive: p.isActive, createdAt: p.createdAt ?? null };
  }
}
