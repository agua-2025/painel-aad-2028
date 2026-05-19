"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  status: string;
};

type MonthlyFee = {
  id: string;
  associate_id: string;
  status: string;
  total_amount: number;
  paid_amount: number;
};

type Payment = {
  amount: number;
};

type OtherRevenue = {
  amount: number;
};

type Expense = {
  amount: number;
  receipt_path: string | null;
};

type PaymentReport = {
  id: string;
  amount: number;
};

type MembershipRequest = {
  id: string;
  status: string;
};

type DashboardData = {
  activeAssociates: number;
  pendingRequests: number;
  openFeesCount: number;
  openFeesAmount: number;
  delinquentAssociates: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  pendingReportsCount: number;
  pendingReportsAmount: number;
  paidExpensesWithoutReceipt: number;
};

const emptyData: DashboardData = {
  activeAssociates: 0,
  pendingRequests: 0,
  openFeesCount: 0,
  openFeesAmount: 0,
  delinquentAssociates: 0,
  monthlyRevenue: 0,
  monthlyExpenses: 0,
  pendingReportsCount: 0,
  pendingReportsAmount: 0,
  paidExpensesWithoutReceipt: 0,
};

const chartColors = {
  revenue: "#13233a",
  expense: "#c7a56b",
  active: "#13233a",
  delinquent: "#d97706",
};

function formatCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCompactCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const toDate = (date: Date) => date.toISOString().slice(0, 10);

  return {
    start: toDate(start),
    end: toDate(end),
    label: now.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    }),
  };
}

function SimpleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-xs font-bold text-[#13233a] shadow-sm">
      {payload.map((item) => (
        <p key={item.name}>
          {item.name}: {formatCurrency(item.value)}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const monthRange = useMemo(() => getMonthRange(), []);

  const result = data.monthlyRevenue - data.monthlyExpenses;

  const financialChart = [
    {
      name: "Receitas",
      valor: data.monthlyRevenue,
      fill: chartColors.revenue,
    },
    {
      name: "Despesas",
      valor: data.monthlyExpenses,
      fill: chartColors.expense,
    },
  ];

  const associateChart = [
    {
      name: "Ativos",
      value: Math.max(data.activeAssociates - data.delinquentAssociates, 0),
      fill: chartColors.active,
    },
    {
      name: "Inadimplência",
      value: data.delinquentAssociates,
      fill: chartColors.delinquent,
    },
  ].filter((item) => item.value > 0);

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const [
      associatesResult,
      monthlyFeesResult,
      paymentsResult,
      revenuesResult,
      expensesResult,
      reportsResult,
      requestsResult,
    ] = await Promise.all([
      supabase.from("associates").select("id, status"),
      supabase
        .from("monthly_fees")
        .select("id, associate_id, status, total_amount, paid_amount")
        .in("status", ["pendente", "parcialmente_paga", "atrasada"]),
      supabase
        .from("payments")
        .select("amount")
        .gte("paid_at", monthRange.start)
        .lt("paid_at", monthRange.end),
      supabase
        .from("other_revenues")
        .select("amount")
        .eq("status", "confirmada")
        .gte("received_at", monthRange.start)
        .lt("received_at", monthRange.end),
      supabase
        .from("expenses")
        .select("amount, receipt_path")
        .eq("status", "paga")
        .gte("paid_at", monthRange.start)
        .lt("paid_at", monthRange.end),
      supabase
        .from("payment_reports")
        .select("id, amount")
        .eq("status", "pendente"),
      supabase
        .from("membership_requests")
        .select("id, status")
        .in("status", ["pendente", "com_pendencia"]),
    ]);

    const errors = [
      associatesResult.error,
      monthlyFeesResult.error,
      paymentsResult.error,
      revenuesResult.error,
      expensesResult.error,
      reportsResult.error,
      requestsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Erro ao carregar painel:", errors);
      setMessage("Não foi possível carregar todos os indicadores do painel.");
      setLoading(false);
      return;
    }

    const associates = (associatesResult.data as Associate[] | null) ?? [];
    const monthlyFees = (monthlyFeesResult.data as MonthlyFee[] | null) ?? [];
    const payments = (paymentsResult.data as Payment[] | null) ?? [];
    const revenues = (revenuesResult.data as OtherRevenue[] | null) ?? [];
    const expenses = (expensesResult.data as Expense[] | null) ?? [];
    const reports = (reportsResult.data as PaymentReport[] | null) ?? [];
    const requests = (requestsResult.data as MembershipRequest[] | null) ?? [];

    const activeAssociates = associates.filter(
      (associate) => associate.status === "ativo"
    );

    const openFeesAmount = monthlyFees.reduce((sum, fee) => {
      const remaining =
        Number(fee.total_amount ?? 0) - Number(fee.paid_amount ?? 0);

      return sum + Math.max(remaining, 0);
    }, 0);

    const delinquentAssociates = new Set(
      monthlyFees.map((fee) => fee.associate_id).filter(Boolean)
    ).size;

    const monthlyPayments = payments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    const monthlyOtherRevenues = revenues.reduce(
      (sum, revenue) => sum + Number(revenue.amount ?? 0),
      0
    );

    const monthlyExpenses = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0
    );

    const pendingReportsAmount = reports.reduce(
      (sum, report) => sum + Number(report.amount ?? 0),
      0
    );

    setData({
      activeAssociates: activeAssociates.length,
      pendingRequests: requests.length,
      openFeesCount: monthlyFees.length,
      openFeesAmount,
      delinquentAssociates,
      monthlyRevenue: monthlyPayments + monthlyOtherRevenues,
      monthlyExpenses,
      pendingReportsCount: reports.length,
      pendingReportsAmount,
      paidExpensesWithoutReceipt: expenses.filter((expense) => !expense.receipt_path)
        .length,
    });

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Visão geral
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Painel AAD 2028
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Indicadores essenciais da gestão administrativa e financeira.
              </p>
            </div>

            <div className="w-fit rounded-xl bg-white/10 px-4 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/60">
                Período
              </p>

              <p className="text-sm font-black capitalize text-white">
                {monthRange.label}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {message}
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Resultado do mês
            </p>
            <p
              className={`mt-2 text-xl font-black tracking-[-0.04em] ${
                result >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {formatCurrency(result)}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Associados ativos
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              {data.activeAssociates}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Mensalidades em aberto
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              {formatCompactCurrency(data.openFeesAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Informes pendentes
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              {data.pendingReportsCount}
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Receitas x despesas
                </h2>
                <p className="text-xs font-bold text-[#596579]">
                  Entradas e saídas confirmadas no mês.
                </p>
              </div>
            </div>

            <div className="mt-4 h-56 sm:h-64">
              {loading ? (
                <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8fa] text-sm font-bold text-[#596579]">
                  Carregando gráfico...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financialChart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#596579", fontWeight: 700 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#596579", fontWeight: 700 }}
                      width={72}
                      tickFormatter={(value) => formatCompactCurrency(Number(value))}
                    />
                    <Tooltip content={<SimpleTooltip />} cursor={{ fill: "#f7f8fa" }} />
                    <Bar dataKey="valor" radius={[10, 10, 0, 0]}>
                      {financialChart.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Associados e inadimplência
            </h2>

            <p className="text-xs font-bold text-[#596579]">
              Relação entre associados ativos e associados com mensalidade em aberto.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
              <div className="h-44">
                {loading ? (
                  <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8fa] text-sm font-bold text-[#596579]">
                    Carregando...
                  </div>
                ) : associateChart.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8fa] text-sm font-bold text-[#596579]">
                    Sem dados
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={associateChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={74}
                        paddingAngle={3}
                      >
                        {associateChart.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-[#f7f8fa] px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                    Ativos
                  </p>
                  <p className="mt-1 text-lg font-black text-[#13233a]">
                    {data.activeAssociates}
                  </p>
                </div>

                <div className="rounded-xl bg-[#fff7ed] px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.08em] text-amber-800">
                    Com pendência
                  </p>
                  <p className="mt-1 text-lg font-black text-amber-800">
                    {data.delinquentAssociates}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Solicitações pendentes
            </p>
            <p className="mt-2 text-lg font-black text-[#13233a]">
              {data.pendingRequests}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Valor informado pendente
            </p>
            <p className="mt-2 text-lg font-black text-[#13233a]">
              {formatCurrency(data.pendingReportsAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Despesas pagas sem comprovante
            </p>
            <p className="mt-2 text-lg font-black text-[#13233a]">
              {data.paidExpensesWithoutReceipt}
            </p>
          </div>
        </section>
      </div>
    </ProtectedDashboard>
  );
}
