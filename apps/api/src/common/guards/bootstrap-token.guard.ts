import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { safeEqual } from '../crypto';
import { AppException } from '../errors/app.exception';

@Injectable()
export class BootstrapTokenGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const header = request.headers['x-bootstrap-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || !safeEqual(token, this.config.bootstrapToken)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'BOOTSTRAP_UNAUTHORIZED',
        'Kurulum yetkisi doğrulanamadı.',
      );
    }
    return true;
  }
}
