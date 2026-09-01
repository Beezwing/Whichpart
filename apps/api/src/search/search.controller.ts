import { Controller, Get, Query } from '@nestjs/common';
import { SearchService, type SearchProductsQuery } from './search.service';

function toNumber(v?: string): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function toBool(v?: string): boolean | undefined {
  return v === 'true' ? true : undefined;
}

/** Public — no login required to browse or search (Rule 10, Section 2). */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('products')
  searchProducts(
    @Query('q') q?: string,
    @Query('make') make?: string,
    @Query('model') model?: string,
    @Query('year') year?: string,
    @Query('engine') engine?: string,
    @Query('engineCode') engineCode?: string,
    @Query('oem') oem?: string,
    @Query('mfrPartNumber') mfrPartNumber?: string,
    @Query('sku') sku?: string,
    @Query('categoryId') categoryId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('condition') condition?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('pickup') pickup?: string,
    @Query('delivery') delivery?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const query: SearchProductsQuery = {
      q,
      make,
      model,
      year: toNumber(year),
      engine,
      engineCode,
      oem,
      mfrPartNumber,
      sku,
      categoryId,
      supplierId,
      condition,
      minPrice: toNumber(minPrice),
      maxPrice: toNumber(maxPrice),
      pickup: toBool(pickup),
      delivery: toBool(delivery),
      lat: toNumber(lat),
      lng: toNumber(lng),
      sort: (sort as SearchProductsQuery['sort']) ?? 'relevance',
      page: toNumber(page) ?? 1,
      pageSize: Math.min(toNumber(pageSize) ?? 20, 50),
    };
    return this.search.searchProducts(query);
  }
}
