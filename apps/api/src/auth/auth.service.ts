import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus, type User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { randomToken, sha256 } from '../common/crypto';
import { AppException } from '../common/errors/app.exception';
import { normalizeEmail } from '../common/normalize';
import type { RequestMeta } from '../common/types';
import { PrismaService } from '../prisma/prisma.service';
import { INVALID_CREDENTIALS_MESSAGE } from './auth.constants';

export type IssuedSession = {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
};

@Injectable()
export class AuthService {
  private dummyHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const matches = await bcrypt.compare(password, hash);
    if (!user || !matches || user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        INVALID_CREDENTIALS_MESSAGE,
      );
    }
    return this.issueSession(user, meta);
  }

  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<IssuedSession> {
    if (!rawToken) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'REFRESH_MISSING', 'Oturum yenilenemedi.');
    }
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Oturum yenilenemedi.');
    }
    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppException(HttpStatus.UNAUTHORIZED, 'REFRESH_REUSED', 'Oturum yenilenemedi.');
    }
    if (existing.user.status !== UserStatus.ACTIVE) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'REFRESH_INVALID', 'Oturum yenilenemedi.');
    }
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(existing.user, meta);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { tenant: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Oturum doğrulanamadı.');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        tenantStatus: membership.tenant.status,
        role: membership.role,
        createdAt: membership.createdAt.toISOString(),
      })),
    };
  }

  private async issueSession(user: User, meta: RequestMeta): Promise<IssuedSession> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    const refreshToken = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.config.refreshTokenTtlSeconds * 1000),
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip?.slice(0, 64),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await bcrypt.hash('not-a-real-password', this.config.bcryptCost);
    }
    return this.dummyHash;
  }
}
