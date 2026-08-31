import { Injectable, NotFoundException } from '@nestjs/common';
import type { SavedVehicleInput } from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GarageService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireCustomerId(userId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!customer)
      throw new NotFoundException('No customer account found for this user.');
    return customer.id;
  }

  async list(userId: string) {
    const customerId = await this.requireCustomerId(userId);
    return this.prisma.savedVehicle.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, input: SavedVehicleInput) {
    const customerId = await this.requireCustomerId(userId);
    return this.prisma.savedVehicle.create({ data: { customerId, ...input } });
  }

  private async requireOwnVehicle(userId: string, vehicleId: string) {
    const customerId = await this.requireCustomerId(userId);
    const vehicle = await this.prisma.savedVehicle.findFirst({
      where: { id: vehicleId, customerId },
    });
    if (!vehicle) throw new NotFoundException('Saved vehicle not found.');
    return vehicle;
  }

  async update(userId: string, vehicleId: string, input: SavedVehicleInput) {
    await this.requireOwnVehicle(userId, vehicleId);
    return this.prisma.savedVehicle.update({
      where: { id: vehicleId },
      data: input,
    });
  }

  async remove(userId: string, vehicleId: string) {
    await this.requireOwnVehicle(userId, vehicleId);
    await this.prisma.savedVehicle.delete({ where: { id: vehicleId } });
  }
}
