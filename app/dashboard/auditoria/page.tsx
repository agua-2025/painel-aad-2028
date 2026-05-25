"use client";

import { useEffect, useState } from "react";
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

  const date = new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatModule(value: string | null) {
  const labels: Record<string, string> = {
    termos_adesao: "Termos de Adesão",
  };

  if (!value) return "Não informado";

  return labels[value] || value.replaceAll("_", " ");
}

function formatAction(value: string) {
  const labels: Record<string, string> = {
    approve_membership_request: "Aprovou termo",
    mark_membership_request_pending: "Marcou pendência",
    reject_membership_request: "Rejeitou termo",
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
      .limit(100);

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

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Administração
          </p>

          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-[-0.04em]">
                Auditoria do Sistema
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Consulte os registros de ações administrativas realizadas no sistema,
                incluindo usuário responsável, módulo, descrição e dados alterados.
              </p>
            </div>

            <button
              type="button"
              onClick={loadLogs}
              className="w-fit rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Atualizar
            </button>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
          <div className="border-b border-[#e8dccb] px-4 py-3">
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Registros recentes
            </h2>

            <p className="mt-1 text-xs font-bold leading-6 text-[#596579]">
              Exibindo os últimos 100 registros de auditoria.
            </p>
          </div>

          {loading ? (
            <div className="p-5">
              <div className="rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
                Carregando registros...
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-5">
              <div className="rounded-2xl bg-[#f7f8fa] p-5">
                <h3 className="font-black text-[#13233a]">
                  Nenhum registro encontrado
                </h3>

                <p className="mt-1 text-xs font-bold leading-6 text-[#596579]">
                  Quando uma ação auditada for realizada, o registro aparecerá aqui.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-xs font-black uppercase tracking-[0.12em] text-[#596579]">
                    <tr>
                      <th className="px-4 py-2.5">Data</th>
                      <th className="px-4 py-2.5">Usuário</th>
                      <th className="px-4 py-2.5">Módulo</th>
                      <th className="px-4 py-2.5">Ação</th>
                      <th className="px-4 py-2.5">Descrição</th>
                      <th className="px-4 py-2.5 text-right">Detalhes</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eef0f3]">
                    {logs.map((log) => (
                      <tr key={log.id} className="align-top">
                        <td className="px-4 py-3 text-xs font-bold text-[#596579]">
                          {formatDateTime(log.created_at)}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-black text-[#13233a]">
                            {log.user_name || "Usuário não identificado"}
                          </p>

                          <p className="mt-0.5 text-xs font-medium text-[#596579]">
                            {log.user_email || "E-mail não informado"}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-xs font-bold text-[#596579]">
                          {formatModule(log.module)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full border border-[#e8dccb] bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {formatAction(log.action)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-sm leading-6 text-[#596579]">
                          {log.description || "Sem descrição registrada."}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="rounded-full border border-[#e8dccb] bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
                          >
                            Ver dados
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-5 xl:hidden">
                {logs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-2xl border border-[#e8dccb] bg-white p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#a7834d]">
                          {formatModule(log.module)}
                        </p>

                        <h3 className="mt-1 font-black text-[#13233a]">
                          {formatAction(log.action)}
                        </h3>

                        <p className="mt-1 text-xs font-bold text-[#596579]">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
                      >
                        Ver dados
                      </button>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-[#596579]">
                      {log.description || "Sem descrição registrada."}
                    </p>

                    <p className="mt-3 text-xs font-bold text-[#596579]">
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
