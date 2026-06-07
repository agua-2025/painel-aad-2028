"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
  financial_status: string | null;
};

type MonthlyFee = {
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
};

type ExtraContributionItem = {
  id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  extra_contributions:
    | {
        title: string;
      }
    | {
        title: string;
      }[]
    | null;
};

type Payment = {
  id: string;
  amount: number;
  paid_at: string;
  monthly_fee_id: string | null;
  extra_contribution_item_id: string | null;
  monthly_fees:
    | {
        year: number;
        month: number;
      }
    | {
        year: number;
        month: number;
      }[]
    | null;
  extra_contribution_items:
    | {
        extra_contributions:
          | {
              title: string;
            }
          | {
              title: string;
            }[]
          | null;
      }
    | {
        extra_contributions:
          | {
              title: string;
            }
          | {
              title: string;
            }[]
          | null;
      }[]
    | null;
};

type PaymentReport = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

const quickQuestions = [
  "Quantas mensalidades eu estou devendo?",
  "Qual meu total em aberto?",
  "Tenho contribuição extra pendente?",
  "Meu pagamento já foi aprovado?",
  "Tenho informe pendente?",
  "Como informo um pagamento?",
  "Onde consulto o Estatuto Social?",
  "Quais são meus deveres como associado?",
  "Quem é a presidente da Associação?",
];

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

function formatCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "data não informada";

  const dateOnly = value.includes("T") ? value : value + "T00:00:00";
  const date = new Date(dateOnly);

  if (Number.isNaN(date.getTime())) {
    return "data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function getGraceDays(fee: MonthlyFee) {
  if (Array.isArray(fee.financial_settings)) {
    return Number(fee.financial_settings[0]?.late_fee_grace_days ?? 0);
  }

  return Number(fee.financial_settings?.late_fee_grace_days ?? 0);
}

function calculateAmountDueAtDate(fee: MonthlyFee, referenceDateValue: string) {
  const baseAmount = Number(fee.base_amount ?? 0);
  const dueDate = new Date(fee.due_date + "T00:00:00");
  const referenceDate = new Date(referenceDateValue + "T00:00:00");

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(referenceDate.getTime())) {
    return {
      daysWithCharges: 0,
      totalDue: baseAmount,
    };
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysAfterDue = Math.floor(
    (referenceDate.getTime() - dueDate.getTime()) / millisecondsPerDay
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

  return {
    daysWithCharges,
    totalDue: Number((baseAmount + lateFeeAmount + interestAmount).toFixed(2)),
  };
}

function isOpenFee(fee: MonthlyFee) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(fee.status);
}

function isOpenExtraItem(item: ExtraContributionItem) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(item.status);
}

function getExtraTitle(item: ExtraContributionItem) {
  const contribution = Array.isArray(item.extra_contributions)
    ? item.extra_contributions[0]
    : item.extra_contributions;

  return contribution?.title ?? "Contribuição extra";
}

function getMonthlyFee(payment: Payment) {
  if (Array.isArray(payment.monthly_fees)) {
    return payment.monthly_fees[0] ?? null;
  }

  return payment.monthly_fees ?? null;
}

function getExtraItem(payment: Payment) {
  if (Array.isArray(payment.extra_contribution_items)) {
    return payment.extra_contribution_items[0] ?? null;
  }

  return payment.extra_contribution_items ?? null;
}

function getExtraContributionFromPayment(payment: Payment) {
  const item = getExtraItem(payment);

  if (!item) return null;

  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function getPaymentLabel(payment: Payment) {
  if (payment.extra_contribution_item_id) {
    return getExtraContributionFromPayment(payment)?.title ?? "Contribuição extra";
  }

  const fee = getMonthlyFee(payment);

  if (!fee) return "Mensalidade";

  return `Mensalidade de ${monthNames[Number(fee.month) - 1]} de ${fee.year}`;
}

export default function AreaAssistentePage() {
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraContributionItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentReports, setPaymentReports] = useState<PaymentReport[]>([]);
  const [financialLoading, setFinancialLoading] = useState(true);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const memberContext = useMemo(() => {
    const openMonthlyFees = monthlyFees
      .filter(isOpenFee)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });

    const openMonthlyFeesTotal = openMonthlyFees.reduce((sum, fee) => {
      const calculated = calculateAmountDueAtDate(fee, today);
      const remaining = Math.max(
        calculated.totalDue - Number(fee.paid_amount ?? 0),
        0
      );

      return sum + remaining;
    }, 0);

    const overdueMonthlyFees = openMonthlyFees.filter((fee) => {
      const calculated = calculateAmountDueAtDate(fee, today);
      return calculated.daysWithCharges > 0;
    });

    const openExtraContributions = extraItems
      .filter(isOpenExtraItem)
      .sort((a, b) => {
        const dateA = new Date(a.due_date + "T00:00:00").getTime();
        const dateB = new Date(b.due_date + "T00:00:00").getTime();

        return dateA - dateB;
      });

    const openExtraContributionsTotal = openExtraContributions.reduce(
      (sum, item) =>
        sum +
        Math.max(Number(item.amount ?? 0) - Number(item.paid_amount ?? 0), 0),
      0
    );

    const totalPaid = payments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    return {
      associateName: associate?.full_name,
      financialStatus: associate?.financial_status,
      openMonthlyFeesCount: openMonthlyFees.length,
      openMonthlyFeesTotal,
      overdueMonthlyFeesCount: overdueMonthlyFees.length,
      openMonthlyFees: openMonthlyFees.slice(0, 6).map((fee) => {
        const calculated = calculateAmountDueAtDate(fee, today);
        const remaining = Math.max(
          calculated.totalDue - Number(fee.paid_amount ?? 0),
          0
        );

        return `${monthNames[Number(fee.month) - 1]} de ${fee.year}, vencimento ${formatDate(
          fee.due_date
        )}, saldo ${formatCurrency(remaining)}, status ${fee.status}`;
      }),
      openExtraContributionsCount: openExtraContributions.length,
      openExtraContributionsTotal,
      openExtraContributions: openExtraContributions.slice(0, 6).map((item) => {
        const remaining = Math.max(
          Number(item.amount ?? 0) - Number(item.paid_amount ?? 0),
          0
        );

        return `${getExtraTitle(item)}, vencimento ${formatDate(
          item.due_date
        )}, saldo ${formatCurrency(remaining)}, status ${item.status}`;
      }),
      totalPaid,
      lastPayments: payments.slice(0, 5).map(
        (payment) =>
          `${getPaymentLabel(payment)}, pago em ${formatDate(
            payment.paid_at
          )}, valor ${formatCurrency(payment.amount)}`
      ),
      pendingPaymentReportsCount: paymentReports.filter(
        (report) => report.status === "pendente"
      ).length,
      approvedPaymentReportsCount: paymentReports.filter(
        (report) => ["aprovado", "aprovada"].includes(report.status)
      ).length,
      rejectedPaymentReportsCount: paymentReports.filter(
        (report) => ["rejeitado", "rejeitada"].includes(report.status)
      ).length,
      lastPaymentReports: paymentReports.slice(0, 6).map(
        (report) =>
          `Informe enviado em ${formatDate(report.created_at)}, valor ${formatCurrency(
            report.amount
          )}, status ${report.status}`
      ),
    };
  }, [associate, monthlyFees, extraItems, payments, paymentReports, today]);

  useEffect(() => {
    async function loadFinancialContext() {
      setFinancialLoading(true);

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: approvedRequest } = await supabase
        .from("membership_requests")
        .select("id, profile_id, email, cpf, status")
        .or(`email.eq.${user.email}${profile?.id ? `,profile_id.eq.${profile.id}` : ""}`)
        .eq("status", "aprovada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const associateFilter = approvedRequest?.cpf
        ? `email.eq.${user.email},cpf.eq.${approvedRequest.cpf}`
        : `email.eq.${user.email}`;

      const { data: associateData, error: associateError } = await supabase
        .from("associates")
        .select("id, full_name, email, status, financial_status")
        .or(associateFilter)
        .maybeSingle();

      if (associateError || !associateData || associateData.status !== "ativo") {
        setAssociate(null);
        setMonthlyFees([]);
        setExtraItems([]);
        setPayments([]);
        setPaymentReports([]);
        setFinancialLoading(false);
        return;
      }

      setAssociate(associateData);

      const { data: feesData } = await supabase
        .from("monthly_fees")
        .select(
          "id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, paid_amount, status, financial_settings(late_fee_grace_days)"
        )
        .eq("associate_id", associateData.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      const { data: extraData } = await supabase
        .from("extra_contribution_items")
        .select(
          "id, amount, paid_amount, due_date, status, extra_contributions(title)"
        )
        .eq("associate_id", associateData.id)
        .order("due_date", { ascending: true });

      const { data: paymentsData } = await supabase
        .from("payments")
        .select(
          "id, amount, paid_at, monthly_fee_id, extra_contribution_item_id, monthly_fees(year, month), extra_contribution_items(extra_contributions(title))"
        )
        .eq("associate_id", associateData.id)
        .order("paid_at", { ascending: false })
        .limit(10);

      const { data: reportsData, error: reportsError } = await supabase
        .from("payment_reports")
        .select("id, amount, status, created_at")
        .eq("associate_id", associateData.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (reportsError) {
        console.warn("Não foi possível carregar informes do associado:", reportsError);
      }

      setMonthlyFees((feesData as unknown as MonthlyFee[]) ?? []);
      setExtraItems((extraData as unknown as ExtraContributionItem[]) ?? []);
      setPayments((paymentsData as unknown as Payment[]) ?? []);
      setPaymentReports((reportsData as unknown as PaymentReport[]) ?? []);
      setFinancialLoading(false);
    }

    loadFinancialContext();
  }, []);

  async function askAssistant(selectedQuestion?: string) {
    const finalQuestion = (selectedQuestion || question).trim();

    if (!finalQuestion) {
      setMessage("Digite uma pergunta para o assistente.");
      return;
    }

    setLoading(true);
    setMessage("");
    setAnswer("");

    try {
      const response = await fetch("/api/ia/assistente-sistema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: finalQuestion,
          userProfile: "associado",
          allowedModules: [
            "area",
            "solicitacao",
            "dados",
            "documentos",
            "avisos",
            "suporte",
            "pagamentos",
            "financeiro",
            "contribuicoes_extras",
          ],
          memberContext: associate ? memberContext : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Não foi possível consultar o assistente.");
        return;
      }

      setAnswer(data.answer || "");
      setQuestion(finalQuestion);
    } catch (error) {
      console.error("Erro ao consultar assistente do associado:", error);
      setMessage("Não foi possível conectar ao assistente no momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a98246]">
                Inteligência Artificial
              </p>

              <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Assistente do Associado
              </h1>

              <p className="mt-1 text-sm font-medium leading-6 text-[#596579]">
                Tire dúvidas sobre sua área, pagamentos, documentos, Estatuto, Ata e solicitação.
              </p>

              {financialLoading && (
                <p className="mt-2 text-xs font-bold text-[#a98246]">
                  Carregando seu contexto financeiro...
                </p>
              )}
            </div>

            <img
              src="/brand/aad-login-logo.png"
              alt="AAD Direito 2028"
              className="hidden h-auto max-h-[38px] w-auto max-w-[220px] object-contain md:block"
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
              Faça uma pergunta
            </h2>

            <p className="mt-1 text-xs font-medium leading-5 text-[#596579]">
              Pergunte sobre sua solicitação, financeiro, documentos ou regras da Associação.
            </p>

            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={2}
              placeholder=""
              className="mt-3 w-full resize-none rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-semibold leading-5 text-[#13233a] outline-none transition focus:border-[#c7a56b]"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => askAssistant()}
                disabled={loading || financialLoading}
                className="rounded-full bg-[#13233a] px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Consultando..." : "Perguntar à IA"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuestion("");
                  setAnswer("");
                  setMessage("");
                }}
                className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] transition hover:bg-[#f7f8fa]"
              >
                Limpar
              </button>
            </div>

            {message && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold leading-5 text-red-700">
                {message}
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a98246]">
                Resposta do assistente
              </p>

              {answer ? (
                <div className="mt-2 max-h-[420px] overflow-y-auto pr-2 text-sm font-medium leading-6 text-[#13233a]">
                  <div className="whitespace-pre-line">{answer}</div>
                </div>
              ) : (
                <div className="mt-2 flex min-h-[180px] items-center justify-center rounded-xl bg-white px-4 py-4 text-center text-sm font-medium leading-6 text-[#596579]">
                  A resposta aparecerá aqui.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
              Perguntas rápidas
            </h2>

            <p className="mt-1 text-xs font-medium leading-5 text-[#596579]">
              Clique em uma pergunta para testar.
            </p>

            <div className="mt-3 grid gap-2">
              {quickQuestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => askAssistant(item)}
                  disabled={loading || financialLoading}
                  className="rounded-xl border border-[#e8dccb] bg-[#f8fafc] px-3 py-2 text-left text-sm font-bold leading-5 text-[#13233a] transition hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-xl bg-[#13233a] px-3 py-2 text-xs font-medium leading-5 text-white/80">
              <p className="font-black text-white">Dica</p>
              <p className="mt-0.5">
                Agora o assistente considera seus dados financeiros cadastrados no sistema.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ProtectedArea>
  );
}
