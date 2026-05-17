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

  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function getMonthLabel(fee: MonthlyFee) {
  return `${monthNames[Number(fee.month) - 1]} de ${fee.year}`;
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
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
  };
}

function isOpenFee(fee: MonthlyFee) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(fee.status);
}

export default function AreaFinanceiroPage() {
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [fees, setFees] = useState<MonthlyFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const summary = useMemo(() => {
    const openFees = fees
      .filter(isOpenFee)
      .sort((a, b) => {
        if (a.year !== b.year) {
          return a.year - b.year;
        }

        return a.month - b.month;
      });

    const paidFees = fees.filter((fee) => fee.status === "paga");

    const totalOpen = openFees.reduce((sum, fee) => {
      const calculated = calculateAmountDueAtDate(fee, today);
      const remaining = Math.max(
        calculated.totalDue - Number(fee.paid_amount ?? 0),
        0
      );

      return sum + remaining;
    }, 0);

    const totalPaid = fees.reduce(
      (sum, fee) => sum + Number(fee.paid_amount ?? 0),
      0
    );

    const overdueFees = openFees.filter((fee) => {
      const calculated = calculateAmountDueAtDate(fee, today);
      return calculated.daysWithCharges > 0;
    });

    return {
      openFees,
      paidFees,
      overdueFees,
      totalOpen,
      totalPaid,
    };
  }, [fees, today]);

  useEffect(() => {
    async function loadFinancialData() {
      setLoading(true);
      setMessage("");

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

    if (associateError) {
      console.error("Erro ao carregar associado:", associateError);
      setMessage("Não foi possível carregar seus dados financeiros.");
      setLoading(false);
      return;
    }

    if (!associateData || associateData.status !== "ativo") {
      setAssociate(null);
      setFees([]);
      setLoading(false);
      return;
    }

      setAssociate(associateData);

      const { data: feesData, error: feesError } = await supabase
        .from("monthly_fees")
        .select(
          "id, associate_id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, late_fee_amount, interest_amount, total_amount, paid_amount, paid_at, status, notes, financial_settings(late_fee_grace_days)"
        )
        .eq("associate_id", associateData.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (feesError) {
        console.error("Erro ao carregar mensalidades:", feesError);
        setMessage("Não foi possível carregar suas mensalidades.");
        setLoading(false);
        return;
      }

      setFees((feesData as unknown as MonthlyFee[]) ?? []);
      setLoading(false);
    }

    loadFinancialData();
  }, []);

  return (
    <ProtectedArea>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Financeiro
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Acompanhe sua situação financeira, mensalidades em aberto e valores atualizados.
          </p>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando informações financeiras...</p>
          </div>
        ) : message ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : !associate ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Área financeira indisponível no momento
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              A área financeira é liberada para associados ativos. Caso sua associação já tenha sido aprovada, aguarde a atualização do cadastro ou procure a Diretoria/Secretaria.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-5 md:grid-cols-3">
              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Situação</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
                  {summary.totalOpen > 0 ? "Com pendência" : "Em dia"}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  {associate.full_name}
                </p>
              </div>

              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Total em aberto</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
                  {formatCurrency(summary.totalOpen)}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  Atualizado até hoje
                </p>
              </div>

              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Total pago</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
                  {formatCurrency(summary.totalPaid)}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  Pagamentos já baixados
                </p>
              </div>
            </section>

            {summary.openFees.length > 1 && (
              <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
                Orientação: havendo mais de uma mensalidade em aberto, recomenda-se quitar primeiro a mais antiga e informar corretamente a referência do pagamento.
              </p>
            )}

            {summary.overdueFees.length > 0 && (
              <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
                Atenção: há mensalidade vencida com encargos. O valor exibido considera a data de hoje e pode mudar em outra data.
              </p>
            )}

            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Mensalidades em aberto
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Valores calculados até a data de hoje. Após o pagamento, a baixa será lançada pela Tesouraria.
              </p>

              {summary.openFees.length === 0 ? (
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
                  {summary.openFees.map((fee, index) => {
                    const calculated = calculateAmountDueAtDate(fee, today);
                    const remaining = Math.max(
                      calculated.totalDue - Number(fee.paid_amount ?? 0),
                      0
                    );

                    return (
                      <article
                        key={fee.id}
                        className="rounded-3xl border border-[#e8dccb] p-5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                                {getMonthLabel(fee)}
                              </p>

                              {index === 0 && summary.openFees.length > 1 && (
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-amber-900">
                                  Prioridade de pagamento
                                </span>
                              )}
                            </div>

                            <h3 className="mt-2 text-xl font-black text-[#13233a]">
                              {formatCurrency(remaining)}
                            </h3>

                            <p className="mt-2 text-sm font-bold text-[#596579]">
                              Vencimento: {formatDate(fee.due_date)}
                            </p>
                          </div>

                          <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {statusLabels[fee.status] ?? fee.status}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-2">
                          <p>
                            <strong>Valor base:</strong>{" "}
                            {formatCurrency(fee.base_amount)}
                          </p>
                          <p>
                            <strong>Pago:</strong>{" "}
                            {formatCurrency(fee.paid_amount)}
                          </p>
                          <p>
                            <strong>Multa:</strong>{" "}
                            {formatCurrency(calculated.lateFeeAmount)}
                          </p>
                          <p>
                            <strong>Juros:</strong>{" "}
                            {formatCurrency(calculated.interestAmount)}
                          </p>
                          <p>
                            <strong>Dias com encargos:</strong>{" "}
                            {calculated.daysWithCharges}
                          </p>
                          <p>
                            <strong>Total devido hoje:</strong>{" "}
                            {formatCurrency(calculated.totalDue)}
                          </p>

                          <a
                            href={`/area/informar-pagamento/${fee.id}`}
                            className="mt-3 inline-flex w-fit rounded-full bg-[#13233a] px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-white"
                          >
                            Informar pagamento
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Últimas mensalidades
              </h2>

              {fees.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
                  <p className="font-bold text-[#596579]">
                    Nenhuma mensalidade registrada ainda.
                  </p>
                </div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl border border-[#e8dccb]">
                  <div className="hidden bg-[#f7f8fa] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#596579] md:grid md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr]">
                    <span>Referência</span>
                    <span>Vencimento</span>
                    <span>Valor</span>
                    <span>Status</span>
                  </div>

                  <div className="divide-y divide-[#e8dccb]">
                    {fees.slice(0, 8).map((fee) => {
                      const calculated = calculateAmountDueAtDate(fee, today);
                      const valueToShow = isOpenFee(fee)
                        ? calculated.totalDue
                        : fee.total_amount;

                      return (
                        <div
                          key={fee.id}
                          className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr] md:items-center"
                        >
                          <div>
                            <p className="font-black text-[#13233a]">
                              {getMonthLabel(fee)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-[#596579]">
                              Pago: {formatCurrency(fee.paid_amount)}
                            </p>
                          </div>

                          <div className="text-sm font-bold text-[#596579]">
                            {formatDate(fee.due_date)}
                          </div>

                          <div className="text-sm font-black text-[#13233a]">
                            {formatCurrency(valueToShow)}
                          </div>

                          <div>
                            <span className="inline-flex rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                              {statusLabels[fee.status] ?? fee.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ProtectedArea>
  );
}
