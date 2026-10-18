import type { ApiErrorBody } from '@bakimos/api-contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  tenantId?: string | null,
  retry = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (tenantId) headers.set('X-Tenant-Id', tenantId);
  const response = await fetch(path, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && !path.startsWith('/api/v1/auth/login')) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, init, tenantId, false);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | (T & { message?: string | string[]; code?: string })
    | null;
  if (!response.ok || !body) {
    const message = Array.isArray(body?.message)
      ? body.message.join(' ')
      : (body?.message ?? 'İstek başarısız.');
    throw new ApiError(response.status, body?.code ?? 'ERROR', message);
  }
  return body;
}

export async function refreshSession(): Promise<boolean> {
  const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    accessToken = null;
    return false;
  }
  const body = (await response.json()) as { data: { accessToken: string } };
  accessToken = body.data.accessToken;
  return true;
}

export async function uploadForm<T>(path: string, form: FormData, tenantId?: string | null): Promise<T> {
  const headers = new Headers();
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (tenantId) headers.set('X-Tenant-Id', tenantId);
  const response = await fetch(path, { method: 'POST', body: form, headers, credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) return uploadForm<T>(path, form, tenantId);
  }
  const body = (await response.json().catch(() => null)) as T & { message?: string; code?: string };
  if (!response.ok || !body) {
    throw new ApiError(response.status, body?.code ?? 'ERROR', String(body?.message ?? 'Yükleme başarısız.'));
  }
  return body;
}

export function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as ApiErrorBody).message;
    return Array.isArray(message) ? message.join(' ') : String(message);
  }
  return 'Beklenmeyen bir hata oluştu.';
}
