import { config as loadEnv } from 'dotenv';
import path from 'path';
import { MembershipRole, PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createQrPublicId } from '../src/equipment/qr-public-id';

loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed üretim ortamında çalıştırılamaz.');
  }
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('SEED_PASSWORD en az 10 karakter, bir harf ve bir rakam içermelidir.');
  }
  const cost = Number(process.env.BCRYPT_COST ?? '12');
  const passwordHash = await bcrypt.hash(password, cost);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: { name: 'Demo Fabrika', status: 'ACTIVE' },
    create: { name: 'Demo Fabrika', slug: 'demo', status: 'ACTIVE' },
  });
  const site = await prisma.site.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Ana Tesis' } },
    update: { timezone: 'Europe/Istanbul' },
    create: { tenantId: tenant.id, name: 'Ana Tesis', timezone: 'Europe/Istanbul' },
  });

  const people: Array<{ email: string; name: string; role: MembershipRole }> = [
    { email: 'admin@demo.bakimos.local', name: 'Demo Yönetici', role: MembershipRole.SUPER_ADMIN },
    {
      email: 'manager@demo.bakimos.local',
      name: 'Demo Bakım Yöneticisi',
      role: MembershipRole.MAINTENANCE_MANAGER,
    },
    {
      email: 'technician@demo.bakimos.local',
      name: 'Demo Teknisyen',
      role: MembershipRole.TECHNICIAN,
    },
    { email: 'operator@demo.bakimos.local', name: 'Demo Operatör', role: MembershipRole.OPERATOR },
    { email: 'warehouse@demo.bakimos.local', name: 'Demo Depo', role: MembershipRole.WAREHOUSE },
  ];

  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, status: 'ACTIVE', passwordHash },
      create: { email: person.email, name: person.name, passwordHash, status: 'ACTIVE' },
    });
    await prisma.membership.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      update: { role: person.role },
      create: { tenantId: tenant.id, userId: user.id, role: person.role },
    });
  }

  const equipment = await prisma.equipment.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CNC-001' } },
  });
  if (!equipment) {
    await prisma.equipment.create({
      data: {
        tenantId: tenant.id,
        siteId: site.id,
        code: 'CNC-001',
        name: 'CNC Torna 1',
        description: 'Örnek ekipman',
        qrPublicId: createQrPublicId(),
        status: 'ACTIVE',
      },
    });
  }

  const existingPart = await prisma.part.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: 'BRG-6205' } },
  });
  if (!existingPart) {
    await prisma.part.create({
      data: {
        tenantId: tenant.id,
        code: 'BRG-6205',
        name: 'Rulman 6205',
        minQuantity: 2,
        balance: { create: { tenantId: tenant.id, quantity: 4 } },
      },
    });
  }

  console.log('Seed tamamlandı. Şirket: demo. Kullanıcılar @demo.bakimos.local');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
