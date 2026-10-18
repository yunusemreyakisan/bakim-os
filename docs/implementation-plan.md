# BakımOS Sprint 1 uygulama planı

Bu belge, Sprint 1 sırasında alınan teknik kararları ve uygulama sırasını kaydeder. Ürün henüz üretim hazır değildir.

## Mevcut durum

- Çalışma alanında önceden bir BakımOS kod tabanı yoktu. Proje yeni bir monorepo olarak kuruldu.
- Node.js 22 yerel olarak mevcut. pnpm, kullanıcı dizinine global kurulamadığı için depo içindeki araçla (`pnpm@10.15.1`) kullanılıyor.
- Docker CLI bu makinede yok. PostgreSQL 18 kurulumu `localhost:5432` üzerinde çalışıyor ve mevcut kümenin kimlik bilgilerine dokunulmuyor.
- Yerel doğrulama için izole bir geliştirme kümesi `scripts/dev-postgres.sh` ile port `5433` üzerinde ayağa kaldırılır. `docker-compose.yml` Docker bulunan ortamlarda aynı rolü görür.

## Kararlar

1. **Modüler monolit.** `apps/api` tek NestJS sürecidir. Mikroservis, Redis, kuyruk ve Kubernetes eklenmez.
2. **Prisma 6.19.** Prisma 7 istemci yapılandırmasını ve sürücü adaptörünü değiştirir; Prisma 8 henüz RC. Sprint 1 kararlı Prisma 6 API'sinde kalır.
3. **NestJS 11 ve TypeScript 5.9.** NestJS 12 paketleri ESM-only'dir. Node 22, CommonJS derlemesinden bu paketleri `require` edemez. Sprint 1, CommonJS ile çalışan NestJS 11.2 üzerinde kalır. Swagger 11, TypeScript 7'yi istemez.
4. **Sözleşme paketi.** `@bakimos/api-contracts` API'nin dış tiplerini taşır. Frontend Prisma şemasını import etmez.
5. **Kiracı provizyonu.** `POST /api/v1/tenants` herkese açık değildir. `X-Bootstrap-Token` ile operatör kurulumu yapılır. Geliştirme verisi yalnızca seed ile gelir ve `NODE_ENV=production` iken seed çalışmaz.
6. **Aktif kiracı.** İstemci `X-Tenant-Id` gönderir. Backend, kullanıcının o kiracıdaki üyeliğini ve kullanıcının `ACTIVE` olduğunu doğrulamadan veri döndürmez. Gövdedeki `tenantId` kabul edilmez (`forbidNonWhitelisted`).
7. **Yetki.** Rol listeleri `Permission` sabitinde toplanır. Controller'lar bu sabitleri kullanır; dağınık rol koşulları yazılmaz.
8. **Oturum.** Access token kısa ömürlü JWT'dir ve yanıt gövdesindedir. Refresh token yalnızca `HttpOnly` cookie'dedir, veritabanında SHA-256 özeti tutulur, rotasyon ve yeniden kullanım tespiti vardır.
9. **QR.** `qrPublicId` sunucuda `crypto.randomBytes` ile üretilir. URL `{WEB_ORIGIN}/q/{qrPublicId}` biçimindedir. Kod veya ad değişince QR kimliği değişmez. QR ile okuma kimlik doğrulaması ve üyelik kontrolü ister; üye olmayanlara 404 döner.
10. **Parola.** bcrypt. Maliyet üretimde 12, testte 4. Giriş hataları tek mesaj döner. Bilinmeyen kullanıcıda da bcrypt çalıştırılır.
11. **Silme.** Ekipman arşivlenir. Arıza ve denetim kayıtları hard-delete edilmez.
12. **Dosya saklama.** Sprint 1'de dosya özelliği yoktur. `ObjectStorage` portu ve yerel sürücü enjekte edilen kök dizinle test edilir; uygulama diski kalıcı depo kabul edilmez.
13. **Hız sınırı.** `@nestjs/throttler` süreç belleğindedir. Birden fazla API kopyasında ortak sayaç yoktur; yatay ölçek takip işidir.
14. **Offline.** Service worker yalnızca kabuk içindir. API yanıtları önbelleğe alınmaz. Ayrıntı `docs/offline-sync.md` içindedir.

## Uygulama sırası

1. Monorepo, lint, TypeScript, ortam örneği, Docker ve belgeler.
2. Prisma şeması, migration, seed, health.
3. Auth, kiracı, üyelik, rol politikası.
4. Ekipman, QR, arıza, denetim kaydı.
5. Next.js dikey akış (gerçek API).
6. Birim ve PostgreSQL entegrasyon testleri, CI, lint ve type-check.

## Sprint 1 dışında bırakılanlar

İş emri, periyodik bakım, stok, ekler, senkronizasyon motoru, raporlar, abonelik, SAP/ERP, toplu QR PDF, IndexedDB kuyruğu. Sınırları `docs/architecture.md` tanımlar.

## Sprint 2

Sprint 1 çalışır: auth, kiracı, ekipman, QR, arıza oluşturma/listeleme. Arıza durumu değişmez. İş emri tablosu yoktur. Arayüzde arıza listesi ve atama akışı yoktur.

### Eksikler

- `Fault.status` yazılabilir değil; yalnızca `OPEN` doğar.
- İş emri, atama, bakım işlemi ve iş emri denetim kaydı yok.
- `MAINTENANCE_MANAGER` üyelik listesini göremez; atama için ayrı bir atanabilir kullanıcı ucu gerekir.
- Depo rolü arıza ve iş emrine yazamaz; bu korunur.

### Kararlar

1. **İş emri arızadan açılır.** `POST /api/v1/work-orders` `faultId` ister. Ekipman sunucuda arızadan kopyalanır. Gövdedeki `tenantId`, `assigneeId` (oluşturmada) ve `reporterId` kabul edilmez.
2. **Durum makineleri saf fonksiyonlardır.** `fault-status.ts` ve `work-order-status.ts` geçiş matrisini tutar. Controller'da `if (status === ...)` dağılmaz.
3. **İş emri durumları:** `OPEN → IN_PROGRESS | CANCELLED`, `IN_PROGRESS → ON_HOLD | COMPLETED | CANCELLED`, `ON_HOLD → IN_PROGRESS | CANCELLED`. `COMPLETED` ve `CANCELLED` uçtur. `OPEN → IN_PROGRESS` atama ister. `COMPLETED` en az bir `ACTION` bakım kaydı ister. İptal yalnızca yönetici rollerindedir.
4. **Arıza durumları:** `OPEN → ACKNOWLEDGED | CANCELLED`. İş emri açılınca `OPEN` arıza `ACKNOWLEDGED` olur. İş emri ilerleyince arıza `IN_PROGRESS` olur. Son aktif iş emri tamamlanınca `RESOLVED` olur. `RESOLVED → CLOSED` yöneticidedir. Aktif iş emri varken arıza iptal edilemez. Kapanmış veya iptal arızadan iş emri açılamaz. `RESOLVED` arızada yeni iş emri arızayı yeniden `IN_PROGRESS` yoluna sokar.
5. **Atama.** Yönetici (`SUPER_ADMIN`, `ADMIN`, `MAINTENANCE_MANAGER`) atar. Teknisyen yalnızca boş `OPEN` iş emrini `claim` eder. Atanan kişi aynı kiracıda `ACTIVE` ve atanabilir rolde olmalıdır: teknisyen veya yönetici. Operatör ve depo atanamaz. Yabancı kiracı üyesi 404/400 ile reddedilir.
6. **Bakım işlemi.** `NOTE` veya `ACTION`. `ACTION` yalnızca `IN_PROGRESS` veya `ON_HOLD` iken yazılır. Aktör sunucudadır. İş emri kapalıysa yazılamaz.
7. **Sürüm.** Atama ve durum geçişi `version` ister; çakışma `409 VERSION_CONFLICT`.
8. **Numara.** Kiracı başına `tenant_sequences` ile `WO-00001`. Transaction içinde artar.
9. **Yetki.** `FAULT_ACKNOWLEDGE` teknisyen+yönetici. `FAULT_MANAGE` (iptal/kapat) yönetici. `WORK_ORDER_READ` arıza okuyan roller. `WORK_ORDER_WRITE` ve `WORK_ORDER_ASSIGN` yönetici. `WORK_ORDER_EXECUTE` teknisyen+yönetici. Depo iş emri okumaz.
10. **Denetim.** `fault.acknowledged|cancelled|closed|status_changed`, `work_order.created|assigned|claimed|transitioned|activity_added`. Sır yok.
11. **Sprint 2 dışı.** Offline senkron, SAP, stok, periyodik plan, ek, PDF.

### Uçlar

- `GET /api/v1/faults/:id`
- `POST /api/v1/faults/:id/acknowledge|cancel|close`
- `POST /api/v1/work-orders`
- `GET /api/v1/work-orders` (`status`, `faultId`, `assigneeId`, `mine`)
- `GET /api/v1/work-orders/assignees`
- `GET /api/v1/work-orders/:id`
- `POST /api/v1/work-orders/:id/assign|claim|transition|activities`

### Arayüz

`/faults`, `/faults/:id`, `/work-orders`, `/work-orders/:id`. Gerçek API. Kabukta gezinme bağları.

## Sprint 3

Sprint 1–2 doğrulandı (`pnpm typecheck`, `pnpm lint`, `pnpm test` geçti). Bloklayan kusur yok. Sprint 3 çevrimdışı dikey akışı uygular: ekipman önbelleği → offline arıza → push senkron.

### Kararlar

1. **Service Worker.** Next 16 ile özel `public/sw.js` kullanılır; Serwist/Workbox eklenmez (gereksiz bağımlılık riski). Kabuk + seçili sayfalar cache-first; `/api/` asla cache edilmez.
2. **IndexedDB.** `idb` 8.x. Katmanlar: `offline-db`, `equipment-cache`, `pending-operations`, `sync-engine`. Token IndexedDB/`localStorage` içine yazılmaz.
3. **İzin verilen offline işlem.** Yalnızca `FAULT_CREATE`. Stok, iş emri, fotoğraf sonraki sprint.
4. **Push API.** `POST /api/v1/sync/push`. Oturum + `X-Tenant-Id`. Gövdedeki `tenantId`/`userId`/`reporterId` yok sayılır / whitelist dışı reddedilir. Reporter sunucudan gelir.
5. **Idempotency.** `sync_operations` tablosu, `@@unique([tenantId, operationId])`. Aynı payload özeti → önceki sonuç. Farklı payload → `PAYLOAD_CONFLICT`. Her işlem kendi sonucunu döner; batch içinde biri hata verse diğeri işlenebilir (işlem başına transaction).
6. **Retry.** İstemci: geçici hatalarda üstel bekleme (en fazla 5 deneme). `UNAUTHORIZED` / validation / conflict sonsuz tekrarlanmaz. Oturum bitince kuyruk korunur; yeniden giriş sonrası sync devam eder.
7. **Tenant/kullanıcı.** UI yalnızca aktif `userId`+`tenantId` kayıtlarını gösterir. Çıkışta bekleyen işlem sessizce silinmez; uyarı gösterilir. Hassas ekipman önbelleği çıkışta temizlenebilir; bekleyen işlemler kullanıcıya aittir ve yeniden girişte aynı hesapla senkronize edilebilir.
8. **Playwright.** Mümkünse kurulum eklenir; CI'da tarayıcı yoksa veya koşu başarısızsa rapor edilir. Frontend birim testleri `fake-indexeddb` ile Jest'te çalışır.

### Uçlar

- `POST /api/v1/sync/push`
- `GET /api/v1/sync/status` (isteğe bağlı: sunucu saati / sağlık; Sprint 3'te istemci durumu yerel)

### Arayüz

Bağlantı durumu, bekleyen işlem sayısı, manuel senkron, `/offline` indirme ekranı, offline arıza formu.

## Sprint 4–7

Sprint 3 regresyonu yeşil. Periyodik bakım, stok/dosya, Excel/QR/KPI ve dağıtım hazırlığı aynı monolit üzerine eklendi.

### Kararlar

1. **Bakım üretimi.** `POST /api/v1/maintenance/generate`. Açık görev yoksa bir görev + checklist kopyası. `nextDueAt` yakalanır. Redis yok; tek API kopyası varsayılır.
2. **Stok.** `SELECT … FOR UPDATE` + transaction. Negatif bakiye `INSUFFICIENT_STOCK`. `operationId` tenant içinde tektir.
3. **Dosya.** `LocalObjectStorage` + `STORAGE_ROOT`. 5 MB, jpeg/png/pdf. Offline stok yok.
4. **Excel.** Satır bazlı rapor; kod çakışması atlanır, site yok hata olur.
5. **Rapor.** `from`/`to` zorunlu, en fazla 366 gün.
6. **Yedek.** `scripts/backup-postgres.sh` / `restore-postgres.sh`. STORAGE_ROOT ayrı kopyalanır.
7. **On-prem.** Docker imajları hazır; izleme, HA ve yedek otomasyonu çözülmüş sayılmaz.

## Doğrulama

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (birim + gerçek PostgreSQL entegrasyon)
- Migration ve seed
- API ve web süreçlerinin yerel çalışması
- Docker kurulu olmayan bu makinede `docker compose` çalıştırılamaz; Compose dosyası ve Docker imajları repoda durur, veritabanı adımı izole PostgreSQL ile doğrulanır.
