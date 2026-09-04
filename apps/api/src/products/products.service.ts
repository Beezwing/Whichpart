import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateProductInput,
  ProductImportRow,
  UpdateInventoryInput,
  UpdateProductInput,
} from '@autoparts/shared';
import { productImportRowSchema, ProductCondition } from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';
import { StorageService } from '../storage/storage.service';
import { AiCategorizationService } from '../ai/ai-categorization.service';
import {
  generateImportTemplate,
  parseImportWorkbook,
  type RawImportRow,
} from './inventory-xlsx.util';

const PRODUCT_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' as const } },
  inventory: { include: { location: true } },
  compatibilities: true,
  category: true,
  brand: true,
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly storage: StorageService,
    private readonly ai: AiCategorizationService,
  ) {}

  private async requireSupplierId(userId: string): Promise<string> {
    const supplierUser = await this.prisma.supplierUser.findFirst({
      where: { userId },
      select: { supplierId: true },
    });
    if (!supplierUser)
      throw new NotFoundException('No supplier account found for this user.');
    return supplierUser.supplierId;
  }

  private async requireOwnProduct(userId: string, productId: string) {
    const supplierId = await this.requireSupplierId(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, supplierId },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  private async findOrCreateBrand(name: string | undefined) {
    if (!name?.trim()) return undefined;
    const brand = await this.prisma.brand.upsert({
      where: { name: name.trim() },
      create: { name: name.trim() },
      update: {},
    });
    return brand.id;
  }

  private async findCategoryByName(name: string | undefined) {
    if (!name?.trim()) return undefined;
    const category = await this.prisma.category.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
    });
    return category?.id;
  }

  async list(
    userId: string,
    filters: { isActive?: boolean; lowStock?: boolean; search?: string },
  ) {
    const supplierId = await this.requireSupplierId(userId);
    const products = await this.prisma.product.findMany({
      where: {
        supplierId,
        isActive: filters.isActive,
        ...(filters.search
          ? { name: { contains: filters.search, mode: 'insensitive' as const } }
          : {}),
      },
      include: PRODUCT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    if (!filters.lowStock) return products;
    return products.filter((p) =>
      p.inventory.some(
        (inv) =>
          inv.lowStockThreshold != null &&
          inv.quantity <= inv.lowStockThreshold,
      ),
    );
  }

  async get(userId: string, productId: string) {
    return this.requireOwnProduct(userId, productId);
  }

  async create(userId: string, input: CreateProductInput) {
    const supplierId = await this.requireSupplierId(userId);

    const location = await this.prisma.supplierLocation.findFirst({
      where: { id: input.locationId, supplierId },
    });
    if (!location)
      throw new BadRequestException(
        'That location does not belong to your account.',
      );

    const existing = await this.prisma.product.findUnique({
      where: { supplierId_sku: { supplierId, sku: input.sku } },
    });
    if (existing)
      throw new BadRequestException(`SKU "${input.sku}" is already in use.`);

    const brandId = await this.findOrCreateBrand(input.brand);
    const categoryId = input.categoryId;

    const product = await this.prisma.product.create({
      data: {
        supplierId,
        sku: input.sku,
        name: input.name,
        description: input.description,
        categoryId,
        brandId,
        condition: input.condition,
        price: input.price,
        oemPartNumber: input.oemPartNumber,
        manufacturerPartNumber: input.manufacturerPartNumber,
        inventory: {
          create: { locationId: input.locationId, quantity: input.quantity },
        },
        compatibilities: input.compatibility
          ? {
              create: {
                yearFrom: input.compatibility.yearFrom,
                yearTo: input.compatibility.yearTo,
                notes: this.formatCompatibilityNotes(input.compatibility),
              },
            }
          : undefined,
      },
      include: PRODUCT_INCLUDE,
    });

    await this.auditLog.record({
      actorUserId: userId,
      action: 'PRODUCT_CREATED',
      resourceType: 'Product',
      resourceId: product.id,
    });

    // Best-effort, single product: worth waiting for so the supplier sees
    // a suggestion immediately. Never blocks creation if it fails.
    if (!categoryId)
      await this.runAiSuggestion(
        product.id,
        product.name,
        product.description ?? undefined,
      );

    return this.requireOwnProduct(userId, product.id);
  }

  private formatCompatibilityNotes(
    c: NonNullable<CreateProductInput['compatibility']>,
  ): string {
    const parts = [
      c.make && `Make: ${c.make}`,
      c.model && `Model: ${c.model}`,
      c.engine && `Engine: ${c.engine}`,
      c.engineCode && `Engine Code: ${c.engineCode}`,
      c.transmission && `Transmission: ${c.transmission}`,
      c.notes && `Notes: ${c.notes}`,
    ].filter(Boolean);
    return parts.join(' | ');
  }

  async update(userId: string, productId: string, input: UpdateProductInput) {
    const product = await this.requireOwnProduct(userId, productId);
    const brandId =
      input.brand !== undefined
        ? await this.findOrCreateBrand(input.brand)
        : undefined;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        brandId,
        condition: input.condition,
        price: input.price,
        oemPartNumber: input.oemPartNumber,
        manufacturerPartNumber: input.manufacturerPartNumber,
      },
    });

    await this.auditLog.record({
      actorUserId: userId,
      action: 'PRODUCT_UPDATED',
      resourceType: 'Product',
      resourceId: productId,
      metadata:
        input.price !== undefined && Number(product.price) !== input.price
          ? {
              priceChangedFrom: product.price.toString(),
              priceChangedTo: input.price,
            }
          : undefined,
    });

    return this.requireOwnProduct(userId, productId);
  }

  async setActive(userId: string, productId: string, isActive: boolean) {
    await this.requireOwnProduct(userId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: { isActive },
    });
    await this.auditLog.record({
      actorUserId: userId,
      action: isActive ? 'PRODUCT_REACTIVATED' : 'PRODUCT_DEACTIVATED',
      resourceType: 'Product',
      resourceId: productId,
    });
  }

  async remove(userId: string, productId: string) {
    const product = await this.requireOwnProduct(userId, productId);
    for (const image of product.images) await this.storage.delete(image.url);
    await this.prisma.product.delete({ where: { id: productId } });
    await this.auditLog.record({
      actorUserId: userId,
      action: 'PRODUCT_DELETED',
      resourceType: 'Product',
      resourceId: productId,
    });
  }

  // ---------- AI suggestion approval (Section 12, Rules 6-8) ----------

  async approveAiSuggestion(userId: string, productId: string) {
    const product = await this.requireOwnProduct(userId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        categoryId: product.aiSuggestedCategoryId ?? product.categoryId,
        description: product.aiCleanedDescription ?? product.description,
        aiSuggestionApproved: true,
      },
    });
    return this.requireOwnProduct(userId, productId);
  }

  async dismissAiSuggestion(userId: string, productId: string) {
    await this.requireOwnProduct(userId, productId);
    await this.prisma.product.update({
      where: { id: productId },
      data: {
        aiSuggestedCategoryId: null,
        aiSuggestedKeywords: [],
        aiCleanedDescription: null,
      },
    });
    return this.requireOwnProduct(userId, productId);
  }

  private async runAiSuggestion(
    productId: string,
    name: string,
    description?: string,
  ) {
    if (!this.ai.isConfigured()) return;
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true },
    });
    const result = await this.ai.categorize({ name, description }, categories);
    if (!result) return;

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        aiSuggestedCategoryId: result.suggestedCategoryId,
        aiSuggestedKeywords: result.suggestedKeywords ?? [],
        aiCleanedDescription: result.cleanedDescription,
      },
    });
  }

  // ---------- Images (Section 13) ----------

  async addImage(
    userId: string,
    productId: string,
    file: { buffer: Buffer; originalname: string },
  ) {
    const product = await this.requireOwnProduct(userId, productId);
    const key = await this.storage.save(file.buffer, file.originalname);
    const isFirst = product.images.length === 0;
    return this.prisma.productImage.create({
      data: {
        productId,
        url: key,
        isPrimary: isFirst,
        sortOrder: product.images.length,
      },
    });
  }

  /**
   * Bulk-import (Section 10) only ever carries text/number fields — a
   * spreadsheet can't hold image bytes — so a supplier who imports
   * hundreds of products via spreadsheet has no photos on any of them
   * afterward. This lets them attach photos in one pass by naming each
   * file after the product's SKU (e.g. "MIT-SHO-065.jpg"), matching
   * purely on filename since that's the only thing tying a photo to a
   * product before it's attached. Never touches price/qty/sku.
   */
  async bulkAddImages(
    userId: string,
    files: { buffer: Buffer; originalname: string }[],
  ) {
    const supplierId = await this.requireSupplierId(userId);
    const products = await this.prisma.product.findMany({
      where: { supplierId },
      select: {
        id: true,
        sku: true,
        name: true,
        _count: { select: { images: true } },
      },
    });
    const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
    // Tracks how many images we've queued for a product in this same
    // batch, so two files matching the same SKU don't both claim to be
    // "the first" image or collide on sortOrder.
    const pendingCount = new Map<string, number>();

    const matched: {
      filename: string;
      sku: string;
      productId: string;
      productName: string;
    }[] = [];
    const unmatched: string[] = [];

    for (const file of files) {
      const sku = file.originalname.replace(/\.[^./\\]+$/, '');
      const product = bySku.get(sku.toLowerCase());
      if (!product) {
        unmatched.push(file.originalname);
        continue;
      }

      const alreadyQueued = pendingCount.get(product.id) ?? 0;
      const key = await this.storage.save(file.buffer, file.originalname);
      await this.prisma.productImage.create({
        data: {
          productId: product.id,
          url: key,
          isPrimary: product._count.images === 0 && alreadyQueued === 0,
          sortOrder: product._count.images + alreadyQueued,
        },
      });
      pendingCount.set(product.id, alreadyQueued + 1);
      matched.push({
        filename: file.originalname,
        sku: product.sku,
        productId: product.id,
        productName: product.name,
      });
    }

    return { matched, unmatched };
  }

  async setPrimaryImage(userId: string, productId: string, imageId: string) {
    const product = await this.requireOwnProduct(userId, productId);
    if (!product.images.some((img) => img.id === imageId))
      throw new NotFoundException('Image not found.');

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);
  }

  async deleteImage(userId: string, productId: string, imageId: string) {
    const product = await this.requireOwnProduct(userId, productId);
    const image = product.images.find((img) => img.id === imageId);
    if (!image) throw new NotFoundException('Image not found.');

    await this.storage.delete(image.url);
    await this.prisma.productImage.delete({ where: { id: imageId } });
  }

  /** Public (Section 13) — see the ProductImagesController doc comment. */
  async getImageFile(imageId: string) {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    if (!image) throw new NotFoundException('Image not found.');
    return this.storage.read(image.url);
  }

  // ---------- Inventory (Section 9, 35) ----------

  async updateInventory(
    userId: string,
    productId: string,
    locationId: string,
    input: UpdateInventoryInput,
  ) {
    const supplierId = await this.requireSupplierId(userId);
    await this.requireOwnProduct(userId, productId);
    const location = await this.prisma.supplierLocation.findFirst({
      where: { id: locationId, supplierId },
    });
    if (!location)
      throw new BadRequestException(
        'That location does not belong to your account.',
      );

    const inventory = await this.prisma.inventoryLocation.upsert({
      where: { productId_locationId: { productId, locationId } },
      create: {
        productId,
        locationId,
        quantity: input.quantity,
        lowStockThreshold: input.lowStockThreshold,
        criticalStockThreshold: input.criticalStockThreshold,
      },
      update: {
        quantity: input.quantity,
        lowStockThreshold: input.lowStockThreshold,
        criticalStockThreshold: input.criticalStockThreshold,
      },
    });

    await this.maybeSendStockAlert(productId, inventory);
    return inventory;
  }

  private async maybeSendStockAlert(
    productId: string,
    inventory: {
      quantity: number;
      lowStockThreshold: number | null;
      criticalStockThreshold: number | null;
    },
  ) {
    const isCritical =
      inventory.criticalStockThreshold != null &&
      inventory.quantity <= inventory.criticalStockThreshold;
    const isLow =
      inventory.lowStockThreshold != null &&
      inventory.quantity <= inventory.lowStockThreshold;
    if (!isCritical && !isLow) return;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { supplier: { include: { users: true } } },
    });
    if (!product) return;

    await this.prisma.notification.createMany({
      data: product.supplier.users.map((su) => ({
        userId: su.userId,
        type: isCritical ? 'CRITICAL_STOCK' : 'LOW_STOCK',
        title: isCritical ? 'Critical stock level' : 'Low stock warning',
        body: `${product.name} (${product.sku}) has ${inventory.quantity} left.`,
      })),
    });
  }

  // ---------- Bulk import (Section 10-12) ----------

  async downloadTemplate() {
    return generateImportTemplate();
  }

  async bulkImport(userId: string, fileBuffer: Buffer) {
    const supplierId = await this.requireSupplierId(userId);

    let rawRows: RawImportRow[];
    try {
      rawRows = await parseImportWorkbook(fileBuffer);
    } catch {
      throw new BadRequestException(
        "That file couldn't be read as an Excel workbook — please use the downloadable template.",
      );
    }

    const locations = await this.prisma.supplierLocation.findMany({
      where: { supplierId },
    });
    const locationByName = new Map(
      locations.map((l) => [l.name.toLowerCase(), l]),
    );

    const summary = {
      totalRows: rawRows.length,
      created: 0,
      updated: 0,
      errors: [] as { row: number; message: string }[],
      warnings: [] as { row: number; message: string }[],
    };

    const seenSkus = new Set<string>();

    for (const raw of rawRows) {
      const coerced = this.coerceRow(raw.values);
      const parsed = productImportRowSchema.safeParse(coerced);
      if (!parsed.success) {
        summary.errors.push({
          row: raw.rowNumber,
          message: parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        });
        continue;
      }
      const row = parsed.data;

      if (seenSkus.has(row.sku)) {
        summary.errors.push({
          row: raw.rowNumber,
          message: `Duplicate SKU "${row.sku}" elsewhere in this file.`,
        });
        continue;
      }
      seenSkus.add(row.sku);

      const location = locationByName.get(row.location.toLowerCase());
      if (!location) {
        summary.errors.push({
          row: raw.rowNumber,
          message: `Location "${row.location}" doesn't match any location you've created.`,
        });
        continue;
      }

      try {
        const result = await this.upsertFromImportRow(
          supplierId,
          location.id,
          row,
        );
        if (result === 'created') summary.created += 1;
        else summary.updated += 1;

        if (row.category) {
          const matched = await this.findCategoryByName(row.category);
          if (!matched) {
            summary.warnings.push({
              row: raw.rowNumber,
              message: `Category "${row.category}" doesn't match an existing category — left uncategorized for review.`,
            });
          }
        }
      } catch (error) {
        summary.errors.push({
          row: raw.rowNumber,
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected error saving this row.',
        });
      }
    }

    await this.auditLog.record({
      actorUserId: userId,
      action: 'PRODUCTS_BULK_IMPORTED',
      resourceType: 'Supplier',
      resourceId: supplierId,
      metadata: {
        totalRows: summary.totalRows,
        created: summary.created,
        updated: summary.updated,
        errorCount: summary.errors.length,
      },
    });

    return summary;
  }

  /**
   * Spreadsheet cells arrive as strings, numbers, Dates, or (for rich-text
   * / hyperlink cells) small ExcelJS objects — never assume it's already
   * a plain string.
   */
  private coerceRow(values: Record<string, unknown>): Record<string, unknown> {
    const asString = (v: unknown): string | undefined => {
      if (v == null) return undefined;
      if (typeof v === 'string') return v.trim() || undefined;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'object') {
        const obj = v as { richText?: { text: string }[]; text?: unknown };
        if (Array.isArray(obj.richText))
          return (
            obj.richText
              .map((r) => r.text)
              .join('')
              .trim() || undefined
          );
        if (typeof obj.text === 'string') return obj.text.trim() || undefined;
      }
      return undefined;
    };
    const asNumber = (v: unknown) =>
      v == null || v === '' ? undefined : Number(v);
    const conditionRaw = asString(values.condition)?.toUpperCase();
    return {
      sku: asString(values.sku),
      name: asString(values.name),
      description: asString(values.description),
      category: asString(values.category),
      subcategory: asString(values.subcategory),
      brand: asString(values.brand),
      make: asString(values.make),
      model: asString(values.model),
      yearFrom: asNumber(values.yearFrom),
      yearTo: asNumber(values.yearTo),
      engine: asString(values.engine),
      engineCode: asString(values.engineCode),
      transmission: asString(values.transmission),
      oemPartNumber: asString(values.oemPartNumber),
      manufacturerPartNumber: asString(values.manufacturerPartNumber),
      condition:
        conditionRaw &&
        (Object.values(ProductCondition) as string[]).includes(conditionRaw)
          ? conditionRaw
          : conditionRaw,
      price: asNumber(values.price),
      quantity: asNumber(values.quantity),
      location: asString(values.location),
      compatibilityNotes: asString(values.compatibilityNotes),
    };
  }

  private async upsertFromImportRow(
    supplierId: string,
    locationId: string,
    row: ProductImportRow,
  ): Promise<'created' | 'updated'> {
    const brandId = await this.findOrCreateBrand(row.brand);
    const categoryId =
      (await this.findCategoryByName(row.subcategory)) ??
      (await this.findCategoryByName(row.category));

    const compatibilityNotes = [
      row.make && `Make: ${row.make}`,
      row.model && `Model: ${row.model}`,
      row.engine && `Engine: ${row.engine}`,
      row.engineCode && `Engine Code: ${row.engineCode}`,
      row.transmission && `Transmission: ${row.transmission}`,
      row.compatibilityNotes && `Notes: ${row.compatibilityNotes}`,
    ]
      .filter(Boolean)
      .join(' | ');

    const existing = await this.prisma.product.findUnique({
      where: { supplierId_sku: { supplierId, sku: row.sku } },
    });

    const productId = await this.prisma.$transaction(async (tx) => {
      const product = existing
        ? await tx.product.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              description: row.description,
              categoryId: categoryId ?? existing.categoryId,
              brandId: brandId ?? existing.brandId,
              condition: row.condition,
              price: row.price,
              oemPartNumber: row.oemPartNumber,
              manufacturerPartNumber: row.manufacturerPartNumber,
            },
          })
        : await tx.product.create({
            data: {
              supplierId,
              sku: row.sku,
              name: row.name,
              description: row.description,
              categoryId,
              brandId,
              condition: row.condition,
              price: row.price,
              oemPartNumber: row.oemPartNumber,
              manufacturerPartNumber: row.manufacturerPartNumber,
            },
          });

      await tx.inventoryLocation.upsert({
        where: { productId_locationId: { productId: product.id, locationId } },
        create: { productId: product.id, locationId, quantity: row.quantity },
        update: { quantity: row.quantity },
      });

      if (compatibilityNotes) {
        const existingCompat = await tx.vehicleCompatibility.findFirst({
          where: { productId: product.id },
        });
        if (existingCompat) {
          await tx.vehicleCompatibility.update({
            where: { id: existingCompat.id },
            data: {
              yearFrom: row.yearFrom,
              yearTo: row.yearTo,
              notes: compatibilityNotes,
            },
          });
        } else {
          await tx.vehicleCompatibility.create({
            data: {
              productId: product.id,
              yearFrom: row.yearFrom,
              yearTo: row.yearTo,
              notes: compatibilityNotes,
            },
          });
        }
      }

      return product.id;
    });

    if (!categoryId)
      await this.runAiSuggestion(productId, row.name, row.description);

    return existing ? 'updated' : 'created';
  }
}
