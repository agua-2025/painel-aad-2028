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
      .order("year", { ascending: false })
      .order("month", { ascending: false });

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
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Gestão financeira
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Inadimplência
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Acompanhe mensalidades em aberto, atrasos, pagamentos parciais e valores atualizados com encargos.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Mensalidades abertas</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.calculatedFees.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Com encargos</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.overdueFees.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Pagas parcialmente</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.partialFees.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Total em aberto</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.totalOpen)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Mensalidades em aberto
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Valores calculados até hoje. Para baixa manual, utilize o módulo de mensalidades.
              </p>
            </div>

            <button
              type="button"
              onClick={loadFees}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando inadimplência...
            </div>
          ) : message ? (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {message}
            </div>
          ) : summary.calculatedFees.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhuma mensalidade em aberto
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Não há pendências financeiras registradas no momento.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {summary.calculatedFees.map(({ fee, calculated, remaining, associate }) => (
                <article
                  key={fee.id}
                  className="rounded-3xl border border-[#e8dccb] bg-white p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                        {getMonthLabel(fee)}
                      </p>

                      <h3 className="mt-2 text-xl font-black text-[#13233a]">
                        {associate?.full_name ?? "Associado não localizado"}
                      </h3>

                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        {associate?.email || "E-mail não informado"}
                        {associate?.phone ? ` · ${associate.phone}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                        {statusLabels[fee.status] ?? fee.status}
                      </span>

                      {calculated.daysWithCharges > 0 && (
                        <span className="w-fit rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-amber-900">
                          Com encargos
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-3">
                    <p>
                      <strong>Vencimento:</strong> {formatDate(fee.due_date)}
                    </p>

                    <p>
                      <strong>Valor base:</strong> {formatCurrency(fee.base_amount)}
                    </p>

                    <p>
                      <strong>Pago:</strong> {formatCurrency(fee.paid_amount)}
                    </p>

                    <p>
                      <strong>Multa:</strong> {formatCurrency(calculated.lateFeeAmount)}
                    </p>

                    <p>
                      <strong>Juros:</strong> {formatCurrency(calculated.interestAmount)}
                    </p>

                    <p>
                      <strong>Dias com encargos:</strong> {calculated.daysWithCharges}
                    </p>

                    <p className="md:col-span-3 rounded-2xl bg-[#f7f8fa] p-3 text-base font-black text-[#13233a]">
                      Total em aberto hoje: {formatCurrency(remaining)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
