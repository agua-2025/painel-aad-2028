"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type AssociateData = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

type MonthlyFeeData = {
  year: number;
  month: number;
  due_date: string;
  status: string;
};

type ExtraContributionData = {
  title: string;
  description: string | null;
  reason: string | null;
  status: string;
};

type ExtraContributionItemData = {
  due_date: string;
  status: string;
  extra_contributions:
    | ExtraContributionData
    | ExtraContributionData[]
    | null;
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
  extra_contribution_items:
    | ExtraContributionItemData
    | ExtraContributionItemData[]
    | null;
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
  created_at: string;
  direction: "entrada" | "saida";
  origin: "monthly" | "extra" | "other" | "expense";
  originBadge: string;
  title: string;
  amount: number;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  person: string;
  personDetail: string | null;
  status: string;
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

const otherRevenueCategoryLabels: Record<string, string> = {
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

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthToDate(month: string) {
  return `${month}-01`;
}

function getMonthFromDate(value: string) {
  return value ? value.slice(0, 7) : "";
}

function getAssociate(payment: Payment) {
  if (Array.isArray(payment.associates)) {
    return payment.associates[0] ?? null;
  }

  return payment.associates ?? null;
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

function getExtraContribution(item: ExtraContributionItemData | null) {
  if (!item) return null;

  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function getPaymentOriginType(payment: Payment): "monthly" | "extra" {
  if (payment.extra_contribution_item_id) {
    return "extra";
  }

  return "monthly";
}

function getPaymentOriginLabel(payment: Payment) {
  if (getPaymentOriginType(payment) === "extra") {
    const item = getExtraItem(payment);
    const contribution = getExtraContribution(item);

    return contribution?.title ?? "Contribuição extra";
  }

  const fee = getMonthlyFee(payment);

  if (!fee) {
    return "Mensalidade não localizada";
  }

  const monthName = monthNames[Number(fee.month) - 1];

  return `${monthName} de ${fee.year}`;
}

function buildPaymentMovement(payment: Payment): Movement {
  const associate = getAssociate(payment);
  const origin = getPaymentOriginType(payment);

  return {
    id: `payment-${payment.id}`,
    date: payment.paid_at,
    created_at: payment.created_at,
    direction: "entrada",
    origin,
    originBadge: origin === "monthly" ? "Mensalidade" : "Contribuição extra",
    title: getPaymentOriginLabel(payment),
    amount: Number(payment.amount ?? 0),
    payment_method: payment.payment_method,
    reference: payment.reference,
    notes: payment.notes,
    person: associate?.full_name ?? "Associado não localizado",
    personDetail: associate?.email ?? null,
    status: "confirmada",
  };
}

function buildOtherRevenueMovement(revenue: OtherRevenue): Movement {
  return {
    id: `other-${revenue.id}`,
    date: revenue.received_at,
    created_at: revenue.created_at,
    direction: "entrada",
    origin: "other",
    originBadge: "Receita avulsa",
    title: `${otherRevenueCategoryLabels[revenue.category] ?? revenue.category} - ${revenue.description}`,
    amount: Number(revenue.amount ?? 0),
    payment_method: revenue.payment_method,
    reference: revenue.reference,
    notes: revenue.notes,
    person: revenue.payer_name || "Pagador não informado",
    personDetail: null,
    status: revenue.status,
  };
}

function buildExpenseMovement(expense: Expense): Movement {
  return {
    id: `expense-${expense.id}`,
    date: expense.paid_at ?? expense.expense_date,
    created_at: expense.created_at,
    direction: "saida",
    origin: "expense",
    originBadge: "Despesa",
    title: `${expenseCategoryLabels[expense.category] ?? expense.category} - ${expense.description}`,
    amount: Number(expense.amount ?? 0),
    payment_method: expense.payment_method,
    reference: expense.reference,
    notes: expense.notes,
    person: expense.payee_name || "Favorecido não informado",
    personDetail: null,
    status: expense.status,
  };
}

function getAmountClass(direction: "entrada" | "saida") {
  return direction === "saida" ? "text-red-700" : "text-green-700";
}

function getDirectionLabel(direction: "entrada" | "saida") {
  return direction === "entrada" ? "Entrada" : "Saída";
}

export default function DashboardMovimentoFinanceiroPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [otherRevenues, setOtherRevenues] = useState<OtherRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashBalance, setCashBalance] = useState<CashMonthlyBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    origin: "todos",
  });

  const movements = useMemo(() => {
    const paymentMovements = payments.map(buildPaymentMovement);

    const otherRevenueMovements = otherRevenues
      .filter((revenue) => revenue.status === "confirmada")
      .map(buildOtherRevenueMovement);

    const expenseMovements = expenses
      .filter((expense) => expense.status === "paga" && expense.paid_at)
      .map(buildExpenseMovement);

    return [...paymentMovements, ...otherRevenueMovements, ...expenseMovements].sort(
      (a, b) => {
        const dateCompare = b.date.localeCompare(a.date);

        if (dateCompare !== 0) return dateCompare;

        return b.created_at.localeCompare(a.created_at);
      }
    );
  }, [payments, otherRevenues, expenses]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const sameMonth = getMonthFromDate(movement.date) === filters.month;

      const originMatches =
        filters.origin === "todos" || filters.origin === movement.origin;

      return sameMonth && originMatches;
    });
  }, [movements, filters.month, filters.origin]);

  const summary = useMemo(() => {
    const entries = filteredMovements.filter(
      (movement) => movement.direction === "entrada"
    );

    const exits = filteredMovements.filter(
      (movement) => movement.direction === "saida"
    );

    const totalEntries = entries.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    const totalExits = exits.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    const openingBalance = Number(cashBalance?.opening_balance ?? 0);
    const periodBalance = Number((totalEntries - totalExits).toFixed(2));
    const finalBalance = Number((openingBalance + periodBalance).toFixed(2));

    const monthlyMovements = filteredMovements.filter(
      (movement) => movement.origin === "monthly"
    );

    const extraMovements = filteredMovements.filter(
      (movement) => movement.origin === "extra"
    );

    const otherMovements = filteredMovements.filter(
      (movement) => movement.origin === "other"
    );

    const expenseMovements = filteredMovements.filter(
      (movement) => movement.origin === "expense"
    );

    const monthlyTotal = monthlyMovements.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    const extraTotal = extraMovements.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    const otherTotal = otherMovements.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    const expenseTotal = expenseMovements.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    return {
      openingBalance,
      totalEntries,
      totalExits,
      periodBalance,
      finalBalance,
      monthlyTotal,
      extraTotal,
      otherTotal,
      expenseTotal,
      totalCount: filteredMovements.length,
      entriesCount: entries.length,
      exitsCount: exits.length,
      monthlyCount: monthlyMovements.length,
      extraCount: extraMovements.length,
      otherCount: otherMovements.length,
      expenseCount: expenseMovements.length,
    };
  }, [filteredMovements, cashBalance]);

  async function loadMovements() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id, associate_id, monthly_fee_id, extra_contribution_item_id, amount, paid_at, payment_method, reference, notes, created_at, associates(full_name, email, phone), monthly_fees(year, month, due_date, status), extra_contribution_items(due_date, status, extra_contributions(title, description, reason, status))"
      )
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error("Erro ao carregar pagamentos:", paymentsError);
      setMessage(paymentsError.message || "Não foi possível carregar os pagamentos.");
      setLoading(false);
      return;
    }

    const { data: revenuesData, error: revenuesError } = await supabase
      .from("other_revenues")
      .select(
        "id, received_at, amount, category, payer_name, description, payment_method, reference, notes, status, created_at"
      )
      .eq("status", "confirmada")
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (revenuesError) {
      console.error("Erro ao carregar receitas avulsas:", revenuesError);
      setMessage(
        revenuesError.message || "Não foi possível carregar as receitas avulsas."
      );
      setLoading(false);
      return;
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, due_date, paid_at, amount, category, payee_name, description, payment_method, reference, notes, status, created_at"
      )
      .eq("status", "paga")
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (expensesError) {
      console.error("Erro ao carregar despesas:", expensesError);
      setMessage(expensesError.message || "Não foi possível carregar as despesas.");
      setLoading(false);
      return;
    }

    const { data: balanceData, error: balanceError } = await supabase
      .from("cash_monthly_balances")
      .select("id, month_ref, opening_balance, notes")
      .eq("month_ref", monthToDate(filters.month))
      .maybeSingle();

    if (balanceError) {
      console.error("Erro ao carregar saldo inicial:", balanceError);
      setMessage(balanceError.message || "Não foi possível carregar o saldo inicial.");
      setLoading(false);
      return;
    }

    setPayments((paymentsData as unknown as Payment[]) ?? []);
    setOtherRevenues((revenuesData as unknown as OtherRevenue[]) ?? []);
    setExpenses((expensesData as unknown as Expense[]) ?? []);
    setCashBalance((balanceData as unknown as CashMonthlyBalance) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.month]);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Caixa
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Movimento Financeiro
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Acompanhe entradas, saídas, saldo inicial e saldo final do período.
          </p>
        </section>

        {!cashBalance && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-900">
            Atenção: não há saldo inicial cadastrado para este mês. O saldo final será calculado considerando saldo inicial igual a R$ 0,00.{" "}
            <Link href="/dashboard/saldos-caixa" className="underline">
              Cadastrar saldo inicial
            </Link>
          </p>
        )}

        {cashBalance?.notes && (
          <p className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2.5 text-sm font-bold text-[#596579]">
            Observação do saldo inicial: {cashBalance.notes}
          </p>
        )}

        <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Mês do movimento
              </span>

              <input
                type="month"
                value={filters.month}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    month: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Origem
              </span>

              <select
                value={filters.origin}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    origin: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
              >
                <option value="todos">Todas as movimentações</option>
                <option value="monthly">Mensalidades</option>
                <option value="extra">Contribuições extras</option>
                <option value="other">Receitas avulsas</option>
                <option value="expense">Despesas</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadMovements}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Saldo inicial
            </p>

            <p className="mt-1 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              {formatCurrency(summary.openingBalance)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              {cashBalance ? "Cadastrado para o mês" : "Não cadastrado"}
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-green-800">
              Entradas
            </p>

            <p className="mt-1 text-xl font-black tracking-[-0.04em] text-green-800">
              {formatCurrency(summary.totalEntries)}
            </p>

            <p className="mt-1 text-xs font-bold text-green-800/80">
              {summary.entriesCount} entrada(s)
            </p>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-red-800">
              Saídas
            </p>

            <p className="mt-1 text-xl font-black tracking-[-0.04em] text-red-800">
              {formatCurrency(summary.totalExits)}
            </p>

            <p className="mt-1 text-xs font-bold text-red-800/80">
              {summary.exitsCount} saída(s)
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Saldo final
            </p>

            <p
              className={`mt-1 text-xl font-black tracking-[-0.04em] ${
                summary.finalBalance < 0 ? "text-red-700" : "text-[#13233a]"
              }`}
            >
              {formatCurrency(summary.finalBalance)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              Inicial + entradas - saídas
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Resultado do mês
            </p>

            <p
              className={`mt-1 text-lg font-black tracking-[-0.04em] ${
                summary.periodBalance < 0 ? "text-red-700" : "text-[#13233a]"
              }`}
            >
              {formatCurrency(summary.periodBalance)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              Entradas - saídas
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Mensalidades
            </p>

            <p className="mt-1 text-lg font-black tracking-[-0.04em] text-[#13233a]">
              {formatCurrency(summary.monthlyTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              {summary.monthlyCount} baixa(s)
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Contribuições extras
            </p>

            <p className="mt-1 text-lg font-black tracking-[-0.04em] text-[#13233a]">
              {formatCurrency(summary.extraTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              {summary.extraCount} baixa(s)
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Receitas avulsas
            </p>

            <p className="mt-1 text-lg font-black tracking-[-0.04em] text-[#13233a]">
              {formatCurrency(summary.otherTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              {summary.otherCount} registro(s)
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Despesas pagas
            </p>

            <p className="mt-1 text-lg font-black tracking-[-0.04em] text-red-700">
              {formatCurrency(summary.expenseTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              {summary.expenseCount} saída(s)
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Movimentações do período
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Entradas e saídas efetivamente registradas no sistema.
              </p>
            </div>

            <p className="text-xs font-bold text-[#596579]">
              {filteredMovements.length} registro(s)
            </p>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando movimento financeiro...
            </div>
          ) : message ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {message}
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhuma movimentação neste período
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                Não há entradas ou saídas confirmadas para o mês e origem selecionados.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                <div className="col-span-1">Data</div>
                <div className="col-span-2">Tipo/Origem</div>
                <div className="col-span-3">Descrição</div>
                <div className="col-span-2">Pessoa</div>
                <div className="col-span-2">Forma/Referência</div>
                <div className="col-span-2 text-right">Valor</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {filteredMovements.map((movement) => (
                  <article
                    key={movement.id}
                    className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                  >
                    <div className="font-bold text-[#13233a] md:col-span-1">
                      {formatDate(movement.date)}
                    </div>

                    <div className="md:col-span-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${
                            movement.direction === "saida"
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {getDirectionLabel(movement.direction)}
                        </span>

                        <span className="rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                          {movement.originBadge}
                        </span>
                      </div>
                    </div>

                    <div className="md:col-span-3">
                      <p className="font-black text-[#13233a]">
                        {movement.title}
                      </p>

                      {movement.notes && (
                        <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#596579]">
                          {movement.notes}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <p className="font-bold text-[#13233a]">
                        {movement.person}
                      </p>

                      {movement.personDetail && (
                        <p className="mt-0.5 text-xs font-bold text-[#596579]">
                          {movement.personDetail}
                        </p>
                      )}
                    </div>

                    <div className="font-bold text-[#596579] md:col-span-2">
                      <p>
                        {movement.payment_method
                          ? paymentMethodLabels[movement.payment_method] ??
                            movement.payment_method
                          : "Não informado"}
                      </p>

                      <p className="text-xs">
                        Ref.: {movement.reference || "Não informada"}
                      </p>
                    </div>

                    <div
                      className={`font-black md:col-span-2 md:text-right ${getAmountClass(
                        movement.direction
                      )}`}
                    >
                      {movement.direction === "saida" ? "- " : "+ "}
                      {formatCurrency(movement.amount)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
