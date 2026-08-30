import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  choosePlanSchema,
  documentTypes,
  paymentAccountSchema,
  supplierLocationSchema,
  updateSupplierProfileSchema,
  type ChoosePlanInput,
  type PaymentAccountInput,
  type SupplierLocationInput,
  type UpdateSupplierProfileInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SuppliersService } from './suppliers.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get('me')
  @Auth()
  getMySupplier(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.getMySupplier(user.id);
  }

  @Patch('me')
  @Auth()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateSupplierProfileSchema))
    body: UpdateSupplierProfileInput,
  ) {
    return this.suppliersService.updateProfile(user.id, body);
  }

  @Post('me/documents')
  @Auth()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  addDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Only PDF, JPEG, or PNG files are accepted.',
      );
    }
    const resolvedType =
      documentType &&
      (documentTypes as readonly string[]).includes(documentType)
        ? documentType
        : documentTypes[2];
    res.status(201);
    return this.suppliersService.addDocument(user.id, resolvedType, {
      buffer: file.buffer,
      originalname: file.originalname,
    });
  }

  @Delete('me/documents/:id')
  @Auth()
  deleteDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.suppliersService.deleteDocument(user.id, id);
  }

  @Post('me/submit')
  @Auth()
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.submitApplication(user.id);
  }

  @Get('documents/:id/file')
  @Auth()
  async downloadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer } = await this.suppliersService.getDocumentFile(id, user);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buffer);
  }

  // ---------- Locations ----------

  @Get('me/locations')
  @Auth()
  listLocations(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.listLocations(user.id);
  }

  @Post('me/locations')
  @Auth()
  createLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(supplierLocationSchema))
    body: SupplierLocationInput,
  ) {
    return this.suppliersService.createLocation(user.id, body);
  }

  @Patch('me/locations/:id')
  @Auth()
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(supplierLocationSchema))
    body: SupplierLocationInput,
  ) {
    return this.suppliersService.updateLocation(user.id, id, body);
  }

  @Delete('me/locations/:id')
  @Auth()
  deleteLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.suppliersService.deleteLocation(user.id, id);
  }

  // ---------- Subscription ----------

  @Get('me/subscription')
  @Auth()
  getSubscription(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.getSubscription(user.id);
  }

  @Post('me/subscription/plan')
  @Auth()
  choosePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(choosePlanSchema)) body: ChoosePlanInput,
  ) {
    return this.suppliersService.choosePlan(user.id, body);
  }

  // ---------- Payment connection ----------

  @Get('me/payment-account')
  @Auth()
  getPaymentAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.getPaymentAccount(user.id);
  }

  @Put('me/payment-account')
  @Auth()
  updatePaymentAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(paymentAccountSchema))
    body: PaymentAccountInput,
  ) {
    return this.suppliersService.updatePaymentAccount(user.id, body);
  }
}
