import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from '../common/cookies';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthUser, RequestMeta } from '../common/types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

const loginLimit = Number(process.env.LOGIN_THROTTLE_LIMIT ?? '5');
const loginTtl = Number(process.env.THROTTLE_TTL_MS ?? '60000');

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('auth/login')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: loginLimit, ttl: loginTtl } })
  @ApiOkResponse({
    description: 'Access token döner. Refresh token HttpOnly cookie olarak yazılır.',
  })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.login(body.email, body.password, metaOf(request));
    setRefreshCookie(response, this.config, session.refreshToken);
    return { data: { accessToken: session.accessToken, user: session.user } };
  }

  @Post('auth/refresh')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({ description: 'Refresh token döndürülür ve yeni access token üretilir.' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const raw = readCookie(request);
    try {
      const session = await this.auth.refresh(raw, metaOf(request));
      setRefreshCookie(response, this.config, session.refreshToken);
      return { data: { accessToken: session.accessToken, user: session.user } };
    } catch (error) {
      clearRefreshCookie(response, this.config);
      throw error;
    }
  }

  @Post('auth/logout')
  @Public()
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(request));
    clearRefreshCookie(response, this.config);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  async me(@CurrentUser() user: AuthUser) {
    return { data: await this.auth.me(user.id) };
  }
}

function readCookie(request: Request): string | undefined {
  const value = request.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

function metaOf(request: Request): RequestMeta {
  return {
    userAgent: request.header('user-agent') ?? undefined,
    ip: request.ip,
  };
}
