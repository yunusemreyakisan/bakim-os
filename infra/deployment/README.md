# Dağıtım notları

Sprint 1 hedefi yerel çalıştırmadır. Aşağıdaki düzen üretim onayı değildir.

## Yerel

`docker-compose.yml` Postgres, API ve web tanımlar. Yalnızca veritabanı:

```bash
docker compose up -d postgres
```

Uygulama imajları:

```bash
docker compose --profile app up --build
```

API `0.0.0.0:3001`, web `3000` dinler. Web, API'ye `http://api:3001` üzerinden gider.

## Bulut

- Sırlar ortam değişkenidir. `.env` imaja gömülmez.
- PostgreSQL uygulama kabının dışında yaşar.
- API durumu veritabanındadır. Hız sınırı süreç belleğindedir; birden fazla kopya için ortak sayaç henüz yoktur.
- Dosya baytları kap diskine bağlanmaz. `ObjectStorage` portu sonraki Blob veya tesis depolamasına bırakılır.

## Fabrika içi

Aynı imajlar ileride tesis içinde çalışabilir. Güncelleme öncesi veritabanı yedeği alınır, ardından migration uygulanır. Yedek kapsamı PostgreSQL ve nesne deposudur. Lisanslama ve uzaktan destek bu depoda yoktur; tesis ağına kalıcı destek kapısı açılmaz.

Ayrıntılı sınırlar `docs/architecture.md` içindedir.
