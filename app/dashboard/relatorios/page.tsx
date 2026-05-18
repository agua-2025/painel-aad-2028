"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  financial_status: string | null;
  created_at: string;
};

type MonthlyFee = {
  id: string;
  associate_id: string;
  year: number;
  month: number;
  due_date: string;
  total_amount: number;
  paid_amount: number | null;
  status: string;
  associates: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | {
    full_name: string;
    email: string | null;
    phone: string | null;
  }[] | null;
};

type Payment = {
  id: string;
  associate_id: string;
  amount: number;
  paid_at: string;
  payment_method: string;
  monthly_fee_id: string | null;
  extra_contribution_item_id: string | null;
};

type OtherRevenue = {
  id: string;
  received_at: string;
  amount: number;
  category: string;
  description: string;
  status: string;
};

type Expense = {
  id: string;
  paid_at: string | null;
  expense_date: string;
  amount: number;
  category: string;
  description: string;
  status: string;
  receipt_path: string | null;
};

type CashMonthlyBalance = {
  id: string;
  month_ref: string;
  opening_balance: number;
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

const reportOptions = [
  { value: "associados", label: "Associados" },
  { value: "financeiro", label: "Financeiro mensal" },
  { value: "inadimplencia", label: "Inadimplência" },
  { value: "despesas", label: "Despesas" },
];

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

function getMonthParts(month: string) {
  const [year, monthNumber] = month.split("-");

  return {
    year: Number(year),
    month: Number(monthNumber),
  };
}

function formatMonth(month: string) {
  const { year, month: monthNumber } = getMonthParts(month);

  return `${monthNames[monthNumber - 1] ?? monthNumber} de ${year}`;
}

function getAssociate(fee: MonthlyFee) {
  if (Array.isArray(fee.associates)) {
    return fee.associates[0] ?? null;
  }

  return fee.associates ?? null;
}

function normalizeStatus(value?: string | null) {
  if (!value) return "Não informado";

  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadCsv(filename: string, rows: Record<string, string | number | null | undefined>[]) {
  if (rows.length === 0) {
    alert("Não há dados para exportar.");
    return;
  }

  const headers = Object.keys(rows[0]);

  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  };

  const csv = [
    headers.map(escapeCell).join(";"),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(";")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function DashboardRelatoriosPage() {
  const [activeReport, setActiveReport] = useState("associados");
  const [month, setMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [associates, setAssociates] = useState<Associate[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenues, setRevenues] = useState<OtherRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashBalance, setCashBalance] = useState<CashMonthlyBalance | null>(null);

  const { year, month: monthNumber } = getMonthParts(month);

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
    return expenses.filter(
      (expense) =>
        expense.status === "paga" &&
        expense.paid_at &&
        getMonthFromDate(expense.paid_at) === month
    );
  }, [expenses, month]);

  const monthFees = useMemo(() => {
    return monthlyFees.filter(
      (fee) => fee.year === year && fee.month === monthNumber
    );
  }, [monthlyFees, year, monthNumber]);

  const openFees = useMemo(() => {
    return monthlyFees.filter((fee) =>
      ["pendente", "parcialmente_paga", "atrasada"].includes(fee.status)
    );
  }, [monthlyFees]);

  const overdueFees = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return openFees.filter((fee) => fee.due_date < today);
  }, [openFees]);

  const financeSummary = useMemo(() => {
    const monthlyPayments = filteredPayments.filter(
      (payment) => !payment.extra_contribution_item_id
    );

    const extraPayments = filteredPayments.filter(
      (payment) => Boolean(payment.extra_contribution_item_id)
    );

    const monthlyTotal = monthlyPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    const extraTotal = extraPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    const revenuesTotal = filteredRevenues.reduce(
      (sum, revenue) => sum + Number(revenue.amount ?? 0),
      0
    );

    const expensesTotal = filteredExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0
    );

    const entriesTotal = monthlyTotal + extraTotal + revenuesTotal;
    const openingBalance = Number(cashBalance?.opening_balance ?? 0);
    const result = Number((entriesTotal - expensesTotal).toFixed(2));
    const finalBalance = Number((openingBalance + result).toFixed(2));

    return {
      openingBalance,
      monthlyTotal,
      extraTotal,
      revenuesTotal,
      entriesTotal,
      expensesTotal,
      result,
      finalBalance,
    };
  }, [filteredPayments, filteredRevenues, filteredExpenses, cashBalance]);

  const associatesSummary = useMemo(() => {
    const active = associates.filter((associate) => associate.status === "ativo");
    const inactive = associates.filter((associate) => associate.status !== "ativo");

    const financialStatus = associates.reduce<Record<string, number>>((acc, associate) => {
      const key = normalizeStatus(associate.financial_status);
      acc[key] = Number(acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: associates.length,
      active: active.length,
      inactive: inactive.length,
      financialStatus,
    };
  }, [associates]);

  const inadimplenciaSummary = useMemo(() => {
    const totalOpen = openFees.reduce((sum, fee) => {
      const amount = Number(fee.total_amount ?? 0);
      const paid = Number(fee.paid_amount ?? 0);
      return sum + Math.max(amount - paid, 0);
    }, 0);

    const totalOverdue = overdueFees.reduce((sum, fee) => {
      const amount = Number(fee.total_amount ?? 0);
      const paid = Number(fee.paid_amount ?? 0);
      return sum + Math.max(amount - paid, 0);
    }, 0);

    return {
      openCount: openFees.length,
      overdueCount: overdueFees.length,
      totalOpen,
      totalOverdue,
    };
  }, [openFees, overdueFees]);

  const expensesSummary = useMemo(() => {
    const paidWithoutReceipt = filteredExpenses.filter(
      (expense) => !expense.receipt_path
    );

    const byCategory = filteredExpenses.reduce<Record<string, number>>(
      (acc, expense) => {
        const key = normalizeStatus(expense.category);
        acc[key] = Number((Number(acc[key] ?? 0) + Number(expense.amount ?? 0)).toFixed(2));
        return acc;
      },
      {}
    );

    return {
      total: filteredExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0
      ),
      count: filteredExpenses.length,
      paidWithoutReceipt: paidWithoutReceipt.length,
      byCategory,
    };
  }, [filteredExpenses]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data: associatesData, error: associatesError } = await supabase
      .from("associates")
      .select("id, full_name, email, phone, status, financial_status, created_at")
      .order("full_name", { ascending: true });

    if (associatesError) {
      setMessage(associatesError.message || "Não foi possível carregar associados.");
      setLoading(false);
      return;
    }

    const { data: feesData, error: feesError } = await supabase
      .from("monthly_fees")
      .select(
        "id, associate_id, year, month, due_date, total_amount, paid_amount, status, associates(full_name, email, phone)"
      )
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (feesError) {
      setMessage(feesError.message || "Não foi possível carregar mensalidades.");
      setLoading(false);
      return;
    }

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("id, associate_id, amount, paid_at, payment_method, monthly_fee_id, extra_contribution_item_id")
      .order("paid_at", { ascending: false });

    if (paymentsError) {
      setMessage(paymentsError.message || "Não foi possível carregar pagamentos.");
      setLoading(false);
      return;
    }

    const { data: revenuesData, error: revenuesError } = await supabase
      .from("other_revenues")
      .select("id, received_at, amount, category, description, status")
      .order("received_at", { ascending: false });

    if (revenuesError) {
      setMessage(revenuesError.message || "Não foi possível carregar receitas avulsas.");
      setLoading(false);
      return;
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select("id, paid_at, expense_date, amount, category, description, status, receipt_path")
      .order("paid_at", { ascending: false });

    if (expensesError) {
      setMessage(expensesError.message || "Não foi possível carregar despesas.");
      setLoading(false);
      return;
    }

    const { data: balanceData, error: balanceError } = await supabase
      .from("cash_monthly_balances")
      .select("id, month_ref, opening_balance")
      .eq("month_ref", monthToDate(month))
      .maybeSingle();

    if (balanceError) {
      setMessage(balanceError.message || "Não foi possível carregar saldo inicial.");
      setLoading(false);
      return;
    }

    setAssociates((associatesData as unknown as Associate[]) ?? []);
    setMonthlyFees((feesData as unknown as MonthlyFee[]) ?? []);
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

  function exportAssociates() {
    downloadCsv(
      `associados-${new Date().toISOString().slice(0, 10)}.csv`,
      associates.map((associate) => ({
        Nome: associate.full_name,
        Email: associate.email,
        Telefone: associate.phone,
        Status: normalizeStatus(associate.status),
        "Situação financeira": normalizeStatus(associate.financial_status),
        "Cadastro em": formatDate(associate.created_at),
      }))
    );
  }

  function exportFinanceiro() {
    downloadCsv(`financeiro-${month}.csv`, [
      { Item: "Saldo inicial", Valor: financeSummary.openingBalance },
      { Item: "Mensalidades", Valor: financeSummary.monthlyTotal },
      { Item: "Contribuições extras", Valor: financeSummary.extraTotal },
      { Item: "Receitas avulsas", Valor: financeSummary.revenuesTotal },
      { Item: "Total de entradas", Valor: financeSummary.entriesTotal },
      { Item: "Total de saídas", Valor: financeSummary.expensesTotal },
      { Item: "Resultado do mês", Valor: financeSummary.result },
      { Item: "Saldo final", Valor: financeSummary.finalBalance },
    ]);
  }

  function exportInadimplencia() {
    downloadCsv(
      `inadimplencia-${new Date().toISOString().slice(0, 10)}.csv`,
      openFees.map((fee) => {
        const associate = getAssociate(fee);
        const amount = Number(fee.total_amount ?? 0);
        const paid = Number(fee.paid_amount ?? 0);

        return {
          Associado: associate?.full_name ?? "Associado não localizado",
          Email: associate?.email ?? "",
          Telefone: associate?.phone ?? "",
          Referência: `${String(fee.month).padStart(2, "0")}/${fee.year}`,
          Vencimento: formatDate(fee.due_date),
          Status: normalizeStatus(fee.status),
          Valor: amount,
          Pago: paid,
          Saldo: Math.max(amount - paid, 0),
        };
      })
    );
  }

  function exportDespesas() {
    downloadCsv(
      `despesas-${month}.csv`,
      filteredExpenses.map((expense) => ({
        Data: formatDate(expense.paid_at),
        Categoria: normalizeStatus(expense.category),
        Descrição: expense.description,
        Valor: Number(expense.amount ?? 0),
        Comprovante: expense.receipt_path ? "Sim" : "Não",
      }))
    );
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-5">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Administração
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Relatórios
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Consulte informações consolidadas da Associação e exporte dados para conferência, controle interno e apoio à gestão.
          </p>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-bold text-[#13233a]">
                Relatório
              </span>

              <select
                value={activeReport}
                onChange={(event) => setActiveReport(event.target.value)}
                className="w-full rounded-xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              >
                {reportOptions.map((report) => (
                  <option key={report.value} value={report.value}>
                    {report.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Mês de referência
              </span>

              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadData}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        {message && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </section>
        )}

        {loading ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">
              Carregando relatórios...
            </p>
          </section>
        ) : (
          <>
            {activeReport === "associados" && (
              <section className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
                      Total
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#13233a]">
                      {associatesSummary.total}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-green-800">
                      Ativos
                    </p>
                    <p className="mt-1 text-2xl font-black text-green-800">
                      {associatesSummary.active}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-amber-800">
                      Outros status
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-800">
                      {associatesSummary.inactive}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <button
                      type="button"
                      onClick={exportAssociates}
                      className="w-full rounded-full bg-[#13233a] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                    Associados
                  </h2>

                  <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-[#f7f8fa] text-xs uppercase tracking-[0.08em] text-[#596579]">
                        <tr>
                          <th className="px-3 py-3">Nome</th>
                          <th className="px-3 py-3">Contato</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Financeiro</th>
                        </tr>
                      </thead>

                      <tbody>
                        {associates.map((associate) => (
                          <tr key={associate.id} className="border-t border-[#e8dccb]">
                            <td className="px-3 py-3 font-bold text-[#13233a]">
                              {associate.full_name}
                            </td>
                            <td className="px-3 py-3 text-[#596579]">
                              <p className="font-bold">{associate.email || "Sem e-mail"}</p>
                              <p className="text-xs font-bold">{associate.phone || "Sem telefone"}</p>
                            </td>
                            <td className="px-3 py-3 font-bold text-[#596579]">
                              {normalizeStatus(associate.status)}
                            </td>
                            <td className="px-3 py-3 font-bold text-[#596579]">
                              {normalizeStatus(associate.financial_status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeReport === "financeiro" && (
              <section className="space-y-5">
                <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                        Financeiro mensal - {formatMonth(month)}
                      </h2>
                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        Resumo de entradas, saídas e saldo.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={exportFinanceiro}
                      className="w-fit rounded-full bg-[#13233a] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Exportar CSV
                    </button>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        {[
                          ["Saldo inicial", financeSummary.openingBalance],
                          ["Mensalidades", financeSummary.monthlyTotal],
                          ["Contribuições extras", financeSummary.extraTotal],
                          ["Receitas avulsas", financeSummary.revenuesTotal],
                          ["Total de entradas", financeSummary.entriesTotal],
                          ["Total de saídas", financeSummary.expensesTotal],
                          ["Resultado do mês", financeSummary.result],
                          ["Saldo final", financeSummary.finalBalance],
                        ].map(([label, value]) => (
                          <tr key={String(label)} className="border-b border-[#e8dccb] last:border-b-0">
                            <td className="bg-[#f7f8fa] px-3 py-2 font-bold text-[#596579]">
                              {label}
                            </td>
                            <td className="px-3 py-2 text-right font-black text-[#13233a]">
                              {formatCurrency(Number(value))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeReport === "inadimplencia" && (
              <section className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
                      Em aberto
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#13233a]">
                      {inadimplenciaSummary.openCount}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-red-800">
                      Vencidas
                    </p>
                    <p className="mt-1 text-2xl font-black text-red-800">
                      {inadimplenciaSummary.overdueCount}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
                      Total aberto
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#13233a]">
                      {formatCurrency(inadimplenciaSummary.totalOpen)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <button
                      type="button"
                      onClick={exportInadimplencia}
                      className="w-full rounded-full bg-[#13233a] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                    Mensalidades em aberto
                  </h2>

                  <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-[#f7f8fa] text-xs uppercase tracking-[0.08em] text-[#596579]">
                        <tr>
                          <th className="px-3 py-3">Associado</th>
                          <th className="px-3 py-3">Referência</th>
                          <th className="px-3 py-3">Vencimento</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3 text-right">Saldo</th>
                        </tr>
                      </thead>

                      <tbody>
                        {openFees.map((fee) => {
                          const associate = getAssociate(fee);
                          const amount = Number(fee.total_amount ?? 0);
                          const paid = Number(fee.paid_amount ?? 0);
                          const balance = Math.max(amount - paid, 0);

                          return (
                            <tr key={fee.id} className="border-t border-[#e8dccb]">
                              <td className="px-3 py-3">
                                <p className="font-bold text-[#13233a]">
                                  {associate?.full_name ?? "Associado não localizado"}
                                </p>
                                <p className="text-xs font-bold text-[#596579]">
                                  {associate?.email ?? "Sem e-mail"}
                                </p>
                              </td>
                              <td className="px-3 py-3 font-bold text-[#596579]">
                                {String(fee.month).padStart(2, "0")}/{fee.year}
                              </td>
                              <td className="px-3 py-3 font-bold text-[#596579]">
                                {formatDate(fee.due_date)}
                              </td>
                              <td className="px-3 py-3 font-bold text-[#596579]">
                                {normalizeStatus(fee.status)}
                              </td>
                              <td className="px-3 py-3 text-right font-black text-red-700">
                                {formatCurrency(balance)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeReport === "despesas" && (
              <section className="space-y-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
                      Despesas pagas
                    </p>
                    <p className="mt-1 text-2xl font-black text-[#13233a]">
                      {expensesSummary.count}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-red-800">
                      Total
                    </p>
                    <p className="mt-1 text-2xl font-black text-red-800">
                      {formatCurrency(expensesSummary.total)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.06em] text-amber-800">
                      Sem comprovante
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-800">
                      {expensesSummary.paidWithoutReceipt}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                    <button
                      type="button"
                      onClick={exportDespesas}
                      className="w-full rounded-full bg-[#13233a] px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <h2 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                    Despesas pagas - {formatMonth(month)}
                  </h2>

                  <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead className="bg-[#f7f8fa] text-xs uppercase tracking-[0.08em] text-[#596579]">
                        <tr>
                          <th className="px-3 py-3">Data</th>
                          <th className="px-3 py-3">Categoria</th>
                          <th className="px-3 py-3">Descrição</th>
                          <th className="px-3 py-3">Comprovante</th>
                          <th className="px-3 py-3 text-right">Valor</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="border-t border-[#e8dccb]">
                            <td className="px-3 py-3 font-bold text-[#596579]">
                              {formatDate(expense.paid_at)}
                            </td>
                            <td className="px-3 py-3 font-bold text-[#596579]">
                              {normalizeStatus(expense.category)}
                            </td>
                            <td className="px-3 py-3 font-bold text-[#13233a]">
                              {expense.description}
                            </td>
                            <td className="px-3 py-3 font-bold text-[#596579]">
                              {expense.receipt_path ? "Sim" : "Não"}
                            </td>
                            <td className="px-3 py-3 text-right font-black text-red-700">
                              {formatCurrency(expense.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ProtectedDashboard>
  );
}
