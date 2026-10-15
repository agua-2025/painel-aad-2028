Get-Clipboard -Raw | Set-Content .\sql\implantacao_desligamento_aplicada.sql -Encoding UTF8

git add sql/implantacao_desligamento_aplicada.sql
git commit -m "Registra migracao de desligamento aplicada no Supabase"
