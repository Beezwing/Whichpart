import { Body, Controller, Post, Res, UsePipes } from '@nestjs/common';
import type { Response } from 'express';
import {
  loginSchema,
  registerCustomerSchema,
  supplierSignupSchema,
  type LoginInput,
  type RegisterCustomerInput,
  type SupplierSignupInput,
} from '@autoparts/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

const isProd = process.env.NODE_ENV === 'production';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/customer')
  @UsePipes(new ZodValidationPipe(registerCustomerSchema))
  async registerCustomer(
    @Body() body: RegisterCustomerInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerCustomer(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('register/supplier')
  @UsePipes(new ZodValidationPipe(supplierSignupSchema))
  async registerSupplier(
    @Body() body: SupplierSignupInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { password, ...businessFields } = body;
    const result = await this.authService.registerSupplier(
      businessFields,
      body.email,
      password,
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const common = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };
    res.cookie('access_token', accessToken, {
      ...common,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      ...common,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
