import {
  Body,
  Controller,
  Post,
  Res,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';

import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    // Tokens are deliberately not returned to browser JavaScript. HttpOnly
    // cookies are the sole client transport for authentication credentials.
    return {
      user: result.user,
      expiresIn: result.expiresIn,
      workspaces: result.workspaces,
      landingWorkspace: result.landingWorkspace,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    const result = await this.authService.refresh(refreshToken);

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return {
      success: true,
      expiresIn: result.expiresIn,
      user: result.user,
      workspaces: result.workspaces,
      landingWorkspace: result.landingWorkspace,
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = (req as any).user;
    if (user?.userId || user?.id) {
      await this.authService.logout(user.userId || user.id);
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
