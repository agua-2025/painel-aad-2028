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
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Financeiro
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Acompanhe sua situação financeira, mensalidades em aberto e valores atualizados.
          </p>
        </section>

        {loading ? (
          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando informações financeiras...</p>
          </div>
        ) : message ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : !associate ? (
          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Área financeira indisponível no momento
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              A área financeira é liberada para associados ativos. Caso sua associação já tenha sido aprovada, aguarde a atualização do cadastro ou procure a Diretoria/Secretaria.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Situação</p>
                <p className="mt-2 text-base font-black tracking-[-0.03em] text-[#13233a]">
                  {summary.totalOpen > 0 ? "Com pendência" : "Em dia"}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  {associate.full_name}
                </p>
              </div>

              <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Total em aberto</p>
                <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  {formatCurrency(summary.totalOpen)}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  Atualizado até hoje
                </p>
              </div>

              <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Total pago</p>
                <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  {formatCurrency(summary.totalPaid)}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  Pagamentos já baixados
                </p>
              </div>
            </section>

            {summary.openFees.length > 1 && (
              <p className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
                Orientação: havendo mais de uma mensalidade em aberto, recomenda-se quitar primeiro a mais antiga e informar corretamente a referência do pagamento.
              </p>
            )}

            {summary.overdueFees.length > 0 && (
              <p className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
                Atenção: há mensalidade vencida com encargos. O valor exibido considera a data de hoje e pode mudar em outra data.
              </p>
            )}

            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Mensalidades em aberto
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Valores calculados até hoje. Após o pagamento, informe a Tesouraria pelo botão correspondente.
                </p>
              </div>

              {summary.openFees.length === 0 ? (
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
                  <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                    <div className="col-span-3">Referência</div>
                    <div className="col-span-2">Vencimento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2 text-right">Encargos</div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-2 text-right">Ação</div>
                  </div>

                  <div className="divide-y divide-[#eee7db]">
                    {summary.openFees.map((fee, index) => {
                      const calculated = calculateAmountDueAtDate(fee, today);
                      const remaining = Math.max(
                        calculated.totalDue - Number(fee.paid_amount ?? 0),
                        0
                      );

                      return (
                        <article
                          key={fee.id}
                          className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                        >
                          <div className="rounded-xl bg-[#f7f8fa] px-3 py-3 md:col-span-3 md:rounded-none md:bg-transparent md:px-0 md:py-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                              Referência
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 md:mt-0">
                              <p className="font-black text-[#13233a]">
                                {getMonthLabel(fee)}
                              </p>

                              {index === 0 && summary.openFees.length > 1 && (
                                <span className="rounded-full bg-[#c7a56b] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a]">
                                  Prioridade
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs font-bold text-[#596579]">
                              Pago: {formatCurrency(fee.paid_amount)}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 md:contents">
                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 font-bold text-[#596579] md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0">
                              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Vencimento
                              </p>

                              <p className="mt-1 md:mt-0">{formatDate(fee.due_date)}</p>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 font-bold text-[#596579] md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-right">
                              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Valor em aberto
                              </p>

                              <p className="mt-1 font-black text-[#13233a] md:mt-0">
                                {formatCurrency(remaining)}
                              </p>

                              <p className="text-xs">
                                Base: {formatCurrency(fee.base_amount)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 font-bold text-[#596579] md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-right">
                              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Encargos
                              </p>

                              <p className="mt-1 md:mt-0">
                                Multa: {formatCurrency(calculated.lateFeeAmount)}
                              </p>

                              <p className="text-xs">
                                Juros: {formatCurrency(calculated.interestAmount)} · Dias:{" "}
                                {calculated.daysWithCharges}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 md:col-span-1 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-center">
                              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Status
                              </p>

                              <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579] md:bg-[#f7f8fa]">
                                {statusLabels[fee.status] ?? fee.status}
                              </span>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 sm:col-span-2 md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-right">
                              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Ação
                              </p>

                              <a
                                href={`/area/informar-pagamento/${fee.id}`}
                                className="inline-flex rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
                              >
                                Informar pagamento
                              </a>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Últimas mensalidades
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Histórico recente das mensalidades registradas no sistema.
                </p>
              </div>

              {fees.length === 0 ? (
                <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
                  <p className="font-bold text-[#596579]">
                    Nenhuma mensalidade registrada ainda.
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                  <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                    <div className="col-span-4">Referência</div>
                    <div className="col-span-2">Vencimento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2 text-right">Pago</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>

                  <div className="divide-y divide-[#eee7db]">
                    {fees.slice(0, 8).map((fee) => {
                      const calculated = calculateAmountDueAtDate(fee, today);
                      const valueToShow = isOpenFee(fee)
                        ? calculated.totalDue
                        : fee.total_amount;

                      return (
                        <article
                          key={fee.id}
                          className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                        >
                          <div className="rounded-xl bg-[#f7f8fa] px-3 py-3 md:col-span-4 md:rounded-none md:bg-transparent md:px-0 md:py-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                              Referência
                            </p>

                            <p className="mt-1 font-black text-[#13233a] md:mt-0">
                              {getMonthLabel(fee)}
                            </p>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 md:contents">
                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 font-bold text-[#596579] md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0">
                              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Vencimento
                              </p>

                              <p className="mt-1 md:mt-0">{formatDate(fee.due_date)}</p>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-right">
                              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Valor
                              </p>

                              <p className="mt-1 font-black text-[#13233a] md:mt-0">
                                {formatCurrency(valueToShow)}
                              </p>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 font-bold text-[#596579] md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-right">
                              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Pago
                              </p>

                              <p className="mt-1 md:mt-0">{formatCurrency(fee.paid_amount)}</p>
                            </div>

                            <div className="rounded-xl bg-[#f7f8fa] px-3 py-2 sm:col-span-2 md:col-span-2 md:rounded-none md:bg-transparent md:px-0 md:py-0 md:text-center">
                              <p className="mb-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#a7834d] md:hidden">
                                Status
                              </p>

                              <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579] md:bg-[#f7f8fa]">
                                {statusLabels[fee.status] ?? fee.status}
                              </span>
                            </div>
                          </div>
                        </article>
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
