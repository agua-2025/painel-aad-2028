#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Erro: SUPABASE_DB_URL não está definida."
  echo "Antes de rodar, carregue o .env.local com:"
  echo "set -a && source .env.local && set +a"
  exit 1
fi

DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="backups/supabase/$DATE"

mkdir -p "$BACKUP_DIR"

echo "Iniciando backup técnico do Supabase..."
echo "Destino: $BACKUP_DIR"

echo "1/3 Exportando roles..."
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$BACKUP_DIR/roles.sql" \
  --role-only

echo "2/3 Exportando estrutura/schema..."
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$BACKUP_DIR/schema.sql"

echo "3/3 Exportando dados..."
supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  -f "$BACKUP_DIR/data.sql" \
  --use-copy \
  --data-only

echo ""
echo "Backup concluído com sucesso."
echo "Arquivos gerados:"
ls -lh "$BACKUP_DIR"
