import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/app-config';

export const REFRESH_COOKIE = 'bakimos_rt';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain,
    path: REFRESH_COOKIE_PATH,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  };
}

export function setRefreshCookie(response: Response, config: AppConfig, token: string): void {
  response.cookie(REFRESH_COOKIE, token, refreshCookieOptions(config));
}

export function clearRefreshCookie(response: Response, config: AppConfig): void {
  response.clearCookie(REFRESH_COOKIE, {
    ...refreshCookieOptions(config),
    maxAge: undefined,
  });
}
