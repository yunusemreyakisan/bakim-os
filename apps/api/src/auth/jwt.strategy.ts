import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import type { AuthUser } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';

type AccessPayload = {
  sub?: string;
  email?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  async validate(payload: AccessPayload): Promise<AuthUser> {
    if (!payload.sub) {
      throw new Error('Geçersiz erişim jetonu.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new Error('Oturum doğrulanamadı.');
    }
    return { id: user.id, email: user.email };
  }
}
