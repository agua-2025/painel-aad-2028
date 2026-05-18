"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type MonthlyClosing = {
  id: string;
  month_ref: string;
  status: string;
  final_balance: number;
  bank_balance: number | null;
  difference_amount: number | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  closed_at: string;
};

type CashMonthlyBalance = {
  id: string;
  month_ref: string;
  opening_balance: number;
  notes: string | null;
};

type CheckRow = {
  month_ref: string;
  next_month_ref: string;
  month_label: string;
  next_month_label: string;
  closing: MonthlyClosing;
  nextBalance: CashMonthlyBalance | null;
  difference: number | null;
  status: "ok" | "divergente" | "sem_saldo_seguinte" | "mes_reaberto";
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

function getMonthFromDate(value?: string | null) {
  return value ? value.slice(0, 7) : "";
}

function formatMonthFromDate(value: string) {
  const month = getMonthFromDate(value);
  const [year, monthNumber] = month.split("-");
  const index = Number(monthNumber) - 1;

  return `${monthNames[index] ?? monthNumber} de ${year}`;
}

function getNextMonthRef(monthRef: string) {
  const date = new Date(`${monthRef.slice(0, 10)}T00:00:00`);
  date.setMonth(date.getMonth() + 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function getStatusLabel(status: CheckRow["status"]) {
  if (status === "ok") return "Conferido";
  if (status === "divergente") return "Divergente";
  if (status === "mes_reaberto") return "Mês reaberto";
  return "Sem saldo seguinte";
}

export default function DashboardConferenciaSaldosPage() {
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [balances, setBalances] = useState<CashMonthlyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const rows = useMemo<CheckRow[]>(() => {
    return closings.map((closing) => {
      const nextMonthRef = getNextMonthRef(closing.month_ref);
      const nextBalance =
        balances.find((balance) => balance.month_ref === nextMonthRef) ?? null;

      if (closing.status === "reaberto") {
        return {
          month_ref: closing.month_ref,
          next_month_ref: nextMonthRef,
          month_label: formatMonthFromDate(closing.month_ref),
          next_month_label: formatMonthFromDate(nextMonthRef),
          closing,
          nextBalance,
          difference: null,
          status: "mes_reaberto",
        };
      }

      if (!nextBalance) {
        return {
          month_ref: closing.month_ref,
          next_month_ref: nextMonthRef,
          month_label: formatMonthFromDate(closing.month_ref),
          next_month_label: formatMonthFromDate(nextMonthRef),
          closing,
          nextBalance,
          difference: null,
          status: "sem_saldo_seguinte",
        };
      }

      const difference = Number(
        (Number(nextBalance.opening_balance ?? 0) - Number(closing.final_balance ?? 0)).toFixed(2)
      );

      return {
        month_ref: closing.month_ref,
        next_month_ref: nextMonthRef,
        month_label: formatMonthFromDate(closing.month_ref),
        next_month_label: formatMonthFromDate(nextMonthRef),
        closing,
        nextBalance,
        difference,
        status: Math.abs(difference) < 0.01 ? "ok" : "divergente",
      };
    });
  }, [closings, balances]);

  const summary = useMemo(() => {
    return {
      total: rows.length,
      ok: rows.filter((row) => row.status === "ok").length,
      divergent: rows.filter((row) => row.status === "divergente").length,
      missingNextBalance: rows.filter((row) => row.status === "sem_saldo_seguinte").length,
      reopened: rows.filter((row) => row.status === "mes_reaberto").length,
    };
  }, [rows]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data: closingsData, error: closingsError } = await supabase
      .from("monthly_closings")
      .select(
        "id, month_ref, status, final_balance, bank_balance, difference_amount, reopened_at, reopen_reason, closed_at"
      )
      .order("month_ref", { ascending: false });

    if (closingsError) {
      setMessage(closingsError.message || "Não foi possível carregar os fechamentos.");
      setLoading(false);
      return;
    }

    const { data: balancesData, error: balancesError } = await supabase
      .from("cash_monthly_balances")
      .select("id, month_ref, opening_balance, notes")
      .order("month_ref", { ascending: false });

    if (balancesError) {
      setMessage(balancesError.message || "Não foi possível carregar os saldos.");
      setLoading(false);
      return;
    }

    setClosings((closingsData as unknown as MonthlyClosing[]) ?? []);
    setBalances((balancesData as unknown as CashMonthlyBalance[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
            Caixa
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Conferência de Saldos
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Verifique se o saldo final de cada mês confere com o saldo inicial do mês seguinte.
          </p>
        </section>

        {message && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-red-700">{message}</p>
          </section>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Resumo da conferência
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                O saldo final fechado de um mês deve ser igual ao saldo inicial cadastrado no mês seguinte.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
                Total
              </p>
              <p className="mt-1 text-xl font-black text-[#13233a]">{summary.total}</p>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-green-800">
                Conferidos
              </p>
              <p className="mt-1 text-xl font-black text-green-800">{summary.ok}</p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-red-800">
                Divergentes
              </p>
              <p className="mt-1 text-xl font-black text-red-800">{summary.divergent}</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-amber-800">
                Sem saldo
              </p>
              <p className="mt-1 text-xl font-black text-amber-800">
                {summary.missingNextBalance}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-amber-800">
                Reabertos
              </p>
              <p className="mt-1 text-xl font-black text-amber-800">{summary.reopened}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
            Resultado da conferência
          </h2>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando conferência de saldos...
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <p className="text-sm font-bold text-[#596579]">
                Nenhum fechamento mensal encontrado.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                <div className="col-span-2">Mês fechado</div>
                <div className="col-span-2">Mês seguinte</div>
                <div className="col-span-2 text-right">Saldo final</div>
                <div className="col-span-2 text-right">Saldo inicial seguinte</div>
                <div className="col-span-2 text-right">Diferença</div>
                <div className="col-span-2 text-right">Situação</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {rows.map((row) => (
                  <article
                    key={row.closing.id}
                    className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                  >
                    <div className="md:col-span-2">
                      <p className="font-black text-[#13233a]">{row.month_label}</p>
                      <p className="text-xs font-bold text-[#596579]">
                        Fechado em {formatDate(row.closing.closed_at)}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <p className="font-bold text-[#13233a]">{row.next_month_label}</p>
                      <p className="text-xs font-bold text-[#596579]">
                        Saldo inicial esperado
                      </p>
                    </div>

                    <div className="font-black text-[#13233a] md:col-span-2 md:text-right">
                      {formatCurrency(row.closing.final_balance)}
                    </div>

                    <div className="font-black text-[#13233a] md:col-span-2 md:text-right">
                      {row.nextBalance
                        ? formatCurrency(row.nextBalance.opening_balance)
                        : "Não cadastrado"}
                    </div>

                    <div
                      className={`font-black md:col-span-2 md:text-right ${
                        row.status === "divergente" ? "text-red-700" : "text-[#13233a]"
                      }`}
                    >
                      {row.difference === null
                        ? "—"
                        : formatCurrency(Math.abs(row.difference))}
                    </div>

                    <div className="md:col-span-2 md:text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] ${
                          row.status === "ok"
                            ? "bg-green-100 text-green-800"
                            : row.status === "divergente"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {getStatusLabel(row.status)}
                      </span>

                      {row.status === "divergente" && (
                        <p className="mt-1 text-xs font-bold leading-5 text-red-700">
                          Ajuste o saldo inicial de {row.next_month_label} ou revise o fechamento de {row.month_label}.
                        </p>
                      )}

                      {row.status === "sem_saldo_seguinte" && (
                        <p className="mt-1 text-xs font-bold leading-5 text-amber-800">
                          Cadastre o saldo inicial de {row.next_month_label}.
                        </p>
                      )}

                      {row.status === "mes_reaberto" && (
                        <p className="mt-1 text-xs font-bold leading-5 text-amber-800">
                          Feche novamente o mês após concluir as correções.
                        </p>
                      )}
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
