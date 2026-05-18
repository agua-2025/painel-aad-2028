"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type MonthlyFee = {
  id: string;
  associate_id: string;
  year: number;
  month: number;
  base_amount: number;
  due_date: string;
  late_fee_percent: number;
  daily_interest_percent: number;
  late_fee_amount: number;
  interest_amount: number;
  total_amount: number;
  paid_amount: number;
  paid_at: string | null;
  status: string;
  notes: string | null;
  associates:
    | {
        full_name: string;
        email: string | null;
        phone: string | null;
        status: string;
      }
    | {
        full_name: string;
        email: string | null;
        phone: string | null;
        status: string;
      }[]
    | null;
  financial_settings:
    | {
        late_fee_grace_days: number;
      }
    | {
        late_fee_grace_days: number;
      }[]
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

const statusLabels: Record<string, string> = {
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

function getMonthLabel(fee: MonthlyFee) {
  return `${monthNames[Number(fee.month) - 1]} de ${fee.year}`;
}

function getAssociate(fee: MonthlyFee) {
  if (Array.isArray(fee.associates)) {
    return fee.associates[0] ?? null;
  }

  return fee.associates ?? null;
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
      daysAfterDue: 0,
      daysWithCharges: 0,
      lateFeeAmount: 0,
      interestAmount: 0,
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

  const totalDue = Number((baseAmount + lateFeeAmount + interestAmount).toFixed(2));

  return {
    daysAfterDue,
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
  };
}

function isOpenFee(fee: MonthlyFee) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(fee.status);
}

export default function DashboardInadimplenciaPage() {
  const [fees, setFees] = useState<MonthlyFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const summary = useMemo(() => {
    const openFees = fees.filter(isOpenFee);

    const calculatedFees = openFees.map((fee) => {
      const calculated = calculateAmountDueAtDate(fee, today);
      const remaining = Math.max(
        calculated.totalDue - Number(fee.paid_amount ?? 0),
        0
      );

      return {
        fee,
        calculated,
        remaining,
        associate: getAssociate(fee),
      };
    });

    const overdueFees = calculatedFees.filter(
      (item) => item.calculated.daysWithCharges > 0 && item.remaining > 0
    );

    const partialFees = calculatedFees.filter(
      (item) => item.fee.status === "parcialmente_paga" && item.remaining > 0
    );

    const totalOpen = calculatedFees.reduce(
      (sum, item) => sum + item.remaining,
      0
    );

    const totalOverdue = overdueFees.reduce(
      (sum, item) => sum + item.remaining,
      0
    );

    return {
      calculatedFees,
      overdueFees,
      partialFees,
      totalOpen,
      totalOverdue,
    };
  }, [fees, today]);

  async function loadFees() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("monthly_fees")
      .select(
        "id, associate_id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, late_fee_amount, interest_amount, total_amount, paid_amount, paid_at, status, notes, associates(full_name, email, phone, status), financial_settings(late_fee_grace_days)"
      )
      .in("status", ["pendente", "parcialmente_paga", "atrasada"])
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    if (error) {
      console.error("Erro ao carregar inadimplência:", error);
      setMessage(error.message || "Não foi possível carregar as mensalidades em aberto.");
      setLoading(false);
      return;
    }

    setFees((data as unknown as MonthlyFee[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadFees();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Gestão financeira
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Inadimplência
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Acompanhe mensalidades em aberto, atrasos, pagamentos parciais e valores atualizados com encargos.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Mensalidades abertas</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
              {summary.calculatedFees.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Com encargos</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
              {summary.overdueFees.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Pagas parcialmente</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
              {summary.partialFees.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Total em aberto</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
              {formatCurrency(summary.totalOpen)}
            </p>
          </div>
        </section>

        <p className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Orientação: confira sempre o associado, o mês de referência, o vencimento e a data efetiva do pagamento antes da baixa.
        </p>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Mensalidades em aberto
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Valores calculados até hoje. Para baixa manual, utilize o módulo de mensalidades.
              </p>
            </div>

            <button
              type="button"
              onClick={loadFees}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando inadimplência...
            </div>
          ) : message ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {message}
            </div>
          ) : summary.calculatedFees.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhuma mensalidade em aberto
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                Não há pendências financeiras registradas no momento.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] lg:grid">
                <div className="col-span-3">Associado</div>
                <div className="col-span-2">Referência</div>
                <div className="col-span-2 text-right">Valor/Pago</div>
                <div className="col-span-2 text-right">Encargos</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-right">Aberto hoje</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {summary.calculatedFees.map(({ fee, calculated, remaining, associate }) => (
                  <article
                    key={fee.id}
                    className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-12 lg:items-center"
                  >
                    <div className="lg:col-span-3">
                      <p className="font-black text-[#13233a]">
                        {associate?.full_name ?? "Associado não localizado"}
                      </p>

                      <p className="mt-0.5 text-xs font-bold text-[#596579]">
                        {associate?.email || "E-mail não informado"}
                      </p>

                      {associate?.phone && (
                        <p className="mt-0.5 text-xs font-bold text-[#596579]">
                          {associate.phone}
                        </p>
                      )}
                    </div>

                    <div className="font-bold text-[#596579] lg:col-span-2">
                      <p className="font-black text-[#13233a]">
                        {getMonthLabel(fee)}
                      </p>

                      <p className="text-xs">
                        Venc.: {formatDate(fee.due_date)}
                      </p>
                    </div>

                    <div className="font-bold text-[#596579] lg:col-span-2 lg:text-right">
                      <p>
                        Base: {formatCurrency(fee.base_amount)}
                      </p>

                      <p className="text-xs">
                        Pago: {formatCurrency(fee.paid_amount)}
                      </p>
                    </div>

                    <div className="font-bold text-[#596579] lg:col-span-2 lg:text-right">
                      <p>
                        Multa: {formatCurrency(calculated.lateFeeAmount)}
                      </p>

                      <p className="text-xs">
                        Juros: {formatCurrency(calculated.interestAmount)}
                      </p>

                      <p className="text-xs">
                        Dias: {calculated.daysWithCharges}
                      </p>
                    </div>

                    <div className="lg:col-span-1 lg:text-center">
                      <div className="flex flex-wrap gap-1.5 lg:justify-center">
                        <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                          {statusLabels[fee.status] ?? fee.status}
                        </span>

                        {calculated.daysWithCharges > 0 && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-amber-900">
                            Encargos
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-black text-red-700 lg:col-span-2 lg:text-right">
                      {formatCurrency(remaining)}
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
