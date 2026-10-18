# BakımOS

Fabrika bakım operasyonları için çok kiracılı CMMS. Sprint 7; şirket, ekipman, QR, arıza, iş emri, offline senkron, periyodik bakım, stok, Excel/QR PDF, KPI ve Docker kurulumunu çalıştırır. Üretim hazır olduğu iddia edilmez.

## Gereksinimler

- Node.js 22
- pnpm 10.15
- PostgreSQL 16+ (Docker Compose veya yerel)

Bu makinede Docker yoksa `scripts/dev-postgres.sh` izole bir küme açar. Kurulu PostgreSQL 18 kümesinin parolasına dokunmaz.

## Kurulum

```bash
cp .env.example .env
# Docker varsa:
docker compose up -d postgres
# Docker yoksa ve PostgreSQL 18 istemci araçları duruyorsa:
./scripts/dev-postgres.sh
# İkinci yolu kullandıysanız .env içinde:
# DATABASE_URL=postgresql://bakimos@127.0.0.1:5433/bakimos

corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://127.0.0.1:3001/api/v1/health
- Swagger: http://127.0.0.1:3001/docs

Seed yalnızca geliştirme içindir ve `NODE_ENV=production` iken çalışmaz. Parola `.env` içindeki `SEED_PASSWORD` değeridir. Örnek kullanıcılar:

- `admin@demo.bakimos.local` — SUPER_ADMIN
- `manager@demo.bakimos.local` — MAINTENANCE_MANAGER
- `technician@demo.bakimos.local`
- `operator@demo.bakimos.local`
- `warehouse@demo.bakimos.local`

Şirket kısaltması `demo`, tesis `Ana Tesis`. Seed örneği `CNC-001` ekipmanını da oluşturur. Yeniden seed, demo kullanıcılarının parolasını `SEED_PASSWORD` ile günceller.

## Komutlar

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm db:seed
```

`pnpm test` API birim + PostgreSQL e2e testlerini, ardından web IndexedDB birim testlerini çalıştırır. Test veritabanı yoksa oluşturulur.

## API özeti

| Yöntem   | Yol                                   | Not                          |
| -------- | ------------------------------------- | ---------------------------- |
| POST     | `/api/v1/auth/login`                  | Refresh çerezi yazar         |
| POST     | `/api/v1/auth/refresh`                | Jetonu döndürür              |
| POST     | `/api/v1/auth/logout`                 | Oturumu iptal eder           |
| GET      | `/api/v1/me`                          | Üyelikler                    |
| POST     | `/api/v1/tenants`                     | `X-Bootstrap-Token`          |
| GET/POST | `/api/v1/sites`                       | Kiracı başlığı               |
| GET/POST | `/api/v1/memberships`                 | Yönetici                     |
| GET/POST | `/api/v1/equipment`                   | Sayfalama ve arama           |
| GET      | `/api/v1/equipment/by-qr/:qrPublicId` | Üyelik şart                  |
| PATCH    | `/api/v1/equipment/:id`               | `version` zorunlu            |
| POST     | `/api/v1/equipment/:id/archive`       | Arşiv                        |
| GET/POST | `/api/v1/faults`                      | Bildiren sunucuda belirlenir |
| GET      | `/api/v1/faults/:id`                  | İş emri özeti                |
| POST     | `/api/v1/faults/:id/acknowledge`      | Teknisyen veya yönetici      |
| POST     | `/api/v1/faults/:id/cancel`           | Aktif iş emri yokken         |
| POST     | `/api/v1/faults/:id/close`            | `RESOLVED` sonrası           |
| GET/POST | `/api/v1/work-orders`                 | Arızadan açılır              |
| GET      | `/api/v1/work-orders/assignees`       | Atanabilir üyeler            |
| POST     | `/api/v1/work-orders/:id/assign`      | Yönetici                     |
| POST     | `/api/v1/work-orders/:id/claim`       | Teknisyen üstlenir           |
| POST     | `/api/v1/work-orders/:id/transition`  | Durum makinesi               |
| POST     | `/api/v1/work-orders/:id/activities`  | NOTE veya ACTION             |
| POST     | `/api/v1/sync/push`                   | Offline FAULT_CREATE batch   |
| GET/POST | `/api/v1/maintenance/plans`           | Periyodik plan               |
| POST     | `/api/v1/maintenance/generate`        | Vadesi gelen görevler        |
| GET      | `/api/v1/maintenance/tasks`           | Yaklaşan / geciken           |
| GET/POST | `/api/v1/parts`                       | Parça kartı                  |
| POST     | `/api/v1/stock/movements`             | Giriş/çıkış (kilitli)        |
| POST     | `/api/v1/work-orders/:id/parts`       | İş emrine parça              |
| POST     | `/api/v1/attachments`                 | jpeg/png/pdf                 |
| POST     | `/api/v1/equipment/import`            | Excel aktarım                |
| POST     | `/api/v1/equipment/qr-pdf`            | Toplu QR etiket              |
| GET      | `/api/v1/reports/maintenance`         | KPI (`from`, `to`)           |

QR adresi: `{WEB_ORIGIN}/q/{qrPublicId}`

### Çevrimdışı (Sprint 3)

1. Giriş yapın → menüden **Çevrimdışı** → ekipmanları indirin.
2. Ağı kesin → ekipman listesi önbellekten gelir → arıza bildir → yerel kuyruk.
3. Üst çubukta bekleyen sayısı ve bağlantı durumu görünür.
4. Ağ dönünce otomatik veya «Şimdi senkronize et» ile `POST /api/v1/sync/push`.
5. Aynı işlem tekrar gönderilse tek arıza kalır (idempotency).

Ayrıntı: `docs/offline-sync.md`.

Ayrıntı: `docs/architecture.md`, `docs/api-guidelines.md`, `docs/offline-sync.md`, `docs/deployment.md`, `docs/implementation-plan.md`.

## Kararlar

- Modüler monolit. Redis, kuyruk ve Kubernetes yok.
- Prisma 6.19. Prisma 7 istemci kurulumunu değiştirir, Prisma 8 RC'dir.
- NestJS 11. Sürüm 12 yalnızca ESM yayınlar; Node 22 üzerindeki CommonJS derlemesi onu yükleyemez. TypeScript 5.9 kullanılır.
- Kiracı provizyonu bootstrap jetonuyla sınırlıdır.
# bakim-os
