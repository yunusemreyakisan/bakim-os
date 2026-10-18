#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-/Library/PostgreSQL/18/bin}"
DATABASE_URL="${DATABASE_URL:-postgresql://bakimos@127.0.0.1:5433/bakimos}"
OUT="${1:-$ROOT/.data/backups/bakimos-$(date +%Y%m%d-%H%M%S).dump}"

mkdir -p "$(dirname "$OUT")"
if [[ ! -x "$PG_BIN/pg_dump" ]]; then
  echo "pg_dump yok: $PG_BIN/pg_dump"
  exit 1
fi

"$PG_BIN/pg_dump" --format=custom --no-owner --dbname="$DATABASE_URL" --file="$OUT"
echo "Yedek: $OUT"
echo "Dosya kökü (STORAGE_ROOT) ayrı kopyalanmalıdır. Uygulama diski yedek kaynağı değildir."
