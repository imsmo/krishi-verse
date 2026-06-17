// modules/payments/gateway/gateway.registry.ts · resolves a PaymentGateway by provider_code.
// Adapters are registered at module init (sandbox always; razorpay when configured). The default
// provider for new intents comes from config so flipping PSPs is config, not code.
import { Injectable } from '@nestjs/common';
import { InfraError } from '../../../shared/errors/app-error';
import { PaymentGateway } from './payment-gateway.port';

export const GATEWAY_REGISTRY = Symbol('GATEWAY_REGISTRY');

@Injectable()
export class GatewayRegistry {
  private readonly byCode = new Map<string, PaymentGateway>();
  private defaultCode = 'sandbox';

  register(g: PaymentGateway, asDefault = false): void { this.byCode.set(g.providerCode, g); if (asDefault) this.defaultCode = g.providerCode; }
  get(code: string): PaymentGateway {
    const g = this.byCode.get(code);
    if (!g) throw new InfraError('PAYMENT_NO_GATEWAY', `No payment gateway registered for '${code}'`, { code });
    return g;
  }
  default(): PaymentGateway { return this.get(this.defaultCode); }
  has(code: string): boolean { return this.byCode.has(code); }
}
