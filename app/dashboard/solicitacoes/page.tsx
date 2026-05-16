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
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Associados
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Solicitações de associação
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Pedidos enviados pelos acadêmicos interessados em ingressar na AAD
          Direito 2028.
        </p>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 font-bold text-green-700">
          {successMessage}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Total</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {requests.length}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Pendentes</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Com pendência</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {issueCount}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Aprovadas</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {approvedCount}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Rejeitadas</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {rejectedCount}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-2xl font-black tracking-[-0.04em]">
          Pedidos recebidos
        </h2>

        <p className="mt-2 text-sm font-medium text-[#596579]">
          Analise os pedidos enviados pelo formulário público de associação.
        </p>

        {loading ? (
          <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-5 font-bold text-[#596579]">
            Carregando solicitações...
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-6">
            <h3 className="text-xl font-black tracking-[-0.04em]">
              Nenhuma solicitação encontrada
            </h3>

            <p className="mt-3 leading-7 text-[#596579]">
              Quando alguém preencher o formulário público de associação, o
              pedido aparecerá aqui para análise.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {requests.map((request) => {
              const canAnalyze =
                request.status === "pendente" ||
                request.status === "com_pendencia";

              const isProcessing = processingId === request.id;

              return (
                <article
                  key={request.id}
                  className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black tracking-[-0.04em]">
                          {request.full_name}
                        </h3>

                        <span className="rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                          {formatStatus(request.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm font-medium text-[#596579] md:grid-cols-2 xl:grid-cols-3">
                        <p>
                          <strong className="text-[#13233a]">E-mail:</strong>{" "}
                          {request.email}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">Telefone:</strong>{" "}
                          {request.phone || "Não informado"}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">CPF:</strong>{" "}
                          {request.cpf || "Não informado"}
                        </p>

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
                        <div className="mt-4 rounded-2xl bg-[#f7f8fa] p-4 text-sm leading-6 text-[#596579]">
                          <strong className="text-[#13233a]">
                            Observação do solicitante:
                          </strong>{" "}
                          {request.message}
                        </div>
                      )}

                      {request.review_notes && (
                        <div className="mt-4 rounded-2xl border border-[#e8dccb] bg-[#fffaf1] p-4 text-sm leading-6 text-[#596579]">
                          <strong className="text-[#13233a]">
                            Análise da Associação:
                          </strong>{" "}
                          {request.review_notes}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                      {canAnalyze ? (
                        <>
                          <button
                            type="button"
                            onClick={() => approveRequest(request)}
                            disabled={isProcessing}
                            className="rounded-full bg-[#13233a] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isProcessing ? "Processando..." : "Aprovar"}
                          </button>

                          <button
                            type="button"
                            onClick={() => markAsPending(request)}
                            disabled={isProcessing}
                            className="rounded-full border border-[#e8dccb] bg-[#fffaf1] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#8a5a00] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Pendência
                          </button>

                          <button
                            type="button"
                            onClick={() => rejectRequest(request)}
                            disabled={isProcessing}
                            className="rounded-full border border-red-200 bg-red-50 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Rejeitar
                          </button>
                        </>
                      ) : (
                        <span className="rounded-full bg-[#f7f8fa] px-5 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                          Já analisada
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedDashboard>
  );
}
