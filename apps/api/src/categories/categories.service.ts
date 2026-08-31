import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from '@autoparts/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit-log.service';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  /** Public — the whole tree, small enough to hand back in one shot. */
  async listTree() {
    const all = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
    const byParent = new Map<string | null, typeof all>();
    for (const category of all) {
      const key = category.parentId;
      byParent.set(key, [...(byParent.get(key) ?? []), category]);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        children: build(c.id),
      }));
    return build(null);
  }

  async create(adminUserId: string, input: CreateCategoryInput) {
    if (input.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: input.parentId },
      });
      if (!parent) throw new BadRequestException('Parent category not found.');
    }

    const baseSlug = slugify(input.name);
    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${++suffix}`;
    }

    const category = await this.prisma.category.create({
      data: { name: input.name, slug, parentId: input.parentId },
    });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'CATEGORY_CREATED',
      resourceType: 'Category',
      resourceId: category.id,
    });
    return category;
  }

  async update(adminUserId: string, id: string, input: UpdateCategoryInput) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found.');

    if (input.parentId === id) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: { name: input.name, parentId: input.parentId },
    });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'CATEGORY_UPDATED',
      resourceType: 'Category',
      resourceId: id,
    });
    return updated;
  }

  async remove(adminUserId: string, id: string) {
    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);
    if (childCount > 0)
      throw new BadRequestException('Remove or move its subcategories first.');
    if (productCount > 0)
      throw new BadRequestException(
        'Products are still assigned to this category.',
      );

    await this.prisma.category.delete({ where: { id } });
    await this.auditLog.record({
      actorUserId: adminUserId,
      action: 'CATEGORY_DELETED',
      resourceType: 'Category',
      resourceId: id,
    });
  }
}
