"use client";

import { useEffect, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type MembershipRequest = {
  id: string;
  profile_id: string | null;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  semester: string | null;
  message: string | null;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    com_pendencia: "Com pendência",
    aprovada: "Aprovada",
    rejeitada: "Rejeitada",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function statusStyle(value: string) {
  const styles: Record<string, string> = {
    pendente: "border-amber-200 bg-amber-50 text-amber-700",
    com_pendencia: "border-orange-200 bg-orange-50 text-orange-700",
    aprovada: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rejeitada: "border-red-200 bg-red-50 text-red-700",
  };

  return styles[value] || "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadRequests() {
    setLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("membership_requests")
      .select(
        "id, profile_id, full_name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, semester, message, status, review_notes, reviewed_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível carregar as solicitações.");
      setLoading(false);
      return;
    }

    setRequests(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approveRequest(request: MembershipRequest) {
    const confirmed = window.confirm(
      `Deseja aprovar a solicitação de ${request.full_name} e cadastrar como associado ativo?`
    );

    if (!confirmed) return;

    setProcessingId(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const associatePayload = {
      full_name: request.full_name,
      cpf: request.cpf,
      rg: request.rg,
      birth_date: request.birth_date,
      phone: request.phone,
      email: request.email,
      address: request.address,
      city: request.city,
      state: request.state || "MT",
      zip_code: request.zip_code,
      joined_at: todayISO(),
      status: "ativo",
      financial_status: "em_dia",
      notes: request.message
        ? `Cadastro originado de solicitação pública. Observação do solicitante: ${request.message}`
        : "Cadastro originado de solicitação pública.",
    };

    const { data: existingAssociate } = await supabase
      .from("associates")
      .select("id")
      .or(`email.eq.${request.email}${request.cpf ? `,cpf.eq.${request.cpf}` : ""}`)
      .limit(1)
      .maybeSingle();

    if (existingAssociate?.id) {
      const { error: updateAssociateError } = await supabase
        .from("associates")
        .update(associatePayload)
        .eq("id", existingAssociate.id);

      if (updateAssociateError) {
        console.error(updateAssociateError);
        setErrorMessage("Não foi possível atualizar o associado já existente.");
        setProcessingId(null);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("associates")
        .insert(associatePayload);

      if (insertError) {
        console.error(insertError);
        setErrorMessage(
          "Não foi possível aprovar a solicitação. Verifique se há algum dado incompatível."
        );
        setProcessingId(null);
        return;
      }
    }

    const { error: updateRequestError } = await supabase
      .from("membership_requests")
      .update({
        status: "aprovada",
        reviewed_at: new Date().toISOString(),
        review_notes: "Solicitação aprovada e associado cadastrado no sistema.",
      })
      .eq("id", request.id);

    if (updateRequestError) {
      console.error(updateRequestError);
      setErrorMessage(
        "O associado foi cadastrado/atualizado, mas não foi possível atualizar o status da solicitação."
      );
      setProcessingId(null);
      await loadRequests();
      return;
    }

    setSuccessMessage("Solicitação aprovada e associado cadastrado com sucesso.");
    setProcessingId(null);
    await loadRequests();
  }

  async function markAsPending(request: MembershipRequest) {
    const note = window.prompt(
      `Informe o motivo da pendência para ${request.full_name}:`
    );

    if (!note || !note.trim()) return;

    setProcessingId(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("membership_requests")
      .update({
        status: "com_pendencia",
        review_notes: note.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível marcar a solicitação com pendência.");
      setProcessingId(null);
      return;
    }

    setSuccessMessage("Solicitação marcada com pendência.");
    setProcessingId(null);
    await loadRequests();
  }

  async function rejectRequest(request: MembershipRequest) {
    const note = window.prompt(
      `Informe o motivo da rejeição definitiva de ${request.full_name}:`
    );

    if (!note || !note.trim()) return;

    const confirmed = window.confirm(
      `Confirma a rejeição definitiva da solicitação de ${request.full_name}?`
    );

    if (!confirmed) return;

    setProcessingId(request.id);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("membership_requests")
      .update({
        status: "rejeitada",
        review_notes: note.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível rejeitar a solicitação.");
      setProcessingId(null);
      return;
    }

    setSuccessMessage("Solicitação rejeitada com registro do motivo.");
    setProcessingId(null);
    await loadRequests();
  }

  const pendingCount = requests.filter((item) => item.status === "pendente").length;
  const issueCount = requests.filter((item) => item.status === "com_pendencia").length;
  const approvedCount = requests.filter((item) => item.status === "aprovada").length;
  const rejectedCount = requests.filter((item) => item.status === "rejeitada").length;

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Associados
          </p>

          <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-[-0.04em]">
                Solicitações de associação
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Acompanhe os pedidos enviados pelos acadêmicos interessados em ingressar na AAD Direito 2028.
              </p>
            </div>

            <div className="w-fit rounded-xl bg-white/10 px-4 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/60">
                Total de pedidos
              </p>

              <p className="text-lg font-black text-white">
                {requests.length}
              </p>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {successMessage}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#596579]">
              Total
            </p>
            <p className="mt-2 text-2xl font-black text-[#13233a]">{requests.length}</p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#596579]">
              Pendentes
            </p>
            <p className="mt-2 text-2xl font-black text-[#13233a]">{pendingCount}</p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#596579]">
              Com pendência
            </p>
            <p className="mt-2 text-2xl font-black text-[#13233a]">{issueCount}</p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#596579]">
              Aprovadas
            </p>
            <p className="mt-2 text-2xl font-black text-[#13233a]">{approvedCount}</p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#596579]">
              Rejeitadas
            </p>
            <p className="mt-2 text-2xl font-black text-[#13233a]">{rejectedCount}</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
          <div className="border-b border-[#e8dccb] px-4 py-3">
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Pedidos recebidos
            </h2>

            <p className="mt-1 text-xs font-bold leading-6 text-[#596579]">
              Revise os dados do interessado antes de aprovar, marcar pendência ou rejeitar.
            </p>
          </div>

          {loading ? (
            <div className="p-5 md:p-6">
              <div className="rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
                Carregando solicitações...
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="p-5 md:p-6">
              <div className="rounded-2xl bg-[#f7f8fa] p-5">
                <h3 className="font-black text-[#13233a]">
                  Nenhuma solicitação encontrada
                </h3>

                <p className="mt-1 text-xs font-bold leading-6 text-[#596579]">
                  Quando alguém preencher o formulário público de associação, o pedido aparecerá aqui.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-xs font-black uppercase tracking-[0.12em] text-[#596579]">
                    <tr>
                      <th className="px-4 py-2.5">Interessado</th>
                      <th className="px-4 py-2.5">Contato</th>
                      <th className="px-4 py-2.5">Dados</th>
                      <th className="px-4 py-2.5">Situação</th>
                      <th className="px-4 py-2.5 text-right">Ação</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#eef0f3]">
                    {requests.map((request) => {
                      const canAnalyze =
                        request.status === "pendente" ||
                        request.status === "com_pendencia";

                      const isProcessing = processingId === request.id;

                      return (
                        <tr key={request.id} className="align-top">
                          <td className="px-4 py-3">
                            <p className="font-black text-[#13233a]">
                              {request.full_name}
                            </p>

                            <p className="mt-0.5 text-xs font-medium text-[#596579]">
                              CPF: {request.cpf || "Não informado"}
                            </p>

                            {request.message && (
                              <p className="mt-2 max-w-md rounded-lg bg-[#f7f8fa] px-3 py-2 text-xs leading-5 text-[#596579]">
                                {request.message}
                              </p>
                            )}

                            {request.review_notes && (
                              <p className="mt-2 max-w-md rounded-lg border border-[#e8dccb] bg-[#fffaf1] px-3 py-2 text-xs leading-5 text-[#596579]">
                                <strong className="text-[#13233a]">Análise:</strong>{" "}
                                {request.review_notes}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-[#13233a]">{request.email}</p>
                            <p className="mt-0.5 text-xs font-medium text-[#596579]">
                              {request.phone || "Telefone não informado"}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-xs font-bold leading-5 text-[#596579]">
                            <p>
                              {[request.city, request.state].filter(Boolean).join(" / ") ||
                                "Localidade não informada"}
                            </p>

                            <p>Semestre: {request.semester || "Não informado"}</p>
                            <p>Enviado em: {formatDate(request.created_at)}</p>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${statusStyle(
                                request.status
                              )}`}
                            >
                              {formatStatus(request.status)}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              {canAnalyze ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => approveRequest(request)}
                                    disabled={isProcessing}
                                    className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isProcessing ? "..." : "Aprovar"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => markAsPending(request)}
                                    disabled={isProcessing}
                                    className="rounded-full border border-amber-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Pendência
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => rejectRequest(request)}
                                    disabled={isProcessing}
                                    className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Rejeitar
                                  </button>
                                </>
                              ) : (
                                <span className="rounded-full bg-[#f7f8fa] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                                  Analisada
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-5 xl:hidden">
                {requests.map((request) => {
                  const canAnalyze =
                    request.status === "pendente" ||
                    request.status === "com_pendencia";

                  const isProcessing = processingId === request.id;

                  return (
                    <article
                      key={request.id}
                      className="rounded-2xl border border-[#e8dccb] bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-black text-[#13233a]">
                            {request.full_name}
                          </h3>

                          <p className="mt-1 text-sm text-[#596579]">
                            {request.email}
                          </p>

                          <p className="mt-1 text-xs font-medium text-[#596579]">
                            {request.phone || "Telefone não informado"} •{" "}
                            {request.cpf || "CPF não informado"}
                          </p>
                        </div>

                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${statusStyle(
                            request.status
                          )}`}
                        >
                          {formatStatus(request.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-[#596579] sm:grid-cols-2">
                        <p>
                          <strong className="text-[#13233a]">Cidade:</strong>{" "}
                          {[request.city, request.state].filter(Boolean).join(" / ") ||
                            "Não informada"}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">Semestre:</strong>{" "}
                          {request.semester || "Não informado"}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">Enviado em:</strong>{" "}
                          {formatDate(request.created_at)}
                        </p>
                      </div>

                      {request.message && (
                        <div className="mt-4 rounded-xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                          <strong className="text-[#13233a]">Observação:</strong>{" "}
                          {request.message}
                        </div>
                      )}

                      {request.review_notes && (
                        <div className="mt-3 rounded-xl border border-[#e8dccb] bg-[#fffaf1] p-3 text-sm leading-6 text-[#596579]">
                          <strong className="text-[#13233a]">Análise:</strong>{" "}
                          {request.review_notes}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {canAnalyze ? (
                          <>
                            <button
                              type="button"
                              onClick={() => approveRequest(request)}
                              disabled={isProcessing}
                              className="rounded-full bg-[#13233a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isProcessing ? "Processando..." : "Aprovar"}
                            </button>

                            <button
                              type="button"
                              onClick={() => markAsPending(request)}
                              disabled={isProcessing}
                              className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#8a5a00] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Pendência
                            </button>

                            <button
                              type="button"
                              onClick={() => rejectRequest(request)}
                              disabled={isProcessing}
                              className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Rejeitar
                            </button>
                          </>
                        ) : (
                          <span className="rounded-full bg-[#f7f8fa] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                            Já analisada
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
