"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type AuditLog = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  module: string | null;
  table_name: string | null;
  record_id: string | null;
  description: string | null;
  old_data: unknown | null;
  new_data: unknown | null;
  created_at: string;
};

function formatDateTime(value: string) {
  if (!value) return "Não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatModule(value: string | null) {
  const labels: Record<string, string> = {
    termos_adesao: "Termos de Adesão",
    informes_pagamento: "Informes de Pagamento",
    despesas: "Despesas",
    receitas_avulsas: "Receitas Avulsas",
    mensalidades: "Mensalidades",
    contribuicoes_extras: "Contribuições Extras",
    fechamento_mensal: "Fechamento Mensal",
    saldos_caixa: "Saldos do Caixa",
    regras_financeiras: "Regras Financeiras",
    associados: "Associados",
  };

  if (!value) return "Não informado";

  return labels[value] || value.replaceAll("_", " ");
}

function formatAction(value: string) {
  const labels: Record<string, string> = {
    approve_membership_request: "Aprovou termo",
    mark_membership_request_pending: "Marcou pendência",
    reject_membership_request: "Rejeitou termo",
    approve_payment_report: "Aprovou informe",
    reject_payment_report: "Rejeitou informe",
    create_expense: "Criou despesa",
    attach_expense_receipt: "Anexou comprovante",
    mark_expense_paid: "Marcou despesa paga",
    cancel_expense: "Cancelou despesa",
    create_other_revenue: "Criou receita avulsa",
    cancel_other_revenue: "Cancelou receita avulsa",
    generate_monthly_fees: "Gerou mensalidades",
    manual_monthly_payment: "Baixa manual de mensalidade",
    create_extra_contribution: "Criou contribuição extra",
    close_monthly_period: "Fechou mês",
    update_monthly_closing: "Atualizou fechamento",
    reopen_monthly_period: "Reabriu mês",
    create_cash_monthly_balance: "Cadastrou saldo inicial",
    update_cash_monthly_balance: "Atualizou saldo inicial",
    create_financial_setting: "Criou regra financeira",
    update_associate_data: "Atualizou associado",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function formatJson(value: unknown | null) {
  if (!value) return "Sem dados";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Não foi possível exibir os dados.";
  }
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("todos");
  const [actionFilter, setActionFilter] = useState("todos");

  async function loadLogs() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        "id, user_name, user_email, action, module, table_name, record_id, description, old_data, new_data, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível carregar os registros de auditoria.");
      setLoading(false);
      return;
    }

    setLogs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const moduleOptions = useMemo(() => {
    const modules = new Set<string>();

    logs.forEach((log) => {
      if (log.module) {
        modules.add(log.module);
      }
    });

    return Array.from(modules).sort();
  }, [logs]);

  const actionOptions = useMemo(() => {
    const actions = new Set<string>();

    logs.forEach((log) => {
      const matchesSelectedModule =
        moduleFilter === "todos" || log.module === moduleFilter;

      if (matchesSelectedModule && log.action) {
        actions.add(log.action);
      }
    });

    return Array.from(actions).sort();
  }, [logs, moduleFilter]);

  useEffect(() => {
  if (
    actionFilter !== "todos" &&
    !actionOptions.includes(actionFilter)
  ) {
    setActionFilter("todos");
  }
}, [actionFilter, actionOptions]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesModule =
        moduleFilter === "todos" || log.module === moduleFilter;

      const matchesAction =
        actionFilter === "todos" || log.action === actionFilter;

      const searchableText = [
        log.user_name,
        log.user_email,
        log.action,
        log.module,
        log.table_name,
        log.record_id,
        log.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesModule && matchesAction && matchesSearch;
    });
  }, [logs, searchTerm, moduleFilter, actionFilter]);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] px-5 py-4 text-white shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Administração
              </p>

              <h1 className="mt-1 text-xl font-black tracking-[-0.03em]">
                Auditoria do Sistema
              </h1>

              <p className="mt-1 max-w-3xl text-xs leading-5 text-white/70">
                Consulte ações administrativas registradas no sistema, com usuário,
                módulo, descrição e dados alterados.
              </p>
            </div>

            <button
              type="button"
              onClick={loadLogs}
              className="w-fit rounded-full bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] transition hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
          <div className="border-b border-[#e8dccb] px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                  Registros recentes
                </h2>

                <p className="mt-0.5 text-xs font-bold leading-5 text-[#596579]">
                  Exibindo {filteredLogs.length} de {logs.length} registros carregados.
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[720px]">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                    Buscar
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="h-9 rounded-xl border border-[#e8dccb] px-3 text-xs font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b]"
                    placeholder="Usuário, ação, descrição..."
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                    Módulo
                  </span>
                  <select
                    value={moduleFilter}
                    onChange={(event) => setModuleFilter(event.target.value)}
                    className="h-9 rounded-xl border border-[#e8dccb] px-3 text-xs font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="todos">Todos</option>
                    {moduleOptions.map((module) => (
                      <option key={module} value={module}>
                        {formatModule(module)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                    Ação
                  </span>
                  <select
                    value={actionFilter}
                    onChange={(event) => setActionFilter(event.target.value)}
                    className="h-9 rounded-xl border border-[#e8dccb] px-3 text-xs font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="todos">Todas</option>
                    {actionOptions.map((action) => (
                      <option key={action} value={action}>
                        {formatAction(action)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-4">
              <div className="rounded-xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
                Carregando registros...
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-4">
              <div className="rounded-xl bg-[#f7f8fa] p-4">
                <h3 className="font-black text-[#13233a]">
                  Nenhum registro encontrado
                </h3>

                <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                  Ajuste os filtros ou realize uma ação auditada no sistema.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-[#f7f8fa] text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                    <tr>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Usuário</th>
                      <th className="px-3 py-2">Módulo</th>
                      <th className="px-3 py-2">Ação</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2 text-right">Detalhes</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eef0f3]">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="align-top hover:bg-[#fafafa]">
                        <td className="whitespace-nowrap px-3 py-2 text-[11px] font-bold leading-5 text-[#596579]">
                          {formatDateTime(log.created_at)}
                        </td>

                        <td className="px-3 py-2">
                          <p className="font-bold leading-5 text-[#13233a]">
                            {log.user_name || "Usuário não identificado"}
                          </p>

                          <p className="text-[11px] font-medium leading-5 text-[#596579]">
                            {log.user_email || "E-mail não informado"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-3 py-2 text-[11px] font-bold leading-5 text-[#596579]">
                          {formatModule(log.module)}
                        </td>

                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-full border border-[#e8dccb] bg-[#f7f8fa] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {formatAction(log.action)}
                          </span>
                        </td>

                        <td className="max-w-xl px-3 py-2 text-xs leading-5 text-[#596579]">
                          <span className="block max-h-10 overflow-hidden">
                            {log.description || "Sem descrição registrada."}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="rounded-full border border-[#e8dccb] bg-white px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 p-4 xl:hidden">
                {filteredLogs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-xl border border-[#e8dccb] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                          {formatModule(log.module)}
                        </p>

                        <h3 className="mt-1 text-sm font-black text-[#13233a]">
                          {formatAction(log.action)}
                        </h3>

                        <p className="mt-1 text-[11px] font-bold text-[#596579]">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#13233a]"
                      >
                        Ver
                      </button>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-[#596579]">
                      {log.description || "Sem descrição registrada."}
                    </p>

                    <p className="mt-2 text-[11px] font-bold text-[#596579]">
                      {log.user_name || "Usuário não identificado"} •{" "}
                      {log.user_email || "E-mail não informado"}
                    </p>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#e8dccb] bg-white px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                    Registro de auditoria
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                    {formatAction(selectedLog.action)}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-[#596579]">
                    {formatDateTime(selectedLog.created_at)} •{" "}
                    {formatModule(selectedLog.module)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-4 p-5">
                <section className="rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                    Informações gerais
                  </h3>

                  <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-2">
                    <p>
                      <strong className="text-[#13233a]">Usuário:</strong>{" "}
                      {selectedLog.user_name || "Não identificado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">E-mail:</strong>{" "}
                      {selectedLog.user_email || "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Módulo:</strong>{" "}
                      {formatModule(selectedLog.module)}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Ação:</strong>{" "}
                      {formatAction(selectedLog.action)}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Tabela:</strong>{" "}
                      {selectedLog.table_name || "Não informada"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Registro:</strong>{" "}
                      {selectedLog.record_id || "Não informado"}
                    </p>

                    <p className="md:col-span-2">
                      <strong className="text-[#13233a]">Descrição:</strong>{" "}
                      {selectedLog.description || "Sem descrição registrada."}
                    </p>
                  </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                      Dados anteriores
                    </h3>

                    <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-[#f7f8fa] p-3 text-xs leading-5 text-[#596579]">
                      {formatJson(selectedLog.old_data)}
                    </pre>
                  </div>

                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                      Dados novos
                    </h3>

                    <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-[#f7f8fa] p-3 text-xs leading-5 text-[#596579]">
                      {formatJson(selectedLog.new_data)}
                    </pre>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedDashboard>
  );
}
