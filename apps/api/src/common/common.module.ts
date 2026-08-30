import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [AuditLogService, CryptoService],
  exports: [AuditLogService, CryptoService],
})
export class CommonModule {}
