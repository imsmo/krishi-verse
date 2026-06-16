// core/audit/audit.module.ts · global append-only audit writer.
import { Global, Module } from '@nestjs/common';
import { AuditWriter, AUDIT_WRITER } from './audit.writer';

@Global()
@Module({
  providers: [AuditWriter, { provide: AUDIT_WRITER, useExisting: AuditWriter }],
  exports: [AuditWriter, AUDIT_WRITER],
})
export class AuditModule {}
