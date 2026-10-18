# API kuralları

Temel yol: `/api/v1`. Kırıcı değişiklik yeni bir yol sürümü ister.

## Zarf

Başarı:

```json
{ "data": {}, "meta": { "page": 1, "pageSize": 20, "total": 1, "pageCount": 1 } }
```

`meta` yalnızca listelerde vardır. `204` gövdesizdir.

Hata:

```json
{
  "statusCode": 409,
  "error": "CONFLICT",
  "code": "EQUIPMENT_CODE_TAKEN",
  "message": "Bu ekipman kodu şirkette kullanılıyor.",
  "timestamp": "2026-10-18T00:00:00.000Z",
  "path": "/api/v1/equipment"
}
```

İstemci `code` alanına bağlanır. `message` operatör metnidir. Yığın izi ve SQL dönmez.

## Kimlik ve kiracı

- Korumalı uçlar `Authorization: Bearer <access>`.
- Kiracı uçları ayrıca `X-Tenant-Id`.
- `POST /api/v1/tenants` yalnızca `X-Bootstrap-Token`.
- Gövdeye `tenantId`, `reporterId`, `qrPublicId` konmaz.

## Sayfalama ve arama

`page` 1'den başlar, `pageSize` en fazla 100. Ekipman listesi `search`, `siteId`, `status` kabul eder. Durum verilmezse arşivler listelenmez. Yeni filtreler mevcut sorguyu bozmadan eklenir.

## Tarih

Yanıt zamanları ISO-8601 UTC'dir. Gösterim tesis saat dilimindedir.

## Idempotency ve sync

Doğrudan `POST /api/v1/faults` hâlâ `operationId` taşımaz. Offline kuyruk için:

`POST /api/v1/sync/push`

- Oturum + `X-Tenant-Id` zorunlu. `Permission.SYNC_PUSH` (arıza yazabilen roller).
- Gövde: `{ deviceId, operations: [{ operationId, type, clientCreatedAt, payload }] }`.
- Gövdedeki `tenantId` / `userId` / `reporterId` whitelist dışı → `400`.
- Yanıt: her işlem için `APPLIED | DUPLICATE | REJECTED | CONFLICT | RETRYABLE`.
- Aynı `(tenantId, operationId)` ikinci kez ikinci arıza açmaz.

Ayrıntı: `docs/offline-sync.md`.

## QR

`GET /api/v1/equipment/by-qr/:qrPublicId` oturum ister, `X-Tenant-Id` istemez. Üye olmayan çağrı 404'tür.

Kalıcı adres: `{WEB_ORIGIN}/q/{qrPublicId}`.

## İş emri ve arıza

- `GET /api/v1/faults/:id`, `POST /api/v1/faults/:id/acknowledge|cancel|close`
- `POST /api/v1/work-orders` gövdesinde yalnızca `faultId` ve isteğe bağlı başlık/açıklama vardır.
- `GET /api/v1/work-orders` `status`, `faultId`, `equipmentId`, `assigneeId`, `mine` kabul eder.
- `GET /api/v1/work-orders/assignees` atanabilir üyeleri döner; üyelik listesinin yerine geçmez.
- `POST /api/v1/work-orders/:id/assign|claim|transition` `version` ister.
- Geçersiz durum `409 INVALID_WORK_ORDER_TRANSITION` veya `409 INVALID_FAULT_TRANSITION`.

## Bakım, stok, dosya, rapor

- `GET/POST /api/v1/maintenance/plans`, `POST /api/v1/maintenance/generate`, `GET /api/v1/maintenance/tasks`
- `POST /api/v1/maintenance/tasks/:id/items/:itemId`, `POST /api/v1/maintenance/tasks/:id/complete`
- `GET/POST /api/v1/parts`, `GET/POST /api/v1/stock/movements`, `POST /api/v1/work-orders/:id/parts`
- `GET/POST /api/v1/attachments`, `GET /api/v1/attachments/:id/content`
- `POST /api/v1/equipment/import`, `POST /api/v1/equipment/qr-pdf`
- `GET /api/v1/reports/maintenance?from=&to=` (zorunlu aralık)

Stok `operationId` yinelenirse önceki hareket döner. Yetersiz stok `409 INSUFFICIENT_STOCK`.

## Swagger

Geliştirme ortamında `/docs`.
