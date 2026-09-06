import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  AdminSearchTermsService,
  type SearchTermSort,
} from './admin-search-terms.service';

const VALID_SORTS: SearchTermSort[] = [
  'searchCount',
  'noResultCount',
  'recent',
];

@Controller('admin/search-terms')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminSearchTermsController {
  constructor(private readonly adminSearchTerms: AdminSearchTermsService) {}

  @Get()
  list(
    @Query('sort') sort?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    const safeSort = VALID_SORTS.includes(sort as SearchTermSort)
      ? (sort as SearchTermSort)
      : 'searchCount';
    return this.adminSearchTerms.list(
      safeSort,
      Number(page) || 1,
      Math.min(Number(pageSize) || 50, 100),
    );
  }
}
