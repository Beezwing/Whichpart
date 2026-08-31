import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateEngineInput,
  CreateMakeInput,
  CreateModelInput,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  listMakes() {
    return this.prisma.make.findMany({ orderBy: { name: 'asc' } });
  }

  async listModels(makeId: string) {
    return this.prisma.model.findMany({
      where: { makeId },
      orderBy: { name: 'asc' },
    });
  }

  async listEngines(modelId: string) {
    return this.prisma.engine.findMany({
      where: { modelId },
      orderBy: { code: 'asc' },
    });
  }

  async createMake(adminUserId: string, input: CreateMakeInput) {
    const existing = await this.prisma.make.findUnique({
      where: { name: input.name },
    });
    if (existing) throw new BadRequestException('That make already exists.');
    const make = await this.prisma.make.create({ data: { name: input.name } });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'VEHICLE_MAKE_CREATED',
      resourceType: 'Make',
      resourceId: make.id,
    });
    return make;
  }

  async deleteMake(adminUserId: string, id: string) {
    const modelCount = await this.prisma.model.count({ where: { makeId: id } });
    if (modelCount > 0)
      throw new BadRequestException('Remove its models first.');
    await this.prisma.make.delete({ where: { id } });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'VEHICLE_MAKE_DELETED',
      resourceType: 'Make',
      resourceId: id,
    });
  }

  async createModel(adminUserId: string, input: CreateModelInput) {
    const make = await this.prisma.make.findUnique({
      where: { id: input.makeId },
    });
    if (!make) throw new NotFoundException('Make not found.');

    const existing = await this.prisma.model.findUnique({
      where: { makeId_name: { makeId: input.makeId, name: input.name } },
    });
    if (existing)
      throw new BadRequestException('That model already exists for this make.');

    const model = await this.prisma.model.create({
      data: { makeId: input.makeId, name: input.name },
    });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'VEHICLE_MODEL_CREATED',
      resourceType: 'Model',
      resourceId: model.id,
    });
    return model;
  }

  async deleteModel(adminUserId: string, id: string) {
    const engineCount = await this.prisma.engine.count({
      where: { modelId: id },
    });
    if (engineCount > 0)
      throw new BadRequestException('Remove its engines first.');
    await this.prisma.model.delete({ where: { id } });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'VEHICLE_MODEL_DELETED',
      resourceType: 'Model',
      resourceId: id,
    });
  }

  async createEngine(adminUserId: string, input: CreateEngineInput) {
    if (input.modelId) {
      const model = await this.prisma.model.findUnique({
        where: { id: input.modelId },
      });
      if (!model) throw new NotFoundException('Model not found.');
    }
    const engine = await this.prisma.engine.create({
      data: { modelId: input.modelId, code: input.code, name: input.name },
    });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'VEHICLE_ENGINE_CREATED',
      resourceType: 'Engine',
      resourceId: engine.id,
    });
    return engine;
  }

  async deleteEngine(adminUserId: string, id: string) {
    await this.prisma.engine.delete({ where: { id } });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'VEHICLE_ENGINE_DELETED',
      resourceType: 'Engine',
      resourceId: id,
    });
  }
}
