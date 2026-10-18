import { execFileSync } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const PG_BIN = process.env.PG_BIN ?? '/Library/PostgreSQL/18/bin';
const TEST_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://bakimos@127.0.0.1:5433/bakimos_test';

describe('Postgres yedek ve geri yükleme', () => {
  it('dump, truncate ve restore sonrası satır sayısı eşit kalır', async () => {
    const dumpBin = join(PG_BIN, 'pg_dump');
    const restoreBin = join(PG_BIN, 'pg_restore');
    try {
      execFileSync(dumpBin, ['--version']);
    } catch {
      console.warn('pg_dump yok; yedek testi atlandı.');
      return;
    }

    const prisma = new PrismaClient({ datasources: { db: { url: TEST_URL } } });
    const dir = await mkdtemp(join(tmpdir(), 'bakimos-backup-'));
    const dump = join(dir, 'test.dump');
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO tenants (id, name, slug, status, "createdAt", "updatedAt")
         VALUES ('00000000-0000-4000-8000-000000000099', 'Yedek', 'backup-probe', 'ACTIVE', NOW(), NOW())
         ON CONFLICT (slug) DO NOTHING`,
      );
      const before = await prisma.tenant.count();
      execFileSync(dumpBin, ['--format=custom', '--no-owner', `--dbname=${TEST_URL}`, `--file=${dump}`]);
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "tenants" RESTART IDENTITY CASCADE');
      expect(await prisma.tenant.count()).toBe(0);
      execFileSync(restoreBin, ['--clean', '--if-exists', '--no-owner', `--dbname=${TEST_URL}`, dump]);
      expect(await prisma.tenant.count()).toBe(before);
    } finally {
      await prisma.$disconnect();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
