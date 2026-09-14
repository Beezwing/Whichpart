import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { CryptoService } from './crypto.service';
import { InventoryService } from './inventory.service';

@Global()
@Module({
  providers: [AuditLogService, CryptoService, InventoryService],
  exports: [AuditLogService, CryptoService, InventoryService],
})
export class CommonModule {}
