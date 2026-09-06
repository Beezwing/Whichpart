import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SearchTermSort = 'searchCount' | 'noResultCount' | 'recent';

/**
 * Read-only view over SearchTermStat (Section: search history). This is
 * aggregate-only data by construction — the table itself has no userId,
 * session, or IP, so there is nothing here to anonymize or redact.
 */
@Injectable()
export class AdminSearchTermsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sort: SearchTermSort, page: number, pageSize: number) {
    const orderBy =
      sort === 'noResultCount'
        ? { noResultCount: 'desc' as const }
        : sort === 'recent'
          ? { lastSearchedAt: 'desc' as const }
          : { searchCount: 'desc' as const };

    const [rows, total, totals] = await Promise.all([
      this.prisma.searchTermStat.findMany({
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.searchTermStat.count(),
      this.prisma.searchTermStat.aggregate({
        _sum: { searchCount: true, noResultCount: true },
      }),
    ]);

    const items = rows.map((row) => ({
      ...row,
      noResultRate:
        row.searchCount > 0
          ? Math.round((row.noResultCount / row.searchCount) * 1000) / 10
          : 0,
    }));

    return {
      items,
      total,
      page,
      pageSize,
      summary: {
        distinctTerms: total,
        totalSearches: totals._sum.searchCount ?? 0,
        totalNoResultSearches: totals._sum.noResultCount ?? 0,
      },
    };
  }
}
