"use client";

import { useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { useDashboardPermissions } from "@/lib/useDashboardPermissions";
import { registerAuditLog } from "@/lib/audit";

type BackupConfig = {
  key: string;
  title: string;
  description: string;
  tableName: string;
  filenamePrefix: string;
};

const backupConfigs: BackupConfig[] = [
  {
    key: "associados",
    title: "Associados",
    description: "Base cadastral completa dos associados.",
    tableName: "associates",
    filenamePrefix: "backup-associados",
  },
  {
    key: "termos_adesao",
    title: "Termos de Adesão",
    description: "Solicitações, termos enviados e análise da Diretoria.",
    tableName: "membership_requests",
    filenamePrefix: "backup-termos-adesao",
  },
  {
    key: "mensalidades",
    title: "Mensalidades",
    description: "Cobranças mensais geradas para os associados.",
    tableName: "monthly_fees",
    filenamePrefix: "backup-mensalidades",
  },
  {
    key: "pagamentos",
    title: "Pagamentos",
    description: "Baixas e pagamentos efetivamente registrados.",
    tableName: "payments",
    filenamePrefix: "backup-pagamentos",
  },
  {
    key: "informes_pagamento",
    title: "Informes de Pagamento",
    description: "Informes enviados pelos associados para análise.",
    tableName: "payment_reports",
    filenamePrefix: "backup-informes-pagamento",
  },
  {
    key: "contribuicoes_extras",
    title: "Contribuições Extras",
    description: "Rateios e cobranças extraordinárias criadas.",
    tableName: "extra_contributions",
    filenamePrefix: "backup-contribuicoes-extras",
  },
  {
    key: "itens_contribuicoes_extras",
    title: "Itens das Contribuições Extras",
    description: "Itens individuais gerados para cada associado.",
    tableName: "extra_contribution_items",
    filenamePrefix: "backup-itens-contribuicoes-extras",
  },
  {
    key: "receitas_avulsas",
    title: "Receitas Avulsas",
    description: "Entradas financeiras avulsas registradas.",
    tableName: "other_revenues",
    filenamePrefix: "backup-receitas-avulsas",
  },
  {
    key: "despesas",
    title: "Despesas",
    description: "Despesas cadastradas, pagas, pendentes ou canceladas.",
    tableName: "expenses",
    filenamePrefix: "backup-despesas",
  },
  {
    key: "saldos_caixa",
    title: "Saldos do Caixa",
    description: "Saldos iniciais mensais cadastrados.",
    tableName: "cash_monthly_balances",
    filenamePrefix: "backup-saldos-caixa",
  },
  {
    key: "fechamentos_mensais",
    title: "Fechamentos Mensais",
    description: "Fechamentos, saldos finais e conciliações mensais.",
    tableName: "monthly_closings",
    filenamePrefix: "backup-fechamentos-mensais",
  },
  {
    key: "historico_fechamentos",
    title: "Histórico dos Fechamentos",
    description: "Histórico técnico de fechamento e reabertura mensal.",
    tableName: "monthly_closing_logs",
    filenamePrefix: "backup-historico-fechamentos",
  },
  {
    key: "regras_financeiras",
    title: "Regras Financeiras",
    description: "Regras de mensalidade, vencimento, multa e juros.",
    tableName: "financial_settings",
    filenamePrefix: "backup-regras-financeiras",
  },
  {
    key: "auditoria",
    title: "Auditoria",
    description: "Logs gerais de auditoria do sistema.",
    tableName: "audit_logs",
    filenamePrefix: "backup-auditoria",
  },
];

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsv(value: unknown) {
  const text = formatValue(value).replaceAll('"', '""');

  return `"${text}"`;
}

function buildCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>())
  );

  const csvRows = [
    headers.map(escapeCsv).join(";"),
    ...rows.map((row) =>
      headers.map((header) => escapeCsv(row[header])).join(";")
    ),
  ];

  return "\uFEFF" + csvRows.join("\n");
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    alert("Não há dados para exportar.");
    return;
  }

  const csv = buildCsv(rows);
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function BackupPage() {
  const permissions = useDashboardPermissions("backup_exportacao");

  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  async function exportBackup(config: BackupConfig) {
    if (!permissions.canCreate) {
      setMessage("Seu perfil não tem permissão para exportar backup.");
      return;
    }

    setMessage("");
    setSuccessMessage("");
    setExportingKey(config.key);

    const supabase = createClient();

    const { data, error } = await supabase
      .from(config.tableName)
      .select("*");

    if (error) {
      console.error("Erro ao exportar backup:", error);
      setMessage(
        error.message ||
          "Não foi possível exportar os dados solicitados."
      );
      setExportingKey(null);
      return;
    }

    const rows = ((data ?? []) as Record<string, unknown>[]);
    const today = new Date().toISOString().slice(0, 10);
    const filename = `${config.filenamePrefix}-${today}.csv`;

    downloadCsv(filename, rows);

    await registerAuditLog({
      supabase,
      action: "export_backup_data",
      module: "backup_exportacao",
      tableName: config.tableName,
      recordId: config.key,
      description: `Exportou backup de ${config.title}.`,
      oldData: null,
      newData: {
        dataset: config.key,
        table_name: config.tableName,
        filename,
        rows_count: rows.length,
      },
    });

    setSuccessMessage(`Backup de ${config.title} exportado com sucesso.`);
    setExportingKey(null);
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Segurança administrativa
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Backup / Exportação
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Exporte bases administrativas sensíveis do sistema para guarda, conferência e contingência.
          </p>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          Esta área contém exportações completas e deve ser usada apenas por perfis autorizados. Cada exportação será registrada na Auditoria.
        </section>

        {message && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {message}
          </section>
        )}

        {successMessage && (
          <section className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
            {successMessage}
          </section>
        )}

        {permissions.isReadOnly && !permissions.loadingPermissions && (
          <section className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-bold text-amber-900">
            Seu perfil pode acessar a área, mas não tem permissão para exportar backup.
          </section>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Bases disponíveis para exportação
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Arquivos gerados em CSV, compatíveis com planilhas.
              </p>
            </div>

            <p className="text-xs font-bold text-[#596579]">
              {backupConfigs.length} conjunto(s)
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
            <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
              <div className="col-span-3">Base</div>
              <div className="col-span-6">Descrição</div>
              <div className="col-span-2">Tabela</div>
              <div className="col-span-1 text-right">Ação</div>
            </div>

            <div className="divide-y divide-[#eee7db]">
              {backupConfigs.map((config) => (
                <article
                  key={config.key}
                  className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                >
                  <div className="md:col-span-3">
                    <p className="font-black text-[#13233a]">
                      {config.title}
                    </p>
                  </div>

                  <div className="text-xs font-medium leading-5 text-[#596579] md:col-span-6">
                    {config.description}
                  </div>

                  <div className="text-xs font-bold text-[#596579] md:col-span-2">
                    {config.tableName}
                  </div>

                  <div className="md:col-span-1 md:text-right">
                    <button
                      type="button"
                      onClick={() => exportBackup(config)}
                      disabled={
                        exportingKey === config.key ||
                        permissions.loadingPermissions ||
                        !permissions.canCreate
                      }
                      className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {exportingKey === config.key ? "Gerando..." : "Exportar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ProtectedDashboard>
  );
}
