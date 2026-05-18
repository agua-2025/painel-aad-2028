"use client";

import { useEffect, useMemo, useState } from "react";
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

function getOriginType(payment: Payment) {
  if (payment.extra_contribution_item_id) {
    return "extra";
  }

  return "monthly";
}

function getOriginBadge(payment: Payment) {
  if (getOriginType(payment) === "extra") {
    return "Contribuição extra";
  }

  return "Mensalidade";
}

function getOriginLabel(payment: Payment) {
  if (getOriginType(payment) === "extra") {
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

function getPaymentMonth(value: string) {
  if (!value) return "";

  return value.slice(0, 7);
}

export default function DashboardMovimentoFinanceiroPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    origin: "todos",
  });

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const sameMonth = getPaymentMonth(payment.paid_at) === filters.month;
      const originType = getOriginType(payment);

      const originMatches =
        filters.origin === "todos" || filters.origin === originType;

      return sameMonth && originMatches;
    });
  }, [payments, filters.month, filters.origin]);

  const summary = useMemo(() => {
    const totalReceived = filteredPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    const monthlyPayments = filteredPayments.filter(
      (payment) => getOriginType(payment) === "monthly"
    );

    const extraPayments = filteredPayments.filter(
      (payment) => getOriginType(payment) === "extra"
    );

    const monthlyTotal = monthlyPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    const extraTotal = extraPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    return {
      totalReceived,
      monthlyTotal,
      extraTotal,
      totalCount: filteredPayments.length,
      monthlyCount: monthlyPayments.length,
      extraCount: extraPayments.length,
    };
  }, [filteredPayments]);

  async function loadPayments() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("payments")
      .select(
        "id, associate_id, monthly_fee_id, extra_contribution_item_id, amount, paid_at, payment_method, reference, notes, created_at, associates(full_name, email, phone), monthly_fees(year, month, due_date, status), extra_contribution_items(due_date, status, extra_contributions(title, description, reason, status))"
      )
      .order("paid_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar movimento financeiro:", error);
      setMessage(error.message || "Não foi possível carregar o movimento financeiro.");
      setLoading(false);
      return;
    }

    setPayments((data as unknown as Payment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadPayments();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Caixa
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Movimento Financeiro
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Acompanhe as entradas financeiras já baixadas pela Tesouraria e identifique a origem de cada recebimento.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Esta tela mostra somente entradas já registradas em pagamentos. Despesas e conciliação bancária serão tratadas em etapa própria.
        </p>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Mês do recebimento
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
                className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
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
                className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              >
                <option value="todos">Todas as origens</option>
                <option value="monthly">Mensalidades</option>
                <option value="extra">Contribuições extras</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadPayments}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:col-span-2">
            <p className="text-sm font-bold text-[#596579]">
              Total recebido no período
            </p>

            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.totalReceived)}
            </p>

            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.totalCount} recebimento(s)
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Mensalidades</p>

            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.monthlyTotal)}
            </p>

            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.monthlyCount} baixa(s)
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">
              Contribuições extras
            </p>

            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.extraTotal)}
            </p>

            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.extraCount} baixa(s)
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Entradas do período
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Cada registro abaixo representa dinheiro efetivamente baixado no sistema.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando movimento financeiro...
            </div>
          ) : message ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {message}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhuma entrada neste período
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Não há pagamentos recebidos no mês e origem selecionados.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {filteredPayments.map((payment) => {
                const associate = getAssociate(payment);

                return (
                  <article
                    key={payment.id}
                    className="rounded-3xl border border-[#e8dccb] p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                            {getOriginLabel(payment)}
                          </p>

                          <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {getOriginBadge(payment)}
                          </span>
                        </div>

                        <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                          {formatCurrency(payment.amount)}
                        </h3>

                        <p className="mt-1 text-sm font-bold text-[#596579]">
                          {associate?.full_name ?? "Associado não localizado"}
                          {associate?.email ? ` · ${associate.email}` : ""}
                        </p>
                      </div>

                      <div className="text-left lg:text-right">
                        <p className="text-sm font-black text-[#13233a]">
                          {formatDate(payment.paid_at)}
                        </p>

                        <p className="mt-1 text-sm font-bold text-[#596579]">
                          {paymentMethodLabels[payment.payment_method] ??
                            payment.payment_method}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-[#596579] md:grid-cols-2">
                      <p>
                        <strong>Referência:</strong>{" "}
                        {payment.reference || "Não informado"}
                      </p>

                      <p>
                        <strong>Registro no sistema:</strong>{" "}
                        {formatDate(payment.created_at)}
                      </p>
                    </div>

                    {payment.notes && (
                      <p className="mt-3 whitespace-pre-line rounded-2xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                        {payment.notes}
                      </p>
                    )}
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
