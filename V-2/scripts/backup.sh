#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
[ -f .env ] && source .env
set +a
backup_root="${BACKUP_DIR:-./backups}"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
out="$backup_root/$stamp"
mkdir -p "$out"
mysqldump --single-transaction --routines --triggers --host="${DB_HOST:-127.0.0.1}" --port="${DB_PORT:-3306}" --user="${DB_USER:-root}" --password="${DB_PASSWORD:-}" "${DB_NAME:-bot_404}" | gzip -9 > "$out/database.sql.gz"
if [ -d "${MEDIA_DIR:-./data/media}" ]; then tar -czf "$out/media.tar.gz" "${MEDIA_DIR:-./data/media}"; fi
printf 'Backup written to %s\n' "$out"
