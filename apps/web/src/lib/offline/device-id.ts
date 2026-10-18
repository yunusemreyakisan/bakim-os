import { getMeta, setMeta } from './offline-db';

const DEVICE_KEY = 'deviceId';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getMeta(DEVICE_KEY);
  if (existing) return existing;
  const created = randomId();
  await setMeta(DEVICE_KEY, created);
  return created;
}
