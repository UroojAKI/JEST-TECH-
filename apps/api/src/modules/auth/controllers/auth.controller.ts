import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';

import { LoginDto } from '../dto/login.dto';
import { AuthService } from '../services/auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Set HttpOnly cookies
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes (match jwt expiry approx)
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Don't send tokens in body anymore
    return {
      user: result.user,
      expiresIn: result.expiresIn,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'];
    const result = await this.authService.refresh(refreshToken);

    // Set new HttpOnly cookies
    res.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return { success: true, expiresIn: result.expiresIn };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { success: true };
  }
}
