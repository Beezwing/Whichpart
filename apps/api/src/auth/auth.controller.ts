import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  changePasswordSchema,
  loginSchema,
  registerCustomerSchema,
  supplierSignupSchema,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterCustomerInput,
  type SupplierSignupInput,
} from '@autoparts/shared';
import { Auth } from '../common/auth.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService } from './auth.service';

const isProd = process.env.NODE_ENV === 'production';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/customer')
  async registerCustomer(
    @Body(new ZodValidationPipe(registerCustomerSchema))
    body: RegisterCustomerInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerCustomer(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('register/supplier')
  async registerSupplier(
    @Body(new ZodValidationPipe(supplierSignupSchema))
    body: SupplierSignupInput,
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
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refresh(
      req.cookies?.refresh_token as string | undefined,
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Post('password')
  @Auth()
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
  ) {
    await this.authService.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
    return { success: true };
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
