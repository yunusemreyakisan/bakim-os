import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalObjectStorage } from './object-storage';

describe('LocalObjectStorage', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bakimos-storage-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('enjekte edilen kök dizine yazar ve okur', async () => {
    const storage = new LocalObjectStorage(dir);
    await storage.put('tenant/file.txt', Buffer.from('bakim'));
    await expect(storage.get('tenant/file.txt')).resolves.toEqual(Buffer.from('bakim'));
  });

  it('kök dışına çıkan anahtarı reddeder', async () => {
    const storage = new LocalObjectStorage(dir);
    await expect(storage.put('../secret.txt', Buffer.from('no'))).rejects.toThrow(
      'Geçersiz depolama anahtarı.',
    );
  });
});
