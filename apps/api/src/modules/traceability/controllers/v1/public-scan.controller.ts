// modules/traceability/controllers/v1/public-scan.controller.ts · PUBLIC, UNAUTHENTICATED farm-to-fork QR scan.
// No guards: the unguessable qr_token is the capability. Returns ONLY the curated non-PII provenance projection
// (via the SECURITY DEFINER trace_scan() function). Flag-gated inside the service (404 when off). No tenant
// context, no IDOR surface (you can only read what the token you hold points to).
import { Controller, Get, Param } from '@nestjs/common';
import { PublicScanService } from '../../services/public-scan.service';

@Controller({ path: 'traceability/scan', version: '1' })
export class PublicScanController {
  constructor(private readonly svc: PublicScanService) {}

  @Get(':qrToken')
  scan(@Param('qrToken') qrToken: string) { return this.svc.scan(qrToken).then((data) => ({ data })); }
}
