# Çevrimdışı çalışma ve senkronizasyon

Sprint 3, fabrika ortamında sınırlı bir dikey akışı destekler: bağlıyken ekipman indirme → çevrimdışı arıza oluşturma → bağlantı gelince idempotent push.

## Desteklenen / desteklenmeyen

| Desteklenen | Desteklenmeyen (sonraki sprint) |
| ----------- | -------------------------------- |
| Ekipman listesi önbelleği | Stok hareketi |
| Offline `FAULT_CREATE` | İş emri oluşturma / durum |
| Bekleyen işlem kuyruğu | Fotoğraf / ek kuyruğu |
| Manuel ve online tetiklemeli sync | Background Sync API garantisi |
| Bağlantı durumu UI | Offline bakım planları |

Yerel kayıt sunucunun kabulü değildir. UI: bekleyen / senkronizasyon / senkronize / hata / çakışma.

## Katman ayrımı

- **Service Worker** (`apps/web/public/sw.js`): uygulama kabuğu ve seçili statik varlıklar. `/api/` asla cache edilmez.
- **IndexedDB** (`idb`): ekipman önbelleği, bekleyen işlemler, meta (`deviceId`, son sync zamanı).
- **Tokenlar**: access/refresh IndexedDB veya `localStorage` içine yazılmaz. Access bellek; refresh HttpOnly cookie.

## Veri akışı

```text
1. Login + X-Tenant-Id
2. /offline → GET /equipment → IndexedDB equipment
3. Offline → ekipman seç → FAULT_CREATE kuyruğa
4. Online + geçerli oturum → POST /api/v1/sync/push
5. Sonuç APPLIED|DUPLICATE → yerel status=synced + serverEntityId
```

## Operation ID ve idempotency

- İstemci her işlem için `operationId` (UUID) üretir.
- Sunucu `sync_operations` tablosunda `@@unique([tenantId, operationId])` uygular.
- Aynı `operationId` + aynı payload özeti → `DUPLICATE` ve önceki `entityId`.
- Aynı `operationId` + farklı payload → `CONFLICT` / `PAYLOAD_CONFLICT` (sessizce kabul edilmez).
- Eşzamanlı çift gönderimde unique constraint + yeniden yükleme güvenli sonucu sağlar.
- `deviceId` / `operationId` yetkilendirme kaynağı değildir.
- `clientCreatedAt` olayın cihaz zamanıdır; sunucu `createdAt` ve yetki otoritesidir.
- `reporterId` her zaman doğrulanmış kullanıcıdır.

## Sync yanıt sözleşmesi

`POST /api/v1/sync/push` → `{ data: { results: SyncPushOperationResult[] } }`

Her işlem için `status`:

| status | Anlam | İstemci |
| ------ | ----- | ------- |
| `APPLIED` | Yeni kayıt oluştu | `synced` + `serverEntityId` |
| `DUPLICATE` | Daha önce işlendi | `synced` (tekrar oluşturma yok) |
| `REJECTED` | Yetki/doğrulama/kalıcı | `failed`, sonsuz retry yok |
| `CONFLICT` | Payload çelişkisi | `conflict`, manuel inceleme |
| `RETRYABLE` | Geçici sunucu hatası | `pending`, retryCount++ |

Batch içindeki işlemler birbirinden bağımsız transaction ile işlenir; biri fail olsa diğerlerinin sonucu belirsiz kalmaz.

## Retry politikası

- İstemci en fazla 5 deneme (`MAX_RETRIES`).
- Geçici ağ/sunucu hatalarında `pending` kalır.
- `REJECTED` / `CONFLICT` tekrarlanmaz (retryCount tavanı veya conflict durumu).
- Aynı anda tek `runSync` (in-flight kilidi).
- Background Sync varsayılmaz; `online` olayı, uygulama açılışı ve manuel buton tetikler.
- Oturum 401 olduğunda kuyruk silinmez; yeniden giriş sonrası sync devam eder.

## Oturum süresi

Access token süresi dolunca API çağrıları refresh cookie ile yenilenir. Refresh de biterse kullanıcı giriş yapar; IndexedDB kuyruğu korunur.

## Tenant / kullanıcı / çıkış politikası

- UI yalnızca aktif `userId` + `tenantId` kayıtlarını okur.
- Ekipman önbellek anahtarı: `tenantId:userId:equipmentId` (çapraz kullanıcı çakışması yok).
- Tenant değişince eski tenant listesi gösterilmez (filtre).
- **Çıkış:** bekleyen işlem varsa uyarı; bekleyenler **silinmez**. Hassas ekipman önbelleği temizlenir. Aynı hesapla dönüşte kuyruk senkronize edilebilir.
- Başka kullanıcı ile girişte önceki kullanıcının kuyruğu görünmez.

## Yerel test adımları

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

1. `operator@demo.bakimos.local` ile giriş.
2. **Çevrimdışı** menüsünden «Ekipmanları indir».
3. DevTools → Network → Offline.
4. Ekipman → Arıza bildir → yerel kaydet; üst barda bekleyen sayısı artsın.
5. Online yap → «Şimdi senkronize et» veya otomatik sync; durum `synced`.
6. Aynı `operationId` tekrar push edilirse sunucuda tek arıza kalır (`pnpm --filter @bakimos/api test:e2e` içindeki sync testleri).

Frontend birim: `pnpm --filter @bakimos/web test` (`fake-indexeddb`).

Playwright ile gerçek tarayıcı e2e bu sprintte kurulmadı; manuel akış ve Jest/API e2e ile doğrulandı.
