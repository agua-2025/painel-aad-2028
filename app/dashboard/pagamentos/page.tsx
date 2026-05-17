"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type PaymentReport = {
  id: string;
  associate_id: string;
  monthly_fee_id: string;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  associates:
    | {
        full_name: string;
        email: string | null;
        phone: string | null;
      }
    | {
        full_name: string;
        email: string | null;
        phone: string | null;
      }[]
    | null;
  monthly_fees:
    | {
        id: string;
        year: number;
        month: number;
        base_amount: number;
        due_date: string;
        late_fee_percent: number;
        daily_interest_percent: number;
        paid_amount: number;
        status: string;
        financial_settings:
          | {
              late_fee_grace_days: number;
            }
          | {
              late_fee_grace_days: number;
            }[]
          | null;
      }
    | {
        id: string;
        year: number;
        month: number;
        base_amount: number;
        due_date: string;
        late_fee_percent: number;
        daily_interest_percent: number;
        paid_amount: number;
        status: string;
        financial_settings:
          | {
              late_fee_grace_days: number;
            }
          | {
              late_fee_grace_days: number;
            }[]
          | null;
      }[]
    | null;
};

type ReviewForm = {
  review_notes: string;
};

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  deposito: "Depósito",
  cartao: "Cartão",
  outros: "Outros",
};

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

function formatCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const dateOnly = value.includes("T") ? value : value + "T00:00:00";
  const date = new Date(dateOnly);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function getAssociate(report: PaymentReport) {
  if (Array.isArray(report.associates)) {
    return report.associates[0] ?? null;
  }

  return report.associates ?? null;
}

function getMonthlyFee(report: PaymentReport) {
  if (Array.isArray(report.monthly_fees)) {
    return report.monthly_fees[0] ?? null;
  }

  return report.monthly_fees ?? null;
}

function getMonthLabel(report: PaymentReport) {
  const fee = getMonthlyFee(report);

  if (!fee) return "Mensalidade não localizada";

  return `${monthNames[Number(fee.month) - 1]} de ${fee.year}`;
}

function getGraceDays(report: PaymentReport) {
  const fee = getMonthlyFee(report);

  if (!fee) return 0;

  if (Array.isArray(fee.financial_settings)) {
    return Number(fee.financial_settings[0]?.late_fee_grace_days ?? 0);
  }

  return Number(fee.financial_settings?.late_fee_grace_days ?? 0);
}

function calculateAmountDueAtDate(report: PaymentReport) {
  const fee = getMonthlyFee(report);

  if (!fee) {
    return {
      daysWithCharges: 0,
      lateFeeAmount: 0,
      interestAmount: 0,
      totalDue: 0,
      remaining: 0,
    };
  }

  const baseAmount = Number(fee.base_amount ?? 0);
  const dueDate = new Date(fee.due_date + "T00:00:00");
  const paymentDate = new Date(report.paid_at + "T00:00:00");

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    return {
      daysWithCharges: 0,
      lateFeeAmount: 0,
      interestAmount: 0,
      totalDue: baseAmount,
      remaining: Math.max(baseAmount - Number(fee.paid_amount ?? 0), 0),
    };
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysAfterDue = Math.floor(
    (paymentDate.getTime() - dueDate.getTime()) / millisecondsPerDay
  );

  const graceDays = getGraceDays(report);
  const daysWithCharges = Math.max(daysAfterDue - graceDays, 0);

  const lateFeeAmount =
    daysWithCharges > 0
      ? Number((baseAmount * (Number(fee.late_fee_percent ?? 0) / 100)).toFixed(2))
      : 0;

  const interestAmount =
    daysWithCharges > 0
      ? Number(
          (
            baseAmount *
            (Number(fee.daily_interest_percent ?? 0) / 100) *
            daysWithCharges
          ).toFixed(2)
        )
      : 0;

  const totalDue = Number((baseAmount + lateFeeAmount + interestAmount).toFixed(2));
  const remaining = Math.max(totalDue - Number(fee.paid_amount ?? 0), 0);

  return {
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
    remaining,
  };
}

function getReportBadgeClass(status: string) {
  if (status === "aprovado") {
    return "bg-green-100 text-green-800";
  }

  if (status === "rejeitado") {
    return "bg-red-100 text-red-800";
  }

  return "bg-amber-100 text-amber-900";
}

export default function DashboardPagamentosPage() {
  const [reports, setReports] = useState<PaymentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [forms, setForms] = useState<Record<string, ReviewForm>>({});

  const summary = useMemo(() => {
    const pending = reports.filter((report) => report.status === "pendente");
    const approved = reports.filter((report) => report.status === "aprovado");
    const rejected = reports.filter((report) => report.status === "rejeitado");

    const pendingAmount = pending.reduce(
      (sum, report) => sum + Number(report.amount ?? 0),
      0
    );

    return {
      pending,
      approved,
      rejected,
      pendingAmount,
    };
  }, [reports]);

  async function loadReports() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("payment_reports")
      .select(
        "id, associate_id, monthly_fee_id, amount, paid_at, payment_method, reference, notes, status, review_notes, created_at, associates(full_name, email, phone), monthly_fees(id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, paid_amount, status, financial_settings(late_fee_grace_days))"
      )
      .eq("status", "pendente")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar informes:", error);
      setMessage(error.message || "Não foi possível carregar os informes de pagamento.");
      setLoading(false);
      return;
    }

    const typedReports = (data as unknown as PaymentReport[]) ?? [];
    setReports(typedReports);

    const nextForms: Record<string, ReviewForm> = {};
    typedReports.forEach((report) => {
      nextForms[report.id] = {
        review_notes: report.review_notes ?? "",
      };
    });

    setForms(nextForms);
    setLoading(false);
  }

  useEffect(() => {
    loadReports();
  }, []);

  function updateReviewNotes(reportId: string, value: string) {
    setForms((previous) => ({
      ...previous,
      [reportId]: {
        review_notes: value,
      },
    }));
  }

  async function getCurrentProfileId() {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    return profile?.id ?? null;
  }

  async function approveReport(report: PaymentReport) {
    const fee = getMonthlyFee(report);

    if (!fee) {
      setMessage("Mensalidade vinculada ao informe não foi localizada.");
      return;
    }

    if (report.status !== "pendente") {
      setMessage("Este informe já foi analisado.");
      return;
    }

    setProcessingId(report.id);
    setMessage("");

    const supabase = createClient();
    const profileId = await getCurrentProfileId();

    const calculated = calculateAmountDueAtDate(report);
    const paidAmountBefore = Number(fee.paid_amount ?? 0);
    const reportAmount = Number(report.amount ?? 0);
    const paidAmountAfter = Number((paidAmountBefore + reportAmount).toFixed(2));

    const nextStatus =
      paidAmountAfter >= calculated.totalDue ? "paga" : "parcialmente_paga";

    const { error: paymentError } = await supabase.from("payments").insert({
      associate_id: report.associate_id,
      monthly_fee_id: report.monthly_fee_id,
      amount: reportAmount,
      paid_at: report.paid_at,
      payment_method: report.payment_method,
      reference: report.reference,
      notes:
        forms[report.id]?.review_notes?.trim() ||
        report.notes ||
        "Baixa realizada a partir de informe de pagamento do associado.",
    });

    if (paymentError) {
      setMessage(paymentError.message || "Não foi possível registrar o pagamento.");
      setProcessingId(null);
      return;
    }

    const { error: feeError } = await supabase
      .from("monthly_fees")
      .update({
        late_fee_amount: calculated.lateFeeAmount,
        interest_amount: calculated.interestAmount,
        total_amount: calculated.totalDue,
        paid_amount: paidAmountAfter,
        paid_at: report.paid_at,
        status: nextStatus,
      })
      .eq("id", report.monthly_fee_id);

    if (feeError) {
      setMessage(
        "O pagamento foi criado, mas houve erro ao atualizar a mensalidade: " +
          feeError.message
      );
      setProcessingId(null);
      return;
    }

    const { error: reportError } = await supabase
      .from("payment_reports")
      .update({
        status: "aprovado",
        review_notes:
          forms[report.id]?.review_notes?.trim() ||
          "Pagamento conferido e aprovado pela Tesouraria.",
        reviewed_by: profileId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (reportError) {
      setMessage(
        "A baixa foi realizada, mas houve erro ao atualizar o informe: " +
          reportError.message
      );
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadReports();
  }

  async function rejectReport(report: PaymentReport) {
    if (report.status !== "pendente") {
      setMessage("Este informe já foi analisado.");
      return;
    }

    const reviewNotes = forms[report.id]?.review_notes?.trim();

    if (!reviewNotes) {
      setMessage("Informe o motivo da rejeição antes de rejeitar o informe.");
      return;
    }

    setProcessingId(report.id);
    setMessage("");

    const supabase = createClient();
    const profileId = await getCurrentProfileId();

    const { error } = await supabase
      .from("payment_reports")
      .update({
        status: "rejeitado",
        review_notes: reviewNotes,
        reviewed_by: profileId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", report.id);

    if (error) {
      setMessage(error.message || "Não foi possível rejeitar o informe.");
      setProcessingId(null);
      return;
    }

    setProcessingId(null);
    await loadReports();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Tesouraria
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Informes de pagamento
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Analise os pagamentos informados pelos associados antes de realizar a baixa definitiva.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Pendentes</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.pending.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Valor pendente</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.pendingAmount)}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Aprovados</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.approved.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Rejeitados</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.rejected.length}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-xl font-black text-amber-900">
            Conferência obrigatória
          </h2>

          <p className="mt-3 leading-7 text-amber-900/80">
            O informe enviado pelo associado não quita automaticamente a mensalidade. Antes de aprovar, confira o extrato, comprovante, valor, data efetiva do pagamento e mês de referência.
          </p>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Informes recebidos
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Os informes pendentes podem ser aprovados ou rejeitados pela Tesouraria.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReports}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando informes...
            </div>
          ) : message ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {message}
            </div>
          ) : reports.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhum informe recebido
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Não há informes pendentes de análise no momento. Informes já aprovados ou rejeitados não ficam nesta tela de trabalho.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {reports.map((report) => {
                const associate = getAssociate(report);
                const fee = getMonthlyFee(report);
                const calculated = calculateAmountDueAtDate(report);

                return (
                  <article
                    key={report.id}
                    className="rounded-3xl border border-[#e8dccb] p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                          {getMonthLabel(report)}
                        </p>

                        <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                          {associate?.full_name ?? "Associado não localizado"}
                        </h3>

                        <p className="mt-1 text-sm font-bold text-[#596579]">
                          {associate?.email || "E-mail não informado"}
                          {associate?.phone ? ` · ${associate.phone}` : ""}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] ${getReportBadgeClass(report.status)}`}
                      >
                        {statusLabels[report.status] ?? report.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-3">
                      <p>
                        <strong>Valor informado:</strong>{" "}
                        {formatCurrency(report.amount)}
                      </p>

                      <p>
                        <strong>Data informada:</strong>{" "}
                        {formatDate(report.paid_at)}
                      </p>

                      <p>
                        <strong>Forma:</strong>{" "}
                        {paymentMethodLabels[report.payment_method] ??
                          report.payment_method}
                      </p>

                      <p>
                        <strong>Vencimento:</strong>{" "}
                        {fee ? formatDate(fee.due_date) : "Não informado"}
                      </p>

                      <p>
                        <strong>Valor devido na data:</strong>{" "}
                        {formatCurrency(calculated.remaining)}
                      </p>

                      <p>
                        <strong>Status da mensalidade:</strong>{" "}
                        {fee?.status ?? "Não informado"}
                      </p>

                      <p>
                        <strong>Multa:</strong>{" "}
                        {formatCurrency(calculated.lateFeeAmount)}
                      </p>

                      <p>
                        <strong>Juros:</strong>{" "}
                        {formatCurrency(calculated.interestAmount)}
                      </p>

                      <p>
                        <strong>Dias com encargos:</strong>{" "}
                        {calculated.daysWithCharges}
                      </p>
                    </div>

                    {report.reference && (
                      <p className="mt-4 rounded-2xl bg-[#f7f8fa] p-3 text-sm text-[#596579]">
                        <strong>Comprovante/Referência:</strong>{" "}
                        {report.reference}
                      </p>
                    )}

                    {report.notes && (
                      <p className="mt-3 rounded-2xl bg-[#f7f8fa] p-3 text-sm text-[#596579]">
                        <strong>Observação do associado:</strong> {report.notes}
                      </p>
                    )}

                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2">
                        <span className="text-sm font-bold text-[#13233a]">
                          Observação da Tesouraria
                        </span>

                        <textarea
                          rows={3}
                          value={forms[report.id]?.review_notes ?? ""}
                          disabled={report.status !== "pendente" || processingId === report.id}
                          onChange={(event) =>
                            updateReviewNotes(report.id, event.target.value)
                          }
                          placeholder="Informe observação, motivo da rejeição ou anotação da conferência."
                          className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none disabled:bg-slate-50"
                        />
                      </label>

                      {report.status === "pendente" && (
                        <div className="flex flex-col gap-3 md:flex-row">
                          <button
                            type="button"
                            onClick={() => approveReport(report)}
                            disabled={processingId === report.id}
                            className="rounded-full bg-green-700 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {processingId === report.id
                              ? "Processando..."
                              : "Aprovar e dar baixa"}
                          </button>

                          <button
                            type="button"
                            onClick={() => rejectReport(report)}
                            disabled={processingId === report.id}
                            className="rounded-full bg-red-700 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
