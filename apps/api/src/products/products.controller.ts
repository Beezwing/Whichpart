import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  createProductSchema,
  updateInventorySchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateInventoryInput,
  type UpdateProductInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProductsService } from './products.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_BULK_IMAGE_FILES = 500;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Some clients (including curl without an explicit --form type=) report
// generic application/octet-stream for zip-based formats like .xlsx —
// the real validation happens by actually parsing the file as a workbook
// (see ProductsService.bulkImport), not by trusting this header alone.
const ALLOWED_SPREADSHEET_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

@Controller('suppliers/me/products')
@Auth()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('isActive') isActive?: string,
    @Query('lowStock') lowStock?: string,
    @Query('search') search?: string,
  ) {
    return this.products.list(user.id, {
      isActive: isActive === undefined ? undefined : isActive === 'true',
      lowStock: lowStock === 'true',
      search,
    });
  }

  @Get('import-template')
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.products.downloadTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventory-template.xlsx"',
    );
    res.send(buffer);
  }

  @Post('bulk-import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  bulkImport(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!ALLOWED_SPREADSHEET_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Please upload an .xlsx file.');
    }
    return this.products.bulkImport(user.id, file.buffer);
  }

  @Post('bulk-images')
  @UseInterceptors(
    FilesInterceptor('files', MAX_BULK_IMAGE_FILES, {
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  bulkAddImages(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length)
      throw new BadRequestException('No files were uploaded.');
    const bad = files.find((f) => !ALLOWED_IMAGE_TYPES.includes(f.mimetype));
    if (bad) {
      throw new BadRequestException(
        `${bad.originalname}: only JPEG, PNG, or WEBP images are accepted.`,
      );
    }
    return this.products.bulkAddImages(
      user.id,
      files.map((f) => ({ buffer: f.buffer, originalname: f.originalname })),
    );
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) body: CreateProductInput,
  ) {
    return this.products.create(user.id, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.products.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) body: UpdateProductInput,
  ) {
    return this.products.update(user.id, id, body);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.products.setActive(user.id, id, true);
  }

  @Post(':id/deactivate')
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.products.setActive(user.id, id, false);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.products.remove(user.id, id);
  }

  @Post(':id/ai-suggestion/approve')
  approveAiSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.products.approveAiSuggestion(user.id, id);
  }

  @Post(':id/ai-suggestion/dismiss')
  dismissAiSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.products.dismissAiSuggestion(user.id, id);
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, or WEBP images are accepted.',
      );
    }
    return this.products.addImage(user.id, id, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  @Patch(':id/images/:imageId/primary')
  setPrimaryImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.products.setPrimaryImage(user.id, id, imageId);
  }

  @Delete(':id/images/:imageId')
  deleteImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.products.deleteImage(user.id, id, imageId);
  }

  @Patch(':id/inventory/:locationId')
  updateInventory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('locationId') locationId: string,
    @Body(new ZodValidationPipe(updateInventorySchema))
    body: UpdateInventoryInput,
  ) {
    return this.products.updateInventory(user.id, id, locationId, body);
  }
}

/**
 * Public, deliberately: a product photo is only reachable this way if
 * you already know its (random, unguessable) image ID, and product
 * listings themselves are public marketplace content once a supplier is
 * approved (Section 13) — unlike verification documents, there's no
 * reason to gate these behind login.
 */
@Controller('products/images')
export class ProductImagesController {
  constructor(private readonly products: ProductsService) {}

  @Get(':id/file')
  async downloadImage(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.products.getImageFile(id);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  }
}
