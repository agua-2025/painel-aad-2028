"use client";

import { useEffect, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { registerAuditLog } from "@/lib/audit";

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
  accepted_statute: boolean | null;
  accepted_financial_rules: boolean | null;
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
  if (!value) return "Não informado";

  const [datePart] = value.split("T");
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return "Não informado";
  }

  return `${day}/${month}/${year}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Não informado";
}

function formatBoolean(value: boolean | null | undefined) {
  return value ? "Sim" : "Não";
}

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printMembershipRequest(request: MembershipRequest) {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
    return;
  }

  const cityState =
    [request.city, request.state].filter(Boolean).join(" / ") || "Não informado";

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Termo de Adesão - ${escapeHtml(request.full_name)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 32px;
            color: #13233a;
            line-height: 1.45;
          }

          h1 {
            font-size: 22px;
            margin: 0 0 4px;
            text-align: center;
          }

          h2 {
            font-size: 15px;
            margin: 24px 0 10px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 6px;
          }

          .subtitle {
            text-align: center;
            font-size: 13px;
            margin-bottom: 28px;
          }

          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 24px;
          }

          .item {
            font-size: 13px;
          }

          .label {
            font-weight: bold;
          }

          .box {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px;
            margin-top: 8px;
            font-size: 13px;
          }

          .declaration {
            text-align: justify;
          }

          .signature {
            margin-top: 56px;
            text-align: center;
          }

          .signature-line {
            width: 320px;
            border-top: 1px solid #13233a;
            margin: 0 auto 8px;
          }

          @media print {
            button {
              display: none;
            }

            body {
              margin: 24px;
            }
          }
        </style>
      </head>

      <body>
        <h1>Termo de Adesão à Associação</h1>
        <p class="subtitle">
          Associação dos Acadêmicos do Curso de Direito – Turma de Formatura 2028 – AAD Direito 2028
        </p>

        <h2>Dados do interessado</h2>
        <div class="grid">
          <div class="item"><span class="label">Nome completo:</span> ${escapeHtml(formatValue(request.full_name))}</div>
          <div class="item"><span class="label">CPF:</span> ${escapeHtml(formatValue(request.cpf))}</div>
          <div class="item"><span class="label">RG:</span> ${escapeHtml(formatValue(request.rg))}</div>
          <div class="item"><span class="label">Data de nascimento:</span> ${escapeHtml(request.birth_date ? formatDate(request.birth_date) : "Não informado")}</div>
          <div class="item"><span class="label">Telefone/WhatsApp:</span> ${escapeHtml(formatValue(request.phone))}</div>
          <div class="item"><span class="label">E-mail:</span> ${escapeHtml(formatValue(request.email))}</div>
          <div class="item"><span class="label">Semestre:</span> ${escapeHtml(formatValue(request.semester))}</div>
          <div class="item"><span class="label">Cidade/UF:</span> ${escapeHtml(cityState)}</div>
          <div class="item"><span class="label">Endereço:</span> ${escapeHtml(formatValue(request.address))}</div>
          <div class="item"><span class="label">CEP:</span> ${escapeHtml(formatValue(request.zip_code))}</div>
        </div>

        <h2>Manifestação de adesão</h2>
        <div class="box declaration">
          Declaro que este formulário constitui meu Termo de Adesão à Associação dos Acadêmicos do Curso de Direito –
          Turma de Formatura 2028 – AAD Direito 2028. Declaro, sob minha responsabilidade, que as informações
          prestadas são verdadeiras e correspondem à minha situação atual, bem como afirmo que li, compreendi e aceito
          o Estatuto Social da Associação.
        </div>

        <div class="box declaration">
          Declaro ciência e concordância com as regras financeiras aplicáveis aos associados, incluindo contribuições
          mensais, taxas, contribuições extras e demais obrigações regularmente aprovadas pela Associação.
        </div>

        <h2>Observações</h2>
        <div class="box">
          <span class="label">Observação do interessado:</span>
          ${escapeHtml(request.message || "Nenhuma observação informada.")}
        </div>

        <h2>Análise da Associação</h2>
        <div class="grid">
          <div class="item"><span class="label">Situação:</span> ${escapeHtml(formatStatus(request.status))}</div>
          <div class="item"><span class="label">Enviado em:</span> ${escapeHtml(formatDate(request.created_at))}</div>
          <div class="item"><span class="label">Analisado em:</span> ${escapeHtml(request.reviewed_at ? formatDate(request.reviewed_at) : "Não analisado")}</div>
          <div class="item"><span class="label">Aceitou Estatuto:</span> ${escapeHtml(formatBoolean(request.accepted_statute))}</div>
          <div class="item"><span class="label">Aceitou regras financeiras:</span> ${escapeHtml(formatBoolean(request.accepted_financial_rules))}</div>
        </div>

        <div class="box">
          <span class="label">Observação da Associação:</span>
          ${escapeHtml(request.review_notes || "Nenhuma observação registrada.")}
        </div>

        <div class="signature">
          <div class="signature-line"></div>
          <div>${escapeHtml(request.full_name)}</div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<MembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<MembershipRequest | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadRequests() {
    setLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("membership_requests")
      .select(
      "id, profile_id, full_name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, semester, message, accepted_statute, accepted_financial_rules, status, review_notes, reviewed_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível carregar os Termos de Adesão.");
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

      await registerAuditLog({
    supabase,
    action: "approve_membership_request",
    module: "termos_adesao",
    tableName: "membership_requests",
    recordId: request.id,
    description: `Aprovou o Termo de Adesão de ${request.full_name} e cadastrou/atualizou o associado.`,
    oldData: {
      status: request.status,
      review_notes: request.review_notes,
    },
    newData: {
      status: "aprovada",
      review_notes: "Solicitação aprovada e associado cadastrado no sistema.",
      full_name: request.full_name,
      email: request.email,
      cpf: request.cpf,
    },
  });

  setSuccessMessage("Termo de Adesão aprovado e associado cadastrado com sucesso.");
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
      setErrorMessage("Não foi possível marcar o Termo de Adesão com pendência.");
      setProcessingId(null);
      return;
    }

await registerAuditLog({
  supabase,
  action: "mark_membership_request_pending",
  module: "termos_adesao",
  tableName: "membership_requests",
  recordId: request.id,
  description: `Marcou o Termo de Adesão de ${request.full_name} com pendência.`,
  oldData: {
    status: request.status,
    review_notes: request.review_notes,
  },
  newData: {
    status: "com_pendencia",
    review_notes: note.trim(),
    full_name: request.full_name,
    email: request.email,
    cpf: request.cpf,
  },
});

    setSuccessMessage("Termo de Adesão marcado com pendência.");
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
      setErrorMessage("Não foi possível rejeitar o Termo de Adesão.");
      setProcessingId(null);
      return;
    }

await registerAuditLog({
  supabase,
  action: "reject_membership_request",
  module: "termos_adesao",
  tableName: "membership_requests",
  recordId: request.id,
  description: `Rejeitou o Termo de Adesão de ${request.full_name}.`,
  oldData: {
    status: request.status,
    review_notes: request.review_notes,
  },
  newData: {
    status: "rejeitada",
    review_notes: note.trim(),
    full_name: request.full_name,
    email: request.email,
    cpf: request.cpf,
  },
});

    setSuccessMessage("Termo de Adesão rejeitado com registro do motivo.");
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
                Termos de Adesão
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Analise os Termos de Adesão enviados pelos acadêmicos interessados em ingressar
                na AAD Direito 2028 antes de aprovar, solicitar correção ou rejeitar.
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
              Termos recebidos
            </h2>

            <p className="mt-1 text-xs font-bold leading-6 text-[#596579]">
              Revise os dados completos declarados no Termo de Adesão antes de aprovar,
              solicitar correção ou rejeitar.
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
                      <th className="px-4 py-2.5">Dados do termo</th>
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

                          <div className="mt-2 space-y-1 text-xs font-medium leading-5 text-[#596579]">
                            <p>
                              <strong className="text-[#13233a]">CPF:</strong>{" "}
                              {request.cpf || "Não informado"}
                            </p>

                            <p>
                              <strong className="text-[#13233a]">RG:</strong>{" "}
                              {request.rg || "Não informado"}
                            </p>

                            <p>
                              <strong className="text-[#13233a]">Nascimento:</strong>{" "}
                              {request.birth_date ? formatDate(request.birth_date) : "Não informado"}
                            </p>

                            <p>
                              <strong className="text-[#13233a]">Semestre:</strong>{" "}
                              {request.semester || "Não informado"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs font-medium leading-5 text-[#596579]">
                            <p className="text-sm font-bold text-[#13233a]">{request.email}</p>

                            <p>
                              <strong className="text-[#13233a]">Telefone/WhatsApp:</strong>{" "}
                              {request.phone || "Não informado"}
                            </p>

                            <p>
                              <strong className="text-[#13233a]">Endereço:</strong>{" "}
                              {request.address || "Não informado"}
                            </p>

                            <p>
                              <strong className="text-[#13233a]">Cidade/UF:</strong>{" "}
                              {[request.city, request.state].filter(Boolean).join(" / ") ||
                                "Não informado"}
                            </p>

                            <p>
                              <strong className="text-[#13233a]">CEP:</strong>{" "}
                              {request.zip_code || "Não informado"}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-2 text-xs leading-5 text-[#596579]">
                            <p>
                              <strong className="text-[#13233a]">Enviado em:</strong>{" "}
                              {formatDate(request.created_at)}
                            </p>

                            {request.reviewed_at && (
                              <p>
                                <strong className="text-[#13233a]">Analisado em:</strong>{" "}
                                {formatDate(request.reviewed_at)}
                              </p>
                            )}

                            <div className="rounded-lg bg-[#f7f8fa] px-3 py-2">
                              <strong className="text-[#13233a]">Observação do interessado:</strong>{" "}
                              <span>{request.message || "Nenhuma observação informada."}</span>
                            </div>

                            </div>
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
                            <div className="flex flex-col items-end gap-2">
                            <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                            className="w-28 rounded-full border border-[#e8dccb] bg-white px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
                          >
                            Ver termo
                          </button>

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
                                <span className="w-28 rounded-full bg-[#f7f8fa] px-3 py-2 text-center text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
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
                        <strong className="text-[#13233a]">CPF:</strong>{" "}
                        {request.cpf || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">RG:</strong>{" "}
                        {request.rg || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Nascimento:</strong>{" "}
                        {request.birth_date ? formatDate(request.birth_date) : "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Semestre:</strong>{" "}
                        {request.semester || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Telefone/WhatsApp:</strong>{" "}
                        {request.phone || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">E-mail:</strong>{" "}
                        {request.email}
                      </p>

                      <p className="sm:col-span-2">
                        <strong className="text-[#13233a]">Endereço:</strong>{" "}
                        {request.address || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Cidade/UF:</strong>{" "}
                        {[request.city, request.state].filter(Boolean).join(" / ") ||
                          "Não informada"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">CEP:</strong>{" "}
                        {request.zip_code || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Enviado em:</strong>{" "}
                        {formatDate(request.created_at)}
                      </p>

                      {request.reviewed_at && (
                        <p>
                          <strong className="text-[#13233a]">Analisado em:</strong>{" "}
                          {formatDate(request.reviewed_at)}
                        </p>
                      )}
                    </div>

                      {request.message && (
                        <div className="mt-4 rounded-xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                          <strong className="text-[#13233a]">Observação:</strong>{" "}
                          {request.message}
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
                {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
            <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#e8dccb] bg-white px-5 py-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                    Termo de Adesão
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                    {selectedRequest.full_name}
                  </h2>

                  <p className="mt-1 text-sm font-bold text-[#596579]">
                    Enviado em {formatDate(selectedRequest.created_at)} •{" "}
                    {formatStatus(selectedRequest.status)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => printMembershipRequest(selectedRequest)}
                    className="rounded-full bg-[#13233a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white"
                  >
                    Imprimir termo
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <section className="rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                    Dados do interessado
                  </h3>

                  <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-2">
                    <p>
                      <strong className="text-[#13233a]">Nome completo:</strong>{" "}
                      {selectedRequest.full_name}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">CPF:</strong>{" "}
                      {selectedRequest.cpf || "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">RG:</strong>{" "}
                      {selectedRequest.rg || "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Data de nascimento:</strong>{" "}
                      {selectedRequest.birth_date
                        ? formatDate(selectedRequest.birth_date)
                        : "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Telefone/WhatsApp:</strong>{" "}
                      {selectedRequest.phone || "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">E-mail:</strong>{" "}
                      {selectedRequest.email}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Semestre:</strong>{" "}
                      {selectedRequest.semester || "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">Cidade/UF:</strong>{" "}
                      {[selectedRequest.city, selectedRequest.state].filter(Boolean).join(" / ") ||
                        "Não informado"}
                    </p>

                    <p className="md:col-span-2">
                      <strong className="text-[#13233a]">Endereço:</strong>{" "}
                      {selectedRequest.address || "Não informado"}
                    </p>

                    <p>
                      <strong className="text-[#13233a]">CEP:</strong>{" "}
                      {selectedRequest.zip_code || "Não informado"}
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#e8dccb] bg-white p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                    Declarações do Termo
                  </h3>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-[#596579]">
                    <p className="rounded-xl bg-[#f7f8fa] p-3">
                      Declaro que este formulário constitui meu Termo de Adesão à
                      Associação dos Acadêmicos do Curso de Direito – Turma de
                      Formatura 2028 – AAD Direito 2028. Declaro, sob minha
                      responsabilidade, que as informações prestadas são verdadeiras
                      e correspondem à minha situação atual, bem como afirmo que li,
                      compreendi e aceito o Estatuto Social da Associação.
                    </p>

                    <p className="rounded-xl bg-[#f7f8fa] p-3">
                      Declaro ciência e concordância com as regras financeiras
                      aplicáveis aos associados, incluindo contribuições mensais,
                      taxas, contribuições extras e demais obrigações regularmente
                      aprovadas pela Associação.
                    </p>

                    <div className="grid gap-3 md:grid-cols-2">
                      <p>
                        <strong className="text-[#13233a]">Aceitou Estatuto:</strong>{" "}
                        {formatBoolean(selectedRequest.accepted_statute)}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">
                          Aceitou regras financeiras:
                        </strong>{" "}
                        {formatBoolean(selectedRequest.accepted_financial_rules)}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-[#e8dccb] bg-white p-4">
                  <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                    Observações e análise
                  </h3>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-[#596579]">
                    <div className="rounded-xl bg-[#f7f8fa] p-3">
                      <strong className="text-[#13233a]">
                        Observação do interessado:
                      </strong>{" "}
                      {selectedRequest.message || "Nenhuma observação informada."}
                    </div>

                    <div className="rounded-xl border border-[#e8dccb] bg-[#fffaf1] p-3">
                      <strong className="text-[#13233a]">
                        Análise da Associação:
                      </strong>{" "}
                      {selectedRequest.review_notes || "Nenhuma observação registrada."}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <p>
                        <strong className="text-[#13233a]">Situação:</strong>{" "}
                        {formatStatus(selectedRequest.status)}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Enviado em:</strong>{" "}
                        {formatDate(selectedRequest.created_at)}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Analisado em:</strong>{" "}
                        {selectedRequest.reviewed_at
                          ? formatDate(selectedRequest.reviewed_at)
                          : "Não analisado"}
                      </p>
                    </div>
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
