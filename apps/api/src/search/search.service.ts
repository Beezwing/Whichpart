import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchProductsQuery {
  q?: string;
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  engineCode?: string;
  oem?: string;
  mfrPartNumber?: string;
  sku?: string;
  categoryId?: string;
  supplierId?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  pickup?: boolean;
  delivery?: boolean;
  lat?: number;
  lng?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'distance';
  page: number;
  pageSize: number;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Postgres-backed search — the source of truth stays authoritative
 * (Section 20). A dedicated search engine (Meilisearch) is the planned
 * performance layer on top of this once the catalog is large enough to
 * need it, but that requires deploying real infrastructure we haven't
 * set up yet — this works correctly without it in the meantime.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProducts(query: SearchProductsQuery) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      supplier: { verificationStatus: 'APPROVED' },
    };

    const and: Prisma.ProductWhereInput[] = [];

    if (query.q) {
      and.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { sku: { contains: query.q, mode: 'insensitive' } },
          { oemPartNumber: { contains: query.q, mode: 'insensitive' } },
          {
            manufacturerPartNumber: { contains: query.q, mode: 'insensitive' },
          },
          {
            compatibilities: {
              some: { notes: { contains: query.q, mode: 'insensitive' } },
            },
          },
        ],
      });
    }
    if (query.sku)
      and.push({ sku: { contains: query.sku, mode: 'insensitive' } });
    if (query.oem)
      and.push({ oemPartNumber: { contains: query.oem, mode: 'insensitive' } });
    if (query.mfrPartNumber)
      and.push({
        manufacturerPartNumber: {
          contains: query.mfrPartNumber,
          mode: 'insensitive',
        },
      });
    if (query.categoryId) and.push({ categoryId: query.categoryId });
    if (query.supplierId) and.push({ supplierId: query.supplierId });
    if (query.condition) and.push({ condition: query.condition as never });
    if (query.minPrice != null) and.push({ price: { gte: query.minPrice } });
    if (query.maxPrice != null) and.push({ price: { lte: query.maxPrice } });

    const compatConditions: Prisma.VehicleCompatibilityWhereInput[] = [];
    if (query.make)
      compatConditions.push({
        notes: { contains: query.make, mode: 'insensitive' },
      });
    if (query.model)
      compatConditions.push({
        notes: { contains: query.model, mode: 'insensitive' },
      });
    if (query.engine)
      compatConditions.push({
        notes: { contains: query.engine, mode: 'insensitive' },
      });
    if (query.engineCode)
      compatConditions.push({
        notes: { contains: query.engineCode, mode: 'insensitive' },
      });
    if (query.year) {
      compatConditions.push({
        OR: [
          {
            AND: [
              { yearFrom: { lte: query.year } },
              { yearTo: { gte: query.year } },
            ],
          },
          { AND: [{ yearFrom: null }, { yearTo: null }] },
        ],
      });
    }
    if (compatConditions.length > 0) {
      and.push({ compatibilities: { some: { AND: compatConditions } } });
    }

    if (query.pickup)
      and.push({
        inventory: { some: { location: { pickupAvailable: true } } },
      });
    if (query.delivery)
      and.push({
        inventory: { some: { location: { deliveryAvailable: true } } },
      });

    if (and.length > 0) where.AND = and;

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      query.sort === 'price_asc'
        ? { price: 'asc' }
        : query.sort === 'price_desc'
          ? { price: 'desc' }
          : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { id: true, name: true } },
          supplier: {
            select: { id: true, tradingName: true, verificationStatus: true },
          },
          inventory: { include: { location: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const results = items.map((product) => {
      const totalQuantity = product.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0,
      );
      const locations = product.inventory.map((inv) => ({
        id: inv.location.id,
        name: inv.location.name,
        quantity: inv.quantity,
        pickupAvailable: inv.location.pickupAvailable,
        deliveryAvailable: inv.location.deliveryAvailable,
        distanceKm:
          query.lat != null &&
          query.lng != null &&
          inv.location.latitude != null &&
          inv.location.longitude != null
            ? Math.round(
                haversineKm(
                  query.lat,
                  query.lng,
                  inv.location.latitude,
                  inv.location.longitude,
                ) * 10,
              ) / 10
            : null,
      }));

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        condition: product.condition,
        price: product.price,
        currency: product.currency,
        category: product.category,
        imageUrl: product.images[0]?.url ?? null,
        supplier: product.supplier,
        totalQuantity,
        locations,
        nearestDistanceKm: locations.reduce<number | null>((min, l) => {
          if (l.distanceKm == null) return min;
          if (min == null) return l.distanceKm;
          return Math.min(min, l.distanceKm);
        }, null),
      };
    });

    if (query.sort === 'distance' && query.lat != null && query.lng != null) {
      results.sort((a, b) => {
        if (a.nearestDistanceKm == null) return 1;
        if (b.nearestDistanceKm == null) return -1;
        return a.nearestDistanceKm - b.nearestDistanceKm;
      });
    }

    return {
      items: results,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
