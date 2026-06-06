"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type AssociateData = {
  full_name: string;
  email: string | null;
};

type MonthlyFeeData = {
  year: number;
  month: number;
};

type ExtraContributionData = {
  title: string;
};

type ExtraContributionItemData = {
  extra_contributions: ExtraContributionData | ExtraContributionData[] | null;
};

type Payment = {
  id: string;
  associate_id: string;
  monthly_fee_id: string | null;
  extra_contribution_item_id: string | null;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  associates: AssociateData | AssociateData[] | null;
  monthly_fees: MonthlyFeeData | MonthlyFeeData[] | null;
  extra_contribution_items: ExtraContributionItemData | ExtraContributionItemData[] | null;
};

type OtherRevenue = {
  id: string;
  received_at: string;
  amount: number;
  category: string;
  payer_name: string | null;
  description: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type Expense = {
  id: string;
  expense_date: string;
  due_date: string | null;
  paid_at: string | null;
  amount: number;
  category: string;
  payee_name: string | null;
  description: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  receipt_path: string | null;
  receipt_filename: string | null;
  created_at: string;
};

type CashMonthlyBalance = {
  id: string;
  month_ref: string;
  opening_balance: number;
  notes: string | null;
};

type Movement = {
  id: string;
  date: string;
  type: "entrada" | "saida";
  origin: string;
  description: string;
  person: string;
  method: string | null;
  reference: string | null;
  amount: number;
  hasReceipt?: boolean;
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

const revenueCategoryLabels: Record<string, string> = {
  doacao: "Doação espontânea",
  patrocinio: "Patrocínio",
  rifa: "Rifa",
  evento: "Evento",
  venda: "Venda",
  rendimento: "Rendimento bancário",
  reembolso: "Reembolso",
  ajuste: "Ajuste",
  outros: "Outros",
};

const expenseCategoryLabels: Record<string, string> = {
  cartorio: "Cartório",
  taxa_bancaria: "Taxa bancária",
  fornecedor: "Fornecedor",
  evento: "Evento",
  material: "Material",
  servico: "Serviço",
  decoracao: "Decoração",
  cerimonial: "Cerimonial",
  locacao: "Locação",
  reembolso: "Reembolso",
  ajuste: "Ajuste",
  outros: "Outros",
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

  if (Number.isNaN(date.getTime())) return "Data não informada";

  return date.toLocaleDateString("pt-BR");
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthToDate(month: string) {
  return `${month}-01`;
}

function getMonthFromDate(value?: string | null) {
  return value ? value.slice(0, 7) : "";
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  const index = Number(monthNumber) - 1;

  return `${monthNames[index] ?? monthNumber} de ${year}`;
}

function getAssociate(payment: Payment) {
  if (Array.isArray(payment.associates)) return payment.associates[0] ?? null;
  return payment.associates ?? null;
}

function getMonthlyFee(payment: Payment) {
  if (Array.isArray(payment.monthly_fees)) return payment.monthly_fees[0] ?? null;
  return payment.monthly_fees ?? null;
}

function getExtraItem(payment: Payment) {
  if (Array.isArray(payment.extra_contribution_items)) {
    return payment.extra_contribution_items[0] ?? null;
  }

  return payment.extra_contribution_items ?? null;
}

function getExtraContribution(item: ExtraContributionItemData | null) {
  if (!item) return null;

  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function getPaymentOrigin(payment: Payment) {
  if (payment.extra_contribution_item_id) {
    const item = getExtraItem(payment);
    const contribution = getExtraContribution(item);

    return {
      origin: "Contribuição extra",
      description: contribution?.title ?? "Contribuição extra",
    };
  }

  const fee = getMonthlyFee(payment);

  if (!fee) {
    return {
      origin: "Mensalidade",
      description: "Mensalidade não localizada",
    };
  }

  return {
    origin: "Mensalidade",
    description: `${monthNames[Number(fee.month) - 1]} de ${fee.year}`,
  };
}

function sumBy<T>(items: T[], getValue: (item: T) => number) {
  return items.reduce((sum, item) => sum + Number(getValue(item) ?? 0), 0);
}

function amountClass(value: number) {
  if (value < 0) return "text-red-700 print:text-black";
  return "text-[#13233a]";
}

export default function DashboardPrestacaoContasPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenues, setRevenues] = useState<OtherRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashBalance, setCashBalance] = useState<CashMonthlyBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiMessage, setAiMessage] = useState("");

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => getMonthFromDate(payment.paid_at) === month);
  }, [payments, month]);

  const filteredRevenues = useMemo(() => {
    return revenues.filter(
      (revenue) =>
        revenue.status === "confirmada" &&
        getMonthFromDate(revenue.received_at) === month
    );
  }, [revenues, month]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (expense.status !== "paga" || !expense.paid_at) return false;
      return getMonthFromDate(expense.paid_at) === month;
    });
  }, [expenses, month]);

  const movements = useMemo<Movement[]>(() => {
    const paymentMovements: Movement[] = filteredPayments.map((payment) => {
      const associate = getAssociate(payment);
      const origin = getPaymentOrigin(payment);

      return {
        id: `payment-${payment.id}`,
        date: payment.paid_at,
        type: "entrada",
        origin: origin.origin,
        description: origin.description,
        person: associate?.full_name ?? "Associado não localizado",
        method: payment.payment_method,
        reference: payment.reference,
        amount: Number(payment.amount ?? 0),
      };
    });

    const revenueMovements: Movement[] = filteredRevenues.map((revenue) => ({
      id: `revenue-${revenue.id}`,
      date: revenue.received_at,
      type: "entrada",
      origin: "Receita avulsa",
      description: `${revenueCategoryLabels[revenue.category] ?? revenue.category} - ${revenue.description}`,
      person: revenue.payer_name || "Pagador não informado",
      method: revenue.payment_method,
      reference: revenue.reference,
      amount: Number(revenue.amount ?? 0),
    }));

    const expenseMovements: Movement[] = filteredExpenses.map((expense) => ({
      id: `expense-${expense.id}`,
      date: expense.paid_at ?? expense.expense_date,
      type: "saida",
      origin: "Despesa",
      description: `${expenseCategoryLabels[expense.category] ?? expense.category} - ${expense.description}`,
      person: expense.payee_name || "Favorecido não informado",
      method: expense.payment_method,
      reference: expense.reference,
      amount: Number(expense.amount ?? 0),
      hasReceipt: Boolean(expense.receipt_path),
    }));

    return [...paymentMovements, ...revenueMovements, ...expenseMovements].sort(
      (a, b) => b.date.localeCompare(a.date)
    );
  }, [filteredPayments, filteredRevenues, filteredExpenses]);

  const summary = useMemo(() => {
    const monthlyPayments = filteredPayments.filter(
      (payment) => !payment.extra_contribution_item_id
    );

    const extraPayments = filteredPayments.filter(
      (payment) => Boolean(payment.extra_contribution_item_id)
    );

    const totalMonthly = sumBy(monthlyPayments, (payment) => Number(payment.amount));
    const totalExtra = sumBy(extraPayments, (payment) => Number(payment.amount));
    const totalOtherRevenues = sumBy(filteredRevenues, (revenue) =>
      Number(revenue.amount)
    );

    const totalEntries = totalMonthly + totalExtra + totalOtherRevenues;
    const totalExpenses = sumBy(filteredExpenses, (expense) => Number(expense.amount));

    const openingBalance = Number(cashBalance?.opening_balance ?? 0);
    const periodResult = Number((totalEntries - totalExpenses).toFixed(2));
    const finalBalance = Number((openingBalance + periodResult).toFixed(2));

    const expensesWithoutReceipt = filteredExpenses.filter(
      (expense) => !expense.receipt_path
    );

    const expensesByCategory = filteredExpenses.reduce<Record<string, number>>(
      (acc, expense) => {
        const label = expenseCategoryLabels[expense.category] ?? expense.category;
        acc[label] = Number((Number(acc[label] ?? 0) + Number(expense.amount ?? 0)).toFixed(2));
        return acc;
      },
      {}
    );

    const revenuesByCategory = filteredRevenues.reduce<Record<string, number>>(
      (acc, revenue) => {
        const label = revenueCategoryLabels[revenue.category] ?? revenue.category;
        acc[label] = Number((Number(acc[label] ?? 0) + Number(revenue.amount ?? 0)).toFixed(2));
        return acc;
      },
      {}
    );

    return {
      openingBalance,
      totalMonthly,
      totalExtra,
      totalOtherRevenues,
      totalEntries,
      totalExpenses,
      periodResult,
      finalBalance,
      movementsCount: movements.length,
      expensesCount: filteredExpenses.length,
      entriesCount: filteredPayments.length + filteredRevenues.length,
      expensesWithoutReceipt,
      expensesByCategory,
      revenuesByCategory,
    };
  }, [filteredPayments, filteredRevenues, filteredExpenses, cashBalance, movements.length]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, associate_id, monthly_fee_id, extra_contribution_item_id, amount, paid_at, payment_method, reference, notes, created_at, associates(full_name, email), monthly_fees(year, month), extra_contribution_items(extra_contributions(title))"
      )
      .order("paid_at", { ascending: false });

    if (paymentsError) {
      setMessage(paymentsError.message || "Não foi possível carregar pagamentos.");
      setLoading(false);
      return;
    }

    const { data: revenuesData, error: revenuesError } = await supabase
      .from("other_revenues")
      .select(
        "id, received_at, amount, category, payer_name, description, payment_method, reference, notes, status, created_at"
      )
      .order("received_at", { ascending: false });

    if (revenuesError) {
      setMessage(revenuesError.message || "Não foi possível carregar receitas.");
      setLoading(false);
      return;
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, due_date, paid_at, amount, category, payee_name, description, payment_method, reference, notes, status, receipt_path, receipt_filename, created_at"
      )
      .order("paid_at", { ascending: false })
      .order("expense_date", { ascending: false });

    if (expensesError) {
      setMessage(expensesError.message || "Não foi possível carregar despesas.");
      setLoading(false);
      return;
    }

    const { data: balanceData, error: balanceError } = await supabase
      .from("cash_monthly_balances")
      .select("id, month_ref, opening_balance, notes")
      .eq("month_ref", monthToDate(month))
      .maybeSingle();

    if (balanceError) {
      setMessage(balanceError.message || "Não foi possível carregar o saldo inicial.");
      setLoading(false);
      return;
    }

    setPayments((paymentsData as unknown as Payment[]) ?? []);
    setRevenues((revenuesData as unknown as OtherRevenue[]) ?? []);
    setExpenses((expensesData as unknown as Expense[]) ?? []);
    setCashBalance((balanceData as unknown as CashMonthlyBalance) ?? null);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function generateAiAnalysis() {
    setAiLoading(true);
    setAiMessage("");
    setAiAnalysis("");

    const alerts: string[] = [];

    if (!cashBalance) {
      alerts.push(
        "Não há saldo inicial cadastrado para este mês. O relatório considera saldo inicial igual a R$ 0,00."
      );
    }

    if (summary.expensesWithoutReceipt.length > 0) {
      alerts.push(
        `${summary.expensesWithoutReceipt.length} despesa(s) paga(s) não possuem comprovante anexado.`
      );
    }

    if (summary.movementsCount === 0) {
      alerts.push("Não há movimentações financeiras registradas no período.");
    }

    if (summary.periodResult < 0) {
      alerts.push("O resultado do mês foi negativo, com saídas superiores às entradas.");
    }

    if (summary.periodResult > 0) {
      alerts.push("O resultado do mês foi positivo, com entradas superiores às saídas.");
    }

    try {
      const response = await fetch("/api/ia/analise-fiscal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monthLabel: formatMonth(month),
          summary: {
            openingBalance: summary.openingBalance,
            totalEntries: summary.totalEntries,
            totalExpenses: summary.totalExpenses,
            periodResult: summary.periodResult,
            finalBalance: summary.finalBalance,
            totalMonthly: summary.totalMonthly,
            totalExtra: summary.totalExtra,
            entriesCount: summary.entriesCount,
            expensesCount: summary.expensesCount,
            movementsCount: summary.movementsCount,
            expensesWithoutReceiptCount: summary.expensesWithoutReceipt.length,
          },
          alerts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAiMessage(data.error || "Não foi possível gerar a análise com IA.");
        return;
      }

      setAiAnalysis(data.analysis || "");
    } catch (error) {
      console.error("Erro ao chamar análise fiscal com IA:", error);
      setAiMessage("Não foi possível conectar ao serviço de IA.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <ProtectedDashboard>
      <style jsx global>{`
        .pc-relatorio {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
        }

        .pc-relatorio table {
          font-size: 12px;
        }

        .pc-relatorio th,
        .pc-relatorio td {
          vertical-align: top;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          body {
            background: white !important;
          }

          .pc-relatorio {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5px;
            line-height: 1.25;
          }

          .pc-relatorio table {
            font-size: 9.5px;
          }

          .pc-relatorio section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .pc-relatorio thead {
            display: table-header-group;
          }

          .pc-relatorio tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="pc-relatorio space-y-3 print:space-y-1 print:bg-white print:text-black">
        <section className="rounded-2xl border border-[#e8dccb] bg-white p-3 shadow-sm print:hidden">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Mês da prestação de contas
              </span>

              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={loadData}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="w-fit rounded-full bg-[#13233a] px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white"
              >
                Imprimir / salvar PDF
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
          <div className="border-b border-[#e8dccb] pb-3 print:border-black">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/brand/aad-login-logo.png"
                  alt="AAD Direito 2028"
                  className="h-auto max-h-[42px] w-auto max-w-[230px] object-contain print:max-h-[34px] print:max-w-[190px]"
                />
              </div>

              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a98246] print:text-black">
                  Prestação de contas
                </p>

                <p className="mt-1 text-xs font-bold text-[#596579] print:text-black">
                  Gerado pelo Painel AAD Direito 2028
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-[#f7f8fa] px-3 py-2 print:bg-white print:px-0 print:py-2">
              <h1 className="text-lg font-black tracking-[-0.04em] text-[#13233a] print:text-xl print:text-black">
                Prestação de Contas Mensal
              </h1>

              <p className="mt-1 text-sm font-bold text-[#596579] print:text-black">
                Referência: {formatMonth(month)}
              </p>
            </div>
          </div>

          {message && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 print:border-black print:bg-white print:text-black">
              {message}
            </div>
          )}

          {!cashBalance && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 print:border-black print:bg-white print:text-black">
              Atenção: não há saldo inicial cadastrado para este mês. O relatório considera saldo inicial igual a R$ 0,00.
            </div>
          )}
        </section>

        <section className={`rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none ${aiAnalysis ? "" : "print:hidden"}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a98246] print:text-black">
                Análise fiscal com IA
              </p>

              <h2 className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
                Análise sugerida para apoio à Comissão Fiscal
              </h2>

              <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-[#596579] print:text-[10px] print:text-black">
                Texto gerado automaticamente com base nos dados consolidados da prestação de contas. A conferência final permanece sob responsabilidade da Tesouraria, Presidência e Comissão Fiscal.
              </p>
            </div>

            <button
              type="button"
              onClick={generateAiAnalysis}
              disabled={aiLoading}
              className="w-fit rounded-full bg-[#13233a] px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70 print:hidden"
            >
              {aiLoading ? "Gerando..." : "Gerar análise com IA"}
            </button>
          </div>

          {aiMessage && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700 print:border-black print:bg-white print:text-black">
              {aiMessage}
            </div>
          )}

          {aiAnalysis && (
            <div className="mt-3 whitespace-pre-line rounded-xl border border-[#e8dccb] bg-[#f7f8fa] p-3 text-sm font-bold leading-6 text-[#13233a] print:rounded-none print:border-black print:bg-white print:p-2 print:text-[10px] print:leading-5 print:text-black">
              {aiAnalysis}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
          <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
            1. Resumo financeiro
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-[#e8dccb] print:rounded-none print:border-black">
            <table className="w-full border-collapse text-xs print:text-[10px]">
              <tbody>
                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="bg-[#f7f8fa] px-2 py-1.5 font-bold text-[#596579] print:bg-white print:text-black">
                    Saldo inicial do mês
                  </td>
                  <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">
                    {formatCurrency(summary.openingBalance)}
                  </td>
                </tr>

                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="bg-[#f7f8fa] px-2 py-1.5 font-bold text-[#596579] print:bg-white print:text-black">
                    Total de entradas
                  </td>
                  <td className="px-2 py-1.5 text-right font-black text-green-700 print:text-black">
                    {formatCurrency(summary.totalEntries)}
                  </td>
                </tr>

                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="bg-[#f7f8fa] px-2 py-1.5 font-bold text-[#596579] print:bg-white print:text-black">
                    Total de saídas
                  </td>
                  <td className="px-2 py-1.5 text-right font-black text-red-700 print:text-black">
                    {formatCurrency(summary.totalExpenses)}
                  </td>
                </tr>

                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="bg-[#f7f8fa] px-2 py-1.5 font-bold text-[#596579] print:bg-white print:text-black">
                    Resultado do mês
                  </td>
                  <td className={`px-2 py-1.5 text-right font-black ${amountClass(summary.periodResult)}`}>
                    {formatCurrency(summary.periodResult)}
                  </td>
                </tr>

                <tr>
                  <td className="bg-[#f7f8fa] px-2 py-1.5 font-black text-[#13233a] print:bg-white print:text-black">
                    Saldo final
                  </td>
                  <td className={`px-2 py-1.5 text-right font-black ${amountClass(summary.finalBalance)}`}>
                    {formatCurrency(summary.finalBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
          <div className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
            <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
              2. Receitas
            </h2>

            <div className="mt-3 overflow-hidden rounded-xl border border-[#e8dccb] print:rounded-none print:border-black">
              <table className="w-full border-collapse text-xs print:text-[10px]">
                <tbody>
                  <tr className="border-b border-[#e8dccb] print:border-black">
                    <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Mensalidades</td>
                    <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{formatCurrency(summary.totalMonthly)}</td>
                  </tr>

                  <tr className="border-b border-[#e8dccb] print:border-black">
                    <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Contribuições extras</td>
                    <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{formatCurrency(summary.totalExtra)}</td>
                  </tr>

                  {Object.entries(summary.revenuesByCategory).map(([category, value]) => (
                    <tr key={category} className="border-b border-[#e8dccb] last:border-b-0 print:border-black">
                      <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">{category}</td>
                      <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{formatCurrency(value)}</td>
                    </tr>
                  ))}

                  <tr>
                    <td className="bg-[#f7f8fa] px-2 py-1.5 font-black text-[#13233a] print:bg-white print:text-black">Total</td>
                    <td className="bg-[#f7f8fa] px-2 py-1.5 text-right font-black text-[#13233a] print:bg-white print:text-black">{formatCurrency(summary.totalEntries)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
            <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
              3. Despesas
            </h2>

            <div className="mt-3 overflow-hidden rounded-xl border border-[#e8dccb] print:rounded-none print:border-black">
              <table className="w-full border-collapse text-xs print:text-[10px]">
                <tbody>
                  {Object.keys(summary.expensesByCategory).length === 0 ? (
                    <tr>
                      <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Nenhuma despesa paga no período.</td>
                      <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{formatCurrency(0)}</td>
                    </tr>
                  ) : (
                    Object.entries(summary.expensesByCategory).map(([category, value]) => (
                      <tr key={category} className="border-b border-[#e8dccb] last:border-b-0 print:border-black">
                        <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">{category}</td>
                        <td className="px-2 py-1.5 text-right font-black text-red-700 print:text-black">{formatCurrency(value)}</td>
                      </tr>
                    ))
                  )}

                  <tr>
                    <td className="bg-[#f7f8fa] px-2 py-1.5 font-black text-[#13233a] print:bg-white print:text-black">Total</td>
                    <td className="bg-[#f7f8fa] px-2 py-1.5 text-right font-black text-[#13233a] print:bg-white print:text-black">{formatCurrency(summary.totalExpenses)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
          <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
            4. Conferência documental
          </h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-[#e8dccb] print:rounded-none print:border-black">
            <table className="w-full border-collapse text-xs print:text-[10px]">
              <tbody>
                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Entradas registradas</td>
                  <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{summary.entriesCount}</td>
                </tr>

                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Despesas pagas</td>
                  <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{summary.expensesCount}</td>
                </tr>

                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Despesas pagas sem comprovante</td>
                  <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{summary.expensesWithoutReceipt.length}</td>
                </tr>

                <tr>
                  <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">Total de movimentações</td>
                  <td className="px-2 py-1.5 text-right font-black text-[#13233a] print:text-black">{summary.movementsCount}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {summary.expensesWithoutReceipt.length > 0 && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 print:border-black print:bg-white print:text-black">
              Há despesas pagas sem comprovante anexado. Recomenda-se regularizar antes da apresentação à Comissão Fiscal.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
          <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
            5. Movimentações do período
          </h2>

          {loading ? (
            <div className="mt-3 rounded-xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579] print:bg-white print:text-black">
              Carregando prestação de contas...
            </div>
          ) : movements.length === 0 ? (
            <div className="mt-3 rounded-xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579] print:bg-white print:text-black">
              Nenhuma movimentação registrada no período.
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-[#e8dccb] print:rounded-none print:border-black">
              <table className="w-full border-collapse text-left text-[11px] print:text-[9px]">
                <thead className="bg-[#f7f8fa] uppercase tracking-[0.08em] text-[#596579] print:bg-white print:text-black">
                  <tr>
                    <th className="px-2 py-1.5 print:border-b print:border-black">Data</th>
                    <th className="px-2 py-1.5 print:border-b print:border-black">Tipo</th>
                    <th className="px-2 py-1.5 print:border-b print:border-black">Origem</th>
                    <th className="px-2 py-1.5 print:border-b print:border-black">Descrição</th>
                    <th className="px-2 py-1.5 print:border-b print:border-black">Pessoa</th>
                    <th className="px-2 py-1.5 text-right print:border-b print:border-black">Valor</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id} className="border-t border-[#e8dccb] align-top print:border-black">
                      <td className="px-2 py-1.5 font-bold text-[#13233a] print:text-black">
                        {formatDate(movement.date)}
                      </td>

                      <td className="px-2 py-1.5 font-bold uppercase text-[#596579] print:text-black">
                        {movement.type === "entrada" ? "Entrada" : "Saída"}
                      </td>

                      <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">
                        {movement.origin}
                      </td>

                      <td className="px-2 py-1.5">
                        <p className="font-bold text-[#13233a] print:text-black">
                          {movement.description}
                        </p>

                        <p className="mt-0.5 text-[11px] font-bold text-[#596579] print:text-[8px] print:text-black">
                          Ref.: {movement.reference || "Não informado"}
                          {movement.type === "saida" &&
                            ` · Comprovante: ${movement.hasReceipt ? "sim" : "não"}`}
                        </p>
                      </td>

                      <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">
                        {movement.person}
                      </td>

                      <td
                        className={`px-2 py-1.5 text-right font-black ${
                          movement.type === "entrada"
                            ? "text-green-700 print:text-black"
                            : "text-red-700 print:text-black"
                        }`}
                      >
                        {movement.type === "entrada" ? "+ " : "- "}
                        {formatCurrency(movement.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:rounded-none print:border-black print:p-2 print:shadow-none">
          <h2 className="text-sm font-black uppercase tracking-[0.08em] text-[#13233a] print:text-sm print:text-black">
            6. Conferência e validação
          </h2>

          <p className="mt-2 text-xs font-bold leading-5 text-[#596579] print:text-[11px] print:text-black">
            O presente demonstrativo foi gerado a partir dos registros financeiros lançados no Painel AAD Direito 2028. A conferência deve considerar os extratos bancários, comprovantes de receitas, comprovantes de despesas e demais documentos de suporte.
          </p>

          <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb] print:rounded-none print:border-black">
            <table className="w-full border-collapse text-xs print:text-[10px]">
              <tbody>
                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="w-1/2 px-2 py-1.5 font-bold text-[#596579] print:text-black">
                    Saldo final conferido com extrato bancário
                  </td>
                  <td className="px-2 py-1.5 font-bold text-[#13233a] print:text-black">
                    ( &nbsp; ) Sim &nbsp;&nbsp;&nbsp; ( &nbsp; ) Não
                  </td>
                </tr>

                <tr className="border-b border-[#e8dccb] print:border-black">
                  <td className="px-2 py-1.5 font-bold text-[#596579] print:text-black">
                    Há ressalvas, recomendações ou apontamentos
                  </td>
                  <td className="px-2 py-1.5 font-bold text-[#13233a] print:text-black">
                    ( &nbsp; ) Sim &nbsp;&nbsp;&nbsp; ( &nbsp; ) Não
                  </td>
                </tr>

                <tr>
                  <td colSpan={2} className="px-2 py-1.5 font-bold text-[#596579] print:text-black">
                    Observações da Comissão Fiscal:
                    <div className="mt-8 border-b border-[#e8dccb] print:border-black" />
                    <div className="mt-8 border-b border-[#e8dccb] print:border-black" />
                    <div className="mt-8 border-b border-[#e8dccb] print:border-black" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs font-bold leading-5 text-[#596579] print:text-[11px] print:text-black">
            A assinatura da Tesouraria indica a elaboração/apresentação da prestação de contas. A assinatura da Presidência indica ciência. A assinatura dos membros da Comissão Fiscal indica ciência e conferência dos dados apresentados, sem prejuízo de eventuais ressalvas ou recomendações.
          </p>

          <div className="mt-8 space-y-8 text-center text-[11px] print:mt-6 print:space-y-6 print:text-[10px]">
            <div className="grid gap-8 md:grid-cols-2 print:grid-cols-2">
              <div className="border-t border-[#13233a] pt-1.5 print:border-black">
                Tesouraria
              </div>

              <div className="border-t border-[#13233a] pt-1.5 print:border-black">
                Presidência
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 print:grid-cols-3">
              <div className="border-t border-[#13233a] pt-1.5 print:border-black">
                Comissão Fiscal - Membro 1
              </div>

              <div className="border-t border-[#13233a] pt-1.5 print:border-black">
                Comissão Fiscal - Membro 2
              </div>

              <div className="border-t border-[#13233a] pt-1.5 print:border-black">
                Comissão Fiscal - Membro 3
              </div>
            </div>
          </div>
        </section>
      </div>
    </ProtectedDashboard>
  );
}
