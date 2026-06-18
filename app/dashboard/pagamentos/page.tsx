"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { useDashboardPermissions } from "@/lib/useDashboardPermissions";
import { registerAuditLog } from "@/lib/audit";
import { calculateExtraContributionAmountDue } from "@/lib/extraContributionCharges";

type AssociateData = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

type FinancialSettingsData = {
  late_fee_grace_days: number;
};

type MonthlyFeeData = {
  id: string;
  year: number;
  month: number;
  base_amount: number;
  due_date: string;
  late_fee_percent: number;
  daily_interest_percent: number;
  paid_amount: number;
  status: string;
  financial_settings: FinancialSettingsData | FinancialSettingsData[] | null;
};

type ExtraContributionData = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  status: string;
  apply_late_charges: boolean;
  late_fee_percent: number;
  daily_interest_percent: number;
  late_fee_grace_days: number;
};

type ExtraContributionItemData = {
  id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  extra_contributions: ExtraContributionData | ExtraContributionData[] | null;
};

type PaymentReport = {
  id: string;
  associate_id: string;
  monthly_fee_id: string | null;
  extra_contribution_item_id: string | null;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
  associates: AssociateData | AssociateData[] | null;
  monthly_fees: MonthlyFeeData | MonthlyFeeData[] | null;
  extra_contribution_items:
    | ExtraContributionItemData
    | ExtraContributionItemData[]
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

const feeStatusLabels: Record<string, string> = {
  pendente: "Pendente",
  paga: "Paga",
  parcialmente_paga: "Parcialmente paga",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
  isenta: "Isenta",
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

function getExtraItem(report: PaymentReport) {
  if (Array.isArray(report.extra_contribution_items)) {
    return report.extra_contribution_items[0] ?? null;
  }

  return report.extra_contribution_items ?? null;
}

function getExtraContribution(item: ExtraContributionItemData | null) {
  if (!item) return null;

  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function getOriginType(report: PaymentReport) {
  if (report.extra_contribution_item_id) return "extra";
  return "monthly";
}

function getOriginLabel(report: PaymentReport) {
  const originType = getOriginType(report);

  if (originType === "extra") {
    const item = getExtraItem(report);
    const contribution = getExtraContribution(item);

    return contribution?.title ?? "Contribuição extra";
  }

  const fee = getMonthlyFee(report);

  if (!fee) return "Mensalidade não localizada";

  return `${monthNames[Number(fee.month) - 1]} de ${fee.year}`;
}

function getOriginBadge(report: PaymentReport) {
  if (getOriginType(report) === "extra") {
    return "Contribuição extra";
  }

  return "Mensalidade";
}

function getDueDate(report: PaymentReport) {
  if (getOriginType(report) === "extra") {
    return getExtraItem(report)?.due_date ?? null;
  }

  return getMonthlyFee(report)?.due_date ?? null;
}

function getCurrentStatus(report: PaymentReport) {
  if (getOriginType(report) === "extra") {
    return getExtraItem(report)?.status ?? "Não informado";
  }

  return getMonthlyFee(report)?.status ?? "Não informado";
}

function getGraceDays(report: PaymentReport) {
  const fee = getMonthlyFee(report);

  if (!fee) return 0;

  if (Array.isArray(fee.financial_settings)) {
    return Number(fee.financial_settings[0]?.late_fee_grace_days ?? 0);
  }

  return Number(fee.financial_settings?.late_fee_grace_days ?? 0);
}

function calculateMonthlyAmountDueAtDate(report: PaymentReport) {
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

function calculateExtraAmountDue(report: PaymentReport) {
  return calculateExtraContributionAmountDue(getExtraItem(report), report.paid_at);
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
  const permissions = useDashboardPermissions("pagamentos");
  const [reports, setReports] = useState<PaymentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [forms, setForms] = useState<Record<string, ReviewForm>>({});

  const summary = useMemo(() => {
    const pending = reports.filter((report) => report.status === "pendente");

    const pendingAmount = pending.reduce(
      (sum, report) => sum + Number(report.amount ?? 0),
      0
    );

    return {
      pending,
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
        "id, associate_id, monthly_fee_id, extra_contribution_item_id, amount, paid_at, payment_method, reference, notes, status, review_notes, created_at, associates(full_name, email, phone), monthly_fees(id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, paid_amount, status, financial_settings(late_fee_grace_days)), extra_contribution_items(id, amount, paid_amount, due_date, status, extra_contributions(id, title, description, reason, status, apply_late_charges, late_fee_percent, daily_interest_percent, late_fee_grace_days))"
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

  async function markReportAsApproved(report: PaymentReport, profileId: string | null) {
    const supabase = createClient();

    return supabase
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
  }

async function approveMonthlyReport(report: PaymentReport) {
  const fee = getMonthlyFee(report);

  if (!fee) {
    setMessage("Mensalidade vinculada ao informe não foi localizada.");
    return false;
  }

  const supabase = createClient();
  const profileId = await getCurrentProfileId();

  const calculated = calculateMonthlyAmountDueAtDate(report);
  const paidAmountBefore = Number(fee.paid_amount ?? 0);
  const reportAmount = Number(report.amount ?? 0);
  const paidAmountAfter = Number((paidAmountBefore + reportAmount).toFixed(2));

  const nextStatus =
    paidAmountAfter >= calculated.totalDue ? "paga" : "parcialmente_paga";

  const { error: paymentError } = await supabase.from("payments").insert({
    associate_id: report.associate_id,
    monthly_fee_id: report.monthly_fee_id,
    extra_contribution_item_id: null,
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
    return false;
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
    return false;
  }

  const { error: reportError } = await markReportAsApproved(report, profileId);

  if (reportError) {
    setMessage(
      "A baixa foi realizada, mas houve erro ao atualizar o informe: " +
        reportError.message
    );
    return false;
  }

  return true;
}

async function approveExtraReport(report: PaymentReport) {
  const item = getExtraItem(report);

  if (!item) {
    setMessage("Contribuição extra vinculada ao informe não foi localizada.");
    return false;
  }

  const supabase = createClient();
  const profileId = await getCurrentProfileId();

  const calculated = calculateExtraAmountDue(report);
  const reportAmount = Number(report.amount ?? 0);
  const paidAmountBefore = Number(item.paid_amount ?? 0);
  const paidAmountAfter = Number((paidAmountBefore + reportAmount).toFixed(2));
  const totalDue = Number(calculated.totalDue ?? item.amount ?? 0);

  const nextStatus =
    paidAmountAfter >= totalDue ? "paga" : "parcialmente_paga";

  const { error: paymentError } = await supabase.from("payments").insert({
    associate_id: report.associate_id,
    monthly_fee_id: null,
    extra_contribution_item_id: report.extra_contribution_item_id,
    amount: reportAmount,
    paid_at: report.paid_at,
    payment_method: report.payment_method,
    reference: report.reference,
    notes:
      forms[report.id]?.review_notes?.trim() ||
      report.notes ||
      "Baixa realizada a partir de informe de pagamento de contribuição extra.",
  });

  if (paymentError) {
    setMessage(paymentError.message || "Não foi possível registrar o pagamento.");
    return false;
  }

  const { error: itemError } = await supabase
    .from("extra_contribution_items")
    .update({
      paid_amount: paidAmountAfter,
      status: nextStatus,
    })
    .eq("id", report.extra_contribution_item_id);

  if (itemError) {
    setMessage(
      "O pagamento foi criado, mas houve erro ao atualizar a contribuição extra: " +
        itemError.message
    );
    return false;
  }

  const { error: reportError } = await markReportAsApproved(report, profileId);

  if (reportError) {
    setMessage(
      "A baixa foi realizada, mas houve erro ao atualizar o informe: " +
        reportError.message
    );
    return false;
  }

  return true;
}

  async function approveReport(report: PaymentReport) {
  if (!permissions.canApprove) {
    setMessage("Seu perfil não tem permissão para aprovar informes de pagamento.");
    return;
  }

  if (report.status !== "pendente") {
    setMessage("Este informe já foi analisado.");
    return;
  }

  setProcessingId(report.id);
  setMessage("");

  const approved =
    getOriginType(report) === "extra"
      ? await approveExtraReport(report)
      : await approveMonthlyReport(report);

  if (approved) {
    const supabase = createClient();
    const associate = getAssociate(report);

    await registerAuditLog({
      supabase,
      action: "approve_payment_report",
      module: "informes_pagamento",
      tableName: "payment_reports",
      recordId: report.id,
      description: `Aprovou informe de pagamento de ${
        associate?.full_name || associate?.email || "associado não identificado"
      }.`,
      oldData: {
        status: report.status,
        review_notes: report.review_notes,
        amount: report.amount,
        paid_at: report.paid_at,
        origin_type: getOriginType(report),
        origin_label: getOriginLabel(report),
      },
      newData: {
        status: "aprovado",
        review_notes:
          forms[report.id]?.review_notes?.trim() ||
          "Pagamento conferido e aprovado pela Tesouraria.",
        amount: report.amount,
        paid_at: report.paid_at,
        payment_method: report.payment_method,
        reference: report.reference,
        origin_type: getOriginType(report),
        origin_label: getOriginLabel(report),
      },
    });
  }

  setProcessingId(null);
  await loadReports();
  }

  async function rejectReport(report: PaymentReport) {
    if (!permissions.canApprove) {
      setMessage("Seu perfil não tem permissão para rejeitar informes de pagamento.");
      return;
    }

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

const associate = getAssociate(report);

await registerAuditLog({
  supabase,
  action: "reject_payment_report",
  module: "informes_pagamento",
  tableName: "payment_reports",
  recordId: report.id,
  description: `Rejeitou informe de pagamento de ${
    associate?.full_name || associate?.email || "associado não identificado"
  }.`,
  oldData: {
    status: report.status,
    review_notes: report.review_notes,
    amount: report.amount,
    paid_at: report.paid_at,
    origin_type: getOriginType(report),
    origin_label: getOriginLabel(report),
  },
  newData: {
    status: "rejeitado",
    review_notes: reviewNotes,
    amount: report.amount,
    paid_at: report.paid_at,
    payment_method: report.payment_method,
    reference: report.reference,
    origin_type: getOriginType(report),
    origin_label: getOriginLabel(report),
  },
});

setProcessingId(null);
await loadReports();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Pagamentos informados
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Informes de Pagamento
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Analise os informes enviados pelos associados e aprove somente após conferência da Tesouraria.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Pendentes</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
              {summary.pending.length}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Valor pendente</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
              {formatCurrency(summary.pendingAmount)}
            </p>
          </div>
        </section>

        <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          <p>
            Conferência: antes de aprovar, verifique extrato, comprovante, valor, data efetiva e referência.
          </p>

          {permissions.isReadOnly && !permissions.loadingPermissions && (
            <p className="mt-1 text-amber-700">
              Seu perfil pode consultar os informes, mas não pode aprovar ou rejeitar pagamentos.
            </p>
          )}
        </div>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Informes recebidos
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Conferência e baixa dos informes pendentes.
              </p>
            </div>

            <button
              type="button"
              onClick={loadReports}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando informes...
            </div>
          ) : message ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {message}
            </div>
          ) : reports.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhum informe pendente
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                Não há informes pendentes de análise no momento. Informes já aprovados ou rejeitados não ficam nesta tela de trabalho.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              <div className="grid gap-3">
                {reports.map((report) => {
                  const associate = getAssociate(report);
                  const originType = getOriginType(report);
                  const monthlyCalculated = calculateMonthlyAmountDueAtDate(report);
                  const extraCalculated = calculateExtraAmountDue(report);
                  const amountDue =
                    originType === "extra"
                      ? extraCalculated.remaining
                      : monthlyCalculated.remaining;

                  return (
                    <article
                      key={report.id}
                      className="rounded-xl border border-[#e8dccb] bg-white p-3 text-sm shadow-sm xl:grid xl:grid-cols-[1.15fr_1.05fr_0.95fr_0.95fr_minmax(190px,1.2fr)_92px] xl:items-start xl:gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-[#13233a]">
                          {associate?.full_name ?? "Associado não localizado"}
                        </p>

                        <p className="mt-0.5 break-words text-[11px] font-bold text-[#596579]">
                          {associate?.email || "E-mail não informado"}
                        </p>

                        {associate?.phone && (
                          <p className="mt-0.5 break-words text-[11px] font-bold text-[#596579]">
                            {associate.phone}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-[#b28743]">
                          {getOriginLabel(report)}
                        </p>

                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                            {getOriginBadge(report)}
                          </span>

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${getReportBadgeClass(report.status)}`}
                          >
                            {statusLabels[report.status] ?? report.status}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 font-bold text-[#596579]">
                        <p className="font-black text-[#13233a]">
                          {formatCurrency(report.amount)}
                        </p>

                        <p className="text-xs">
                          Data: {formatDate(report.paid_at)}
                        </p>

                        <p className="text-xs">
                          Forma:{" "}
                          {paymentMethodLabels[report.payment_method] ??
                            report.payment_method}
                        </p>

                        <p className="text-xs">
                          Ref.: {report.reference || "Não informada"}
                        </p>
                      </div>

                      <div className="min-w-0 font-bold text-[#596579]">
                        <p>Venc.: {formatDate(getDueDate(report))}</p>

                        <p className="text-xs">
                          Devido: {formatCurrency(amountDue)}
                        </p>

                        <p className="text-xs">
                          Status:{" "}
                          {feeStatusLabels[getCurrentStatus(report)] ??
                            getCurrentStatus(report)}
                        </p>

                        {originType === "monthly" && (
                          <p className="text-xs">
                            Multa: {formatCurrency(monthlyCalculated.lateFeeAmount)} · Juros:{" "}
                            {formatCurrency(monthlyCalculated.interestAmount)} · Dias:{" "}
                            {monthlyCalculated.daysWithCharges}
                          </p>
                        )}
                      </div>

                      <div className="min-w-0 space-y-2">
                        {report.notes && (
                          <p className="overflow-hidden rounded-lg bg-[#f7f8fa] px-3 py-2 text-[11px] font-bold leading-5 text-[#596579] [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                            Associado: {report.notes}
                          </p>
                        )}

                        <label className="grid gap-1">
                          <span className="text-xs font-black text-[#13233a]">
                            Observação da Tesouraria
                          </span>

                          <textarea
                            rows={2}
                            value={forms[report.id]?.review_notes ?? ""}
                            disabled={
                              report.status !== "pendente" ||
                              processingId === report.id ||
                              permissions.loadingPermissions ||
                              !permissions.canApprove
                            }
                            onChange={(event) =>
                              updateReviewNotes(report.id, event.target.value)
                            }
                            placeholder="Anotação ou motivo da rejeição."
                            className="w-full resize-none rounded-lg border border-[#e8dccb] px-3 py-2 text-xs font-bold text-[#13233a] outline-none disabled:bg-slate-50"
                          />
                        </label>
                      </div>

                      <div className="flex flex-row flex-wrap gap-2 xl:flex-col xl:items-end">
                        {report.status === "pendente" && (
                          <>
                            <button
                              type="button"
                              onClick={() => approveReport(report)}
                              disabled={
                                processingId === report.id ||
                                permissions.loadingPermissions ||
                                !permissions.canApprove
                              }
                              className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50 xl:w-[82px]"
                            >
                              {processingId === report.id
                                ? "Processando..."
                                : permissions.canApprove
                                  ? "Aprovar"
                                  : "Somente leitura"}
                            </button>

                            <button
                              type="button"
                              onClick={() => rejectReport(report)}
                              disabled={
                                processingId === report.id ||
                                permissions.loadingPermissions ||
                                !permissions.canApprove
                              }
                              className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 xl:w-[82px]"
                            >
                              Rejeitar
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
