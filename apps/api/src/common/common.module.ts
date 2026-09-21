import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { CryptoService } from './crypto.service';
import { InventoryService } from './inventory.service';
import { CommissionService } from './commission.service';

@Global()
@Module({
  providers: [
    AuditLogService,
    CryptoService,
    InventoryService,
    CommissionService,
  ],
  exports: [
    AuditLogService,
    CryptoService,
    InventoryService,
    CommissionService,
  ],
})
export class CommonModule {}
