import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import { ProductsService } from '../products/products.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('admin')
@Auth(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPhotoRequestsController {
  constructor(private readonly products: ProductsService) {}

  @Get('photo-requests')
  list(@Query('status') status?: string) {
    return this.products.listPhotoRequests(status);
  }

  // Deliberately under /admin/products, not /suppliers/me/products -- this
  // is an admin uploading on a supplier's behalf after physically visiting
  // and photographing the part (Section: photo requests), not the supplier
  // managing their own listing. Uploading here auto-fulfills every PENDING
  // request on this product.
  @Post('products/:id/images')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  addImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, or WEBP images are accepted.',
      );
    }
    return this.products.addImageAsAdmin(id, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }
}
