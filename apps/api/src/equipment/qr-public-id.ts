import { randomBytes } from 'crypto';

const QR_PUBLIC_ID = /^[A-Za-z0-9_-]{22}$/;

export function createQrPublicId(): string {
  return randomBytes(16).toString('base64url');
}

export function isQrPublicId(value: string): boolean {
  return QR_PUBLIC_ID.test(value);
}
