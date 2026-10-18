#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-/Library/PostgreSQL/18/bin}"
DATABASE_URL="${DATABASE_URL:-postgresql://bakimos@127.0.0.1:5433/bakimos}"
DUMP="${1:-}"

if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Kullanım: ./scripts/restore-postgres.sh <dump-dosyası>"
  exit 1
fi
if [[ ! -x "$PG_BIN/pg_restore" ]]; then
  echo "pg_restore yok: $PG_BIN/pg_restore"
  exit 1
fi

"$PG_BIN/pg_restore" --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DUMP"
echo "Geri yüklendi: $DUMP"
echo "STORAGE_ROOT kopyası ayrıca yerine konmalıdır."
