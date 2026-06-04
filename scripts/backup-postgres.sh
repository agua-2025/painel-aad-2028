#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Erro: SUPABASE_DB_URL não está definida."
  echo "Antes de rodar, use:"
  echo "set -a && source .env.local && set +a"
  exit 1
fi

DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="backups/postgres/$DATE"

mkdir -p "$BACKUP_DIR"

echo "Iniciando backup técnico via pg_dump..."
echo "Destino: $BACKUP_DIR"

/usr/lib/postgresql/17/bin/pg_dump "$SUPABASE_DB_URL" \
  --format=plain \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_DIR/database.sql"

gzip "$BACKUP_DIR/database.sql"

echo ""
echo "Backup concluído com sucesso."
echo "Arquivo gerado:"
ls -lh "$BACKUP_DIR"
