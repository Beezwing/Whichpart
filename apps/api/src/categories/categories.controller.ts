import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  UserRole,
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Public — needed to browse/search and to build the supplier product form. */
  @Get()
  list() {
    return this.categories.listTree();
  }
}

@Controller('admin/categories')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createCategorySchema))
    body: CreateCategoryInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.categories.create(admin.id, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCategorySchema))
    body: UpdateCategoryInput,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.categories.update(admin.id, id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() admin: AuthenticatedUser) {
    return this.categories.remove(admin.id, id);
  }
}
