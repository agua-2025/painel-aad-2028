"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

type MonthlyFee = {
  id: string;
  associate_id: string;
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
};

type PaymentReport = {
  id: string;
  status: string;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  review_notes: string | null;
  created_at: string;
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

const paymentMethodLabels = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "deposito", label: "Depósito" },
  { value: "cartao", label: "Cartão" },
  { value: "outros", label: "Outros" },
];

const statusLabels: Record<string, string> = {
  pendente: "Pendente de análise",
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

function getMonthLabel(fee: MonthlyFee) {
  return `${monthNames[Number(fee.month) - 1]} de ${fee.year}`;
}

function getGraceDays(fee: MonthlyFee) {
  if (Array.isArray(fee.financial_settings)) {
    return Number(fee.financial_settings[0]?.late_fee_grace_days ?? 0);
  }

  return Number(fee.financial_settings?.late_fee_grace_days ?? 0);
}

function calculateAmountDueAtDate(fee: MonthlyFee, paymentDateValue: string) {
  const baseAmount = Number(fee.base_amount ?? 0);
  const dueDate = new Date(fee.due_date + "T00:00:00");
  const paymentDate = new Date(paymentDateValue + "T00:00:00");

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    return {
      daysWithCharges: 0,
      lateFeeAmount: 0,
      interestAmount: 0,
      totalDue: baseAmount,
    };
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysAfterDue = Math.floor(
    (paymentDate.getTime() - dueDate.getTime()) / millisecondsPerDay
  );

  const graceDays = getGraceDays(fee);
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

  return {
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
  };
}

function isOpenFee(status: string) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(status);
}

export default function InformarPagamentoPage() {
  const params = useParams<{ id: string }>();
  const feeId = params.id;

  const today = new Date().toISOString().slice(0, 10);

  const [associate, setAssociate] = useState<Associate | null>(null);
  const [fee, setFee] = useState<MonthlyFee | null>(null);
  const [reports, setReports] = useState<PaymentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    amount: "",
    paid_at: today,
    payment_method: "pix",
    reference: "",
    notes: "",
  });

  const calculated = useMemo(() => {
    if (!fee) {
      return {
        daysWithCharges: 0,
        lateFeeAmount: 0,
        interestAmount: 0,
        totalDue: 0,
        remaining: 0,
      };
    }

    const amountDue = calculateAmountDueAtDate(fee, form.paid_at || today);
    const remaining = Math.max(
      amountDue.totalDue - Number(fee.paid_amount ?? 0),
      0
    );

    return {
      ...amountDue,
      remaining,
    };
  }, [fee, form.paid_at, today]);

  const pendingReport = reports.find((report) => report.status === "pendente");

  async function loadData() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/login";
      return;
    }

    const { data: associateData, error: associateError } = await supabase
      .from("associates")
      .select("id, full_name, email, status")
      .eq("email", user.email)
      .maybeSingle();

    if (associateError || !associateData || associateData.status !== "ativo") {
      setMessage("Não foi possível localizar seu cadastro de associado ativo.");
      setLoading(false);
      return;
    }

    setAssociate(associateData);

    const { data: feeData, error: feeError } = await supabase
      .from("monthly_fees")
      .select(
        "id, associate_id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, paid_amount, status, financial_settings(late_fee_grace_days)"
      )
      .eq("id", feeId)
      .eq("associate_id", associateData.id)
      .maybeSingle();

    if (feeError || !feeData) {
      setMessage("Mensalidade não localizada para este associado.");
      setLoading(false);
      return;
    }

    const typedFee = feeData as unknown as MonthlyFee;
    setFee(typedFee);

    const amountDue = calculateAmountDueAtDate(typedFee, today);
    const remaining = Math.max(
      amountDue.totalDue - Number(typedFee.paid_amount ?? 0),
      0
    );

    setForm((previous) => ({
      ...previous,
      amount: remaining.toFixed(2),
    }));

    const { data: reportsData, error: reportsError } = await supabase
      .from("payment_reports")
      .select(
        "id, status, amount, paid_at, payment_method, reference, notes, review_notes, created_at"
      )
      .eq("monthly_fee_id", feeId)
      .eq("associate_id", associateData.id)
      .order("created_at", { ascending: false });

    if (reportsError) {
      setMessage("Não foi possível carregar os informes desta mensalidade.");
      setLoading(false);
      return;
    }

    setReports((reportsData as unknown as PaymentReport[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!associate || !fee) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const amount = Number(String(form.amount).replace(",", "."));

    if (!amount || amount <= 0) {
      setMessage("Informe um valor válido para o pagamento.");
      setSaving(false);
      return;
    }

    if (!form.paid_at) {
      setMessage("Informe a data efetiva do pagamento.");
      setSaving(false);
      return;
    }

    if (!isOpenFee(fee.status)) {
      setMessage("Esta mensalidade não está aberta para informe de pagamento.");
      setSaving(false);
      return;
    }

    if (pendingReport) {
      setMessage("Já existe um informe pendente de análise para esta mensalidade.");
      setSaving(false);
      return;
    }

    const supabase = createClient();

    const { error } = await supabase.from("payment_reports").insert({
      associate_id: associate.id,
      monthly_fee_id: fee.id,
      amount,
      paid_at: form.paid_at,
      payment_method: form.payment_method,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      status: "pendente",
    });

    if (error) {
      setMessage(error.message || "Não foi possível enviar o informe de pagamento.");
      setSaving(false);
      return;
    }

    setSuccessMessage(
      "Informe de pagamento enviado com sucesso. A Tesouraria fará a conferência antes da baixa."
    );

    setSaving(false);
    await loadData();
  }

  return (
    <ProtectedArea>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Informar pagamento
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Informe à Tesouraria que você realizou o pagamento de uma mensalidade específica.
          </p>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando mensalidade...</p>
          </div>
        ) : message && !fee ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>

            <Link
              href="/area/financeiro"
              className="mt-4 inline-flex rounded-full bg-[#13233a] px-5 py-2 text-sm font-black text-white"
            >
              Voltar ao financeiro
            </Link>
          </div>
        ) : fee ? (
          <>
            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                {getMonthLabel(fee)}
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                {associate?.full_name}
              </h2>

              <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-2">
                <p>
                  <strong>Vencimento:</strong> {formatDate(fee.due_date)}
                </p>

                <p>
                  <strong>Status:</strong> {fee.status}
                </p>

                <p>
                  <strong>Valor base:</strong> {formatCurrency(fee.base_amount)}
                </p>

                <p>
                  <strong>Valor já pago:</strong> {formatCurrency(fee.paid_amount)}
                </p>

                <p>
                  <strong>Multa na data informada:</strong>{" "}
                  {formatCurrency(calculated.lateFeeAmount)}
                </p>

                <p>
                  <strong>Juros na data informada:</strong>{" "}
                  {formatCurrency(calculated.interestAmount)}
                </p>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f7f8fa] p-4">
                <p className="text-sm font-bold text-[#596579]">
                  Saldo estimado na data informada
                </p>

                <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
                  {formatCurrency(calculated.remaining)}
                </p>

                <p className="mt-2 text-sm leading-6 text-[#596579]">
                  O valor será conferido pela Tesouraria antes da baixa definitiva.
                </p>
              </div>
            </section>

            {pendingReport && (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                <h2 className="text-xl font-black text-amber-900">
                  Já existe informe pendente
                </h2>

                <p className="mt-3 leading-7 text-amber-900/80">
                  Você já informou um pagamento para esta mensalidade. Aguarde a análise da Tesouraria antes de enviar outro informe.
                </p>
              </section>
            )}

            {successMessage && (
              <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
                <p className="font-bold text-green-800">{successMessage}</p>
              </section>
            )}

            {message && (
              <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
                <p className="font-bold text-red-700">{message}</p>
              </section>
            )}

            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Dados do pagamento
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#596579]">
                Preencha com os dados do pagamento realizado. Este envio não quita automaticamente a mensalidade; a baixa depende de conferência da Tesouraria.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#13233a]">
                      Valor pago
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount}
                      disabled={!!pendingReport || saving}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          amount: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#13233a]">
                      Data do pagamento
                    </span>

                    <input
                      type="date"
                      value={form.paid_at}
                      disabled={!!pendingReport || saving}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          paid_at: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#13233a]">
                      Forma
                    </span>

                    <select
                      value={form.payment_method}
                      disabled={!!pendingReport || saving}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          payment_method: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                    >
                      {paymentMethodLabels.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Comprovante/Referência
                  </span>

                  <input
                    type="text"
                    value={form.reference}
                    disabled={!!pendingReport || saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Ex.: ID do Pix, nome usado no Pix, número do comprovante..."
                    className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Observações
                  </span>

                  <textarea
                    value={form.notes}
                    disabled={!!pendingReport || saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Ex.: pagamento feito por terceiro, valor complementar, observação sobre o comprovante..."
                    className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>

                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="submit"
                    disabled={!!pendingReport || saving || !isOpenFee(fee.status)}
                    className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Enviando..." : "Enviar informe"}
                  </button>

                  <Link
                    href="/area/financeiro"
                    className="rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#13233a]"
                  >
                    Voltar
                  </Link>
                </div>
              </form>
            </section>

            {reports.length > 0 && (
              <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                  Informes enviados
                </h2>

                <div className="mt-5 grid gap-3">
                  {reports.map((report) => (
                    <article
                      key={report.id}
                      className="rounded-2xl border border-[#e8dccb] p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-black text-[#13233a]">
                            {formatCurrency(report.amount)} em{" "}
                            {formatDate(report.paid_at)}
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#596579]">
                            {paymentMethodLabels.find(
                              (method) => method.value === report.payment_method
                            )?.label ?? report.payment_method}
                          </p>
                        </div>

                        <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                          {statusLabels[report.status] ?? report.status}
                        </span>
                      </div>

                      {report.reference && (
                        <p className="mt-3 text-sm text-[#596579]">
                          <strong>Referência:</strong> {report.reference}
                        </p>
                      )}

                      {report.review_notes && (
                        <p className="mt-3 rounded-2xl bg-[#f7f8fa] p-3 text-sm text-[#596579]">
                          <strong>Observação da Tesouraria:</strong>{" "}
                          {report.review_notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </ProtectedArea>
  );
}
