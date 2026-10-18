# BakımOS mimarisi

Sprint 1 çalışan bir modüler monolittir. Bu belge üretim hazırlığı iddiası taşımaz.

## Bağlam

BakımOS, fabrikaların ekipman, arıza ve ileride bakım planı, iş emri ve stok süreçlerini tek kiracılı SaaS olarak değil, çok kiracılı olarak yönetir. İlk dağıtım hedefi buluttur. Fabrika içi kurulum sonraki aşamada aynı Docker imajlarıyla düşünülür.

## Çalışma zamanı

```text
apps/web (Next.js) -- /api/v1 proxy --> apps/api (NestJS) --> PostgreSQL
packages/api-contracts  <--- web ve api
```

- API sürümü yol ile belirlenir: `/api/v1`.
- Web, tarayıcıdan göreli `/api/v1` çağırır. Next rewrite, `API_INTERNAL_URL` hedefine iletir. Refresh cookie aynı kökene yazılır.
- Prisma modelleri yalnızca API sürecindedir.

## Modüller

Sprint 7'ye kadar kodlanmış modüller: Auth, Tenants, Memberships, Sites, Equipment, Faults, Work Orders, Sync, Maintenance, Inventory, Attachments, Reports, Audit, Health.

Henüz kodlanmayan sınırlar:

| Modül             | Sorumluluk                        | Durum                    |
| ----------------- | --------------------------------- | ------------------------ |
| Work Orders       | Arızadan iş emri, atama, durum    | Sprint 2                 |
| Sync              | Offline FAULT_CREATE push         | Sprint 3                 |
| Maintenance Plans | Periyodik plan, görev, checklist  | Sprint 4                 |
| Inventory         | Parça, kilitli stok hareketi      | Sprint 5 (offline yok)   |
| Attachments       | Arıza/bakım/iş emri dosyası       | Sprint 5                 |
| Reports           | KPI ve Excel/QR                   | Sprint 6                 |
| Subscriptions     | Plan ve kota                      | Yok                      |
| Integrations      | SAP/ERP bağlayıcı                 | Yok                      |

Yeni bir entegrasyon, çekirdek tablolara SAP alanları eklemek yerine Integrations modülünden API sözleşmesine bağlanmalıdır.

## Çok kiracılı güvenlik

- Kiracı seçimi `X-Tenant-Id` başlığıdır.
- `TenantGuard` başlığı, kullanıcının üyeliğini, kullanıcının `ACTIVE` durumunu ve kiracının `ACTIVE` durumunu doğrular.
- İstek gövdesinde `tenantId` veya `reporterId` yoktur; validation `forbidNonWhitelisted` ile reddeder.
- Ekipman kodu `(tenantId, code)` ile benzersizdir.
- QR araması global `qrPublicId` ile yapılır, ardından üyelik yoksa 404 döner. Varlık sızdırılmaz.
- Rol kümesi `Permission` sabitindedir.

Roller: `SUPER_ADMIN`, `ADMIN`, `MAINTENANCE_MANAGER`, `TECHNICIAN`, `OPERATOR`, `WAREHOUSE`.

## Kimlik

- Parola bcrypt ile saklanır. Maliyet ortamdan gelir, testte 4, diğer ortamlarda 12.
- Access token JWT, varsayılan 15 dakika. Gövde içinde döner.
- Refresh token 32 bayt rastgele değerdir. Çerez: `HttpOnly`, `Secure` (ortama göre), `SameSite`, yol `/api/v1/auth`.
- Veritabanında yalnızca SHA-256 özeti durur. Yenileme eski jetonu iptal eder. İptal edilmiş jeton yeniden gelirse kullanıcının açık oturumları kapatılır.
- Giriş hata mesajı tektir. Bilinmeyen kullanıcıda da bcrypt çalışır.
- Üretimde `dev-only` sırlar ve `COOKIE_SECURE=false` süreç açılışında reddedilir.
- Jeton ve parola loglanmaz. Denetim kaydına yazılmaz.

Şirket oluşturma `X-Bootstrap-Token` ister. Açık kayıt yoktur.

## QR

`qrPublicId`, ekipman oluşturulurken sunucuda üretilir. URL:

```text
{WEB_ORIGIN}/q/{qrPublicId}
```

Kod, ad veya sürüm değişince bu kimlik değişmez. Toplu PDF baskı bu sprintte yoktur.

## Veri

Tablolar: `tenants`, `sites`, `users`, `memberships`, `equipment`, `faults`, `work_orders`, `work_order_activities`, `tenant_sequences`, `sync_operations`, `maintenance_plans`, `maintenance_tasks`, `parts`, `stock_balances`, `stock_movements`, `attachments`, `audit_logs`, `refresh_tokens`.

`sync_operations` `(tenantId, operationId)` ile benzersizdir. Offline arıza oluşturma bu tablo üzerinden idempotenttir. Ayrıntı: `docs/offline-sync.md`.

İş emri `(tenantId, number)` ile benzersizdir. Numara `WO-00001` biçimindedir. `work_orders.version` atama ve durum geçişinde artar. İş emri ve bakım işlemleri hard-delete edilmez.

Ekipman arşivlenir. Arıza ve denetim kaydı silinmez. `equipment.version` güncellemede artar; eski sürümle gelen yama `409 VERSION_CONFLICT` döner.

Tarihler veritabanında UTC `timestamptz` (Prisma `DateTime`) olarak durur. Arayüz, tesisin IANA saat dilimiyle gösterir.

### Sonraki modeller (uygulanmadı)

- **Work order:** Sprint 2'de uygulandı. Durum makinesi `OPEN → IN_PROGRESS | CANCELLED`, `IN_PROGRESS → ON_HOLD | COMPLETED | CANCELLED`, `ON_HOLD → IN_PROGRESS | CANCELLED`. Tamamlama `ACTION` kaydı ister. İptal yöneticidedir.
- **Maintenance plan:** tenant, equipment, cadence, checklist şablonu, sonraki çalışma zamanı.
- **Stock movement:** tenant, part, quantity delta, source (iş emri veya sayım), `operationId` ile idempotency. Offline tüketim bakiyeyi düşürmez; sunucu onayına kadar bekleyen işlemdir.
- **Attachment:** tenant, entity, storage key, content type, size. Baytlar uygulama diskinde kalıcı kabul edilmez.
- **Sync cursor:** tenant + device için son çekme imi.

## PWA ve çevrimdışı (Sprint 3)

- Service Worker yalnızca kabuk/statik cache; `/api/` cache edilmez.
- IndexedDB: ekipman önbelleği + `FAULT_CREATE` kuyruğu (`idb`).
- Sync API: `POST /api/v1/sync/push` + `sync_operations` idempotency.
- Tokenlar IndexedDB/`localStorage` içinde tutulmaz.
- Ayrıntı: `docs/offline-sync.md`.

## Dosya saklama

`ObjectStorage` portu `put/get` tanımlar. `LocalObjectStorage` kök dizini enjeksiyonla alır ve `..` anahtarlarını reddeder. Sprint 1 özelliği bu porta bağlı değildir. Sonraki sürücü Azure Blob veya tesis içi nesne deposu olabilir.

## Dağıtım

API oturum durumunu bellekte tutmaz; refresh kayıtları PostgreSQL'dedir. Hız sınırı süreç belleğindedir, birden fazla kopyada ortak değildir.

Bulut:

- API ve web yatay kopyalanabilir.
- PostgreSQL yönetilen servis, bağlantı `DATABASE_URL`.
- Sırlar ortam veya gizli yöneticisinden gelir, repoya girmez.
- Dosya varsa nesne deposu.

Fabrika içi (ileride, bu sprintte kurulmaz):

- Aynı imajlar Docker ile çalışabilir.
- Güncelleme imaj etiketiyle yapılmalı, şema migration'ı yedekten sonra uygulanmalıdır.
- Yedek PostgreSQL dump ve nesne deposunu kapsamalıdır. Uygulama diski yedek kaynağı değildir.
- Lisans ve uzaktan destek ayrı bir kontrol düzlemi gerektirir; Sprint 1'de yoktur.
- Tesis ağına gelen destek erişimi varsayılan olarak kapalı tasarlanmalıdır.

## SAP

İlk sürüm SAP'nin yerine geçmez. ERP çağrıları Integrations modülünün işi olacaktır. Ekipman ve stok kimlikleri dış anahtar taşıyabilecek şekilde kendi tablolarında kalır; yabancı anahtarlar çekirdek tablolara gömülmez.
