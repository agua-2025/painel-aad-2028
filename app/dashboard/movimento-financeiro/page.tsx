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

type Movement = {
  id: string;
  date: string;
  created_at: string;
  origin: "monthly" | "extra" | "other";
  originBadge: string;
  title: string;
  amount: number;
  payment_method: string;
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

export default function DashboardMovimentoFinanceiroPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [otherRevenues, setOtherRevenues] = useState<OtherRevenue[]>([]);
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

    return [...paymentMovements, ...otherRevenueMovements].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);

      if (dateCompare !== 0) return dateCompare;

      return b.created_at.localeCompare(a.created_at);
    });
  }, [payments, otherRevenues]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      const sameMonth = getMonthFromDate(movement.date) === filters.month;

      const originMatches =
        filters.origin === "todos" || filters.origin === movement.origin;

      return sameMonth && originMatches;
    });
  }, [movements, filters.month, filters.origin]);

  const summary = useMemo(() => {
    const totalReceived = filteredMovements.reduce(
      (sum, movement) => sum + Number(movement.amount ?? 0),
      0
    );

    const monthlyMovements = filteredMovements.filter(
      (movement) => movement.origin === "monthly"
    );

    const extraMovements = filteredMovements.filter(
      (movement) => movement.origin === "extra"
    );

    const otherMovements = filteredMovements.filter(
      (movement) => movement.origin === "other"
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

    return {
      totalReceived,
      monthlyTotal,
      extraTotal,
      otherTotal,
      totalCount: filteredMovements.length,
      monthlyCount: monthlyMovements.length,
      extraCount: extraMovements.length,
      otherCount: otherMovements.length,
    };
  }, [filteredMovements]);

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

    setPayments((paymentsData as unknown as Payment[]) ?? []);
    setOtherRevenues((revenuesData as unknown as OtherRevenue[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadMovements();
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
            Acompanhe as entradas financeiras já registradas pela Tesouraria e identifique a origem de cada recebimento.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Esta tela mostra entradas confirmadas: mensalidades, contribuições extras e receitas avulsas. Despesas e conciliação bancária serão tratadas em etapa própria.
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
                <option value="other">Receitas avulsas</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadMovements}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:col-span-1">
            <p className="text-sm font-bold text-[#596579]">
              Total recebido
            </p>

            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.totalReceived)}
            </p>

            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.totalCount} entrada(s)
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

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">
              Receitas avulsas
            </p>

            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.otherTotal)}
            </p>

            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.otherCount} registro(s)
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
                Cada registro abaixo representa dinheiro efetivamente registrado no sistema.
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
          ) : filteredMovements.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhuma entrada neste período
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Não há entradas confirmadas para o mês e origem selecionados.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-3xl border border-[#e8dccb]">
              <div className="hidden md:block">
                <table className="w-full border-collapse bg-white text-left text-sm">
                  <thead className="bg-[#f7f8fa] text-xs uppercase tracking-[0.08em] text-[#596579]">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Origem</th>
                      <th className="px-4 py-3">Descrição</th>
                      <th className="px-4 py-3">Pessoa</th>
                      <th className="px-4 py-3">Forma</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredMovements.map((movement) => (
                      <tr
                        key={movement.id}
                        className="border-t border-[#e8dccb] align-top"
                      >
                        <td className="px-4 py-3 font-bold text-[#13233a]">
                          {formatDate(movement.date)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {movement.originBadge}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-black text-[#13233a]">
                            {movement.title}
                          </p>

                          <p className="mt-1 text-xs font-bold text-[#596579]">
                            Ref.: {movement.reference || "Não informado"}
                          </p>

                          {movement.notes && (
                            <p className="mt-2 line-clamp-2 text-xs text-[#596579]">
                              {movement.notes}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-bold text-[#13233a]">
                            {movement.person}
                          </p>

                          {movement.personDetail && (
                            <p className="mt-1 text-xs font-bold text-[#596579]">
                              {movement.personDetail}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 font-bold text-[#596579]">
                          {paymentMethodLabels[movement.payment_method] ??
                            movement.payment_method}
                        </td>

                        <td className="px-4 py-3 text-right font-black text-[#13233a]">
                          {formatCurrency(movement.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 bg-white p-3 md:hidden">
                {filteredMovements.map((movement) => (
                  <article
                    key={movement.id}
                    className="rounded-2xl border border-[#e8dccb] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                        {movement.originBadge}
                      </span>

                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#c7a56b]">
                        {formatDate(movement.date)}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-black tracking-[-0.04em] text-[#13233a]">
                      {formatCurrency(movement.amount)}
                    </h3>

                    <p className="mt-1 text-sm font-bold text-[#13233a]">
                      {movement.title}
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#596579]">
                      {movement.person}
                    </p>

                    <div className="mt-3 grid gap-2 text-sm text-[#596579]">
                      <p>
                        <strong>Forma:</strong>{" "}
                        {paymentMethodLabels[movement.payment_method] ??
                          movement.payment_method}
                      </p>

                      <p>
                        <strong>Referência:</strong>{" "}
                        {movement.reference || "Não informado"}
                      </p>
                    </div>

                    {movement.notes && (
                      <p className="mt-3 whitespace-pre-line rounded-2xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                        {movement.notes}
                      </p>
                    )}
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
