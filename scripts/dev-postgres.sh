#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-/Library/PostgreSQL/18/bin}"
DATA="$ROOT/.data/postgres"
PORT="${PG_PORT:-5433}"

if [[ ! -x "$PG_BIN/initdb" ]]; then
  echo "PostgreSQL araçları bulunamadı: $PG_BIN"
  echo "Docker kullanın: docker compose up -d postgres"
  exit 1
fi

mkdir -p "$ROOT/.data"
if [[ ! -d "$DATA/base" ]]; then
  "$PG_BIN/initdb" -D "$DATA" --username=bakimos --auth=trust --no-instructions
fi

if ! "$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PORT" >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$DATA" -l "$ROOT/.data/postgres.log" -o "-p $PORT -k $ROOT/.data" start
fi

"$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U bakimos -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'CREATE DATABASE bakimos' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bakimos')\gexec
SELECT 'CREATE DATABASE bakimos_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bakimos_test')\gexec
SQL

echo "Hazır: postgresql://bakimos@127.0.0.1:${PORT}/bakimos"
