# Dağıtım

Bu belge üretim hazırlığı iddiası taşımaz. Temiz bir ortamda kurulabilir; fabrika içi kurulumun bütün operasyonel ihtiyaçları çözülmüş sayılmaz.

## Bulut

- Web ve API aynı Docker imajlarıyla yatay kopyalanabilir.
- PostgreSQL yönetilen servis, `DATABASE_URL`.
- Sırlar ortamdan gelir (`JWT_ACCESS_SECRET`, `TENANT_BOOTSTRAP_TOKEN`). `dev-only` üretimde reddedilir. `COOKIE_SECURE=true`.
- Dosyalar `STORAGE_ROOT` (veya sonraki sprintte nesne deposu). Uygulama diski yedek kaynağı değildir.
- `SENTRY_DSN` boşsa hata izleme no-op. Doluysa 5xx süreç günlüğüne düşer; yığın istemciye dönmez.
- Hız sınırı süreç belleğindedir; birden fazla kopyada ortak sayaç yoktur.

## Fabrika içi (Docker)

```bash
cp .env.example .env
# sırları değiştirin
docker compose --profile app up -d --build
```

Compose `postgres`, `api`, `web` ve `storage` volume açar. Bu:

- otomatik yedekleme
- yüksek erişilebilirlik
- dış izleme
- ağ sertleştirme
- sertifika yenileme

çözmez. Bunlar operasyonel eksiklerdir.

## Yedek ve geri yükleme

```bash
./scripts/backup-postgres.sh
./scripts/restore-postgres.sh .data/backups/bakimos-YYYYMMDD.dump
```

`pg_dump` custom format. `STORAGE_ROOT` ayrıca kopyalanır. Test: `apps/api/test/backup.e2e-spec.ts` (pg_dump yoksa atlanır).

Güncelleme: yeni imaj + migration (`pnpm db:migrate`) yedekten sonra.

## Temiz kurulum

1. Node 22, PostgreSQL 16+ veya `./scripts/dev-postgres.sh`
2. `cp .env.example .env` ve sırları değiştir
3. `pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev`
4. `pnpm lint && pnpm typecheck && pnpm test`
