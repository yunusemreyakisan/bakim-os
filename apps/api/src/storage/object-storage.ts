import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { ObjectStorage } from './storage.port';

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly rootDir: string) {}

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private resolve(key: string): string {
    if (!/^[a-zA-Z0-9._/-]{1,200}$/.test(key) || key.includes('..') || key.startsWith('/')) {
      throw new Error('Geçersiz depolama anahtarı.');
    }
    const root = path.resolve(this.rootDir);
    const target = path.resolve(root, key);
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error('Geçersiz depolama anahtarı.');
    }
    return target;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
