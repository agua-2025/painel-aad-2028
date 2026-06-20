"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";
import { calculateExtraContributionAmountDue } from "@/lib/extraContributionCharges";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

type PendingExtraReport = {
  id: string;
  extra_contribution_item_id: string | null;
  status: string;
};

type ExtraContributionItem = {
  id: string;
  contribution_id: string;
  associate_id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  notes: string | null;
  extra_contributions:
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
        apply_late_charges?: boolean | null;
        late_fee_percent?: number | null;
        daily_interest_percent?: number | null;
        late_fee_grace_days?: number | null;
      }
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
        apply_late_charges?: boolean | null;
        late_fee_percent?: number | null;
        daily_interest_percent?: number | null;
        late_fee_grace_days?: number | null;
      }[]
    | null;
};

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

function getContribution(item: ExtraContributionItem) {
  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function isOpenItem(item: ExtraContributionItem) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(item.status);
}

export default function AreaContribuicoesExtrasPage() {
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [items, setItems] = useState<ExtraContributionItem[]>([]);
  const [pendingReportItemIds, setPendingReportItemIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const summary = useMemo(() => {
    const openItems = items
      .filter(isOpenItem)
      .sort((a, b) => {
        const dateA = new Date(a.due_date + "T00:00:00").getTime();
        const dateB = new Date(b.due_date + "T00:00:00").getTime();

        return dateA - dateB;
      });

    const paidItems = items.filter((item) => item.status === "paga");

    const totalOpen = openItems.reduce((sum, item) => {
      const balance = calculateExtraContributionAmountDue(item).remaining;

      return sum + balance;
    }, 0);

    const totalPaid = items.reduce(
      (sum, item) => sum + Number(item.paid_amount ?? 0),
      0
    );

    return {
      openItems,
      paidItems,
      totalOpen,
      totalPaid,
    };
  }, [items]);

  useEffect(() => {
    async function loadData() {
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

      const { data: associateData, error: associateError } = await supabase
        .from("associates")
        .select("id, full_name, email, status")
        .eq("email", user.email)
        .maybeSingle();

      if (associateError) {
        console.error("Erro ao carregar associado:", associateError);
        setMessage("Não foi possível carregar seu cadastro de associado.");
        setLoading(false);
        return;
      }

      if (!associateData || associateData.status !== "ativo") {
        setAssociate(null);
        setItems([]);
        setPendingReportItemIds(new Set());
        setLoading(false);
        return;
      }

      setAssociate(associateData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("extra_contribution_items")
        .select(
          "id, contribution_id, associate_id, amount, paid_amount, due_date, status, notes, extra_contributions(id, title, description, reason, status, apply_late_charges, late_fee_percent, daily_interest_percent, late_fee_grace_days)"
        )
        .eq("associate_id", associateData.id)
        .order("due_date", { ascending: true });

      if (itemsError) {
        console.error("Erro ao carregar contribuições extras:", itemsError);
        setMessage("Não foi possível carregar suas contribuições extras.");
        setLoading(false);
        return;
      }

      const { data: pendingReportsData, error: pendingReportsError } =
        await supabase
          .from("payment_reports")
          .select("id, extra_contribution_item_id, status")
          .eq("associate_id", associateData.id)
          .eq("status", "pendente")
          .not("extra_contribution_item_id", "is", null);

      if (pendingReportsError) {
        console.error(
          "Erro ao carregar informes pendentes de contribuições extras:",
          pendingReportsError
        );
      }

      const pendingIds = new Set(
        ((pendingReportsData as PendingExtraReport[] | null) ?? [])
          .map((report) => report.extra_contribution_item_id)
          .filter((id): id is string => Boolean(id))
      );

      setItems((itemsData as unknown as ExtraContributionItem[]) ?? []);
      setPendingReportItemIds(pendingIds);
      setLoading(false);
    }

    loadData();
  }, []);

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Contribuições Extras
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Consulte rateios e cobranças pontuais lançados pela Associação.
          </p>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="font-bold text-[#596579]">
              Carregando contribuições extras...
            </p>
          </div>
        ) : message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : !associate ? (
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Área indisponível
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              Esta área é liberada para associados ativos.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm md:col-span-2">
                <p className="text-sm font-bold text-[#596579]">Associado</p>
                <p className="mt-2 text-base font-black tracking-[-0.03em] text-[#13233a]">
                  {associate.full_name}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  {associate.email}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">
                  Total em aberto
                </p>
                <p className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  {formatCurrency(summary.totalOpen)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Contribuições extras em aberto
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Cobranças pontuais ou rateios lançados pela Associação, diferentes da mensalidade ordinária.
                </p>
              </div>

              {summary.openItems.length === 0 ? (
                <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
                  <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                    Nenhuma contribuição extra em aberto
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#596579]">
                    Não há rateios ou cobranças pontuais pendentes no momento.
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                  <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                    <div className="col-span-4">Contribuição</div>
                    <div className="col-span-2">Vencimento</div>
                    <div className="col-span-2 text-right">Valor/Pago</div>
                    <div className="col-span-2 text-right">Saldo</div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-1 text-right">Ação</div>
                  </div>

                  <div className="divide-y divide-[#eee7db]">
                    {summary.openItems.map((item) => {
                      const contribution = getContribution(item);
                      const balance = calculateExtraContributionAmountDue(item).remaining;

                      return (
                        <article
                          key={item.id}
                          className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                        >
                          <div className="md:col-span-4">
                            <p className="font-black text-[#13233a]">
                              {contribution?.title ?? "Contribuição extra"}
                            </p>

                            {contribution?.description && (
                              <p className="mt-0.5 text-xs font-bold leading-5 text-[#596579]">
                                {contribution.description}
                              </p>
                            )}

                            {contribution?.reason && (
                              <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                                Motivo: {contribution.reason}
                              </p>
                            )}
                          </div>

                          <div className="font-bold text-[#596579] md:col-span-2">
                            {formatDate(item.due_date)}
                          </div>

                          <div className="font-bold text-[#596579] md:col-span-2 md:text-right">
                            <p className="font-black text-[#13233a]">
                              {formatCurrency(calculateExtraContributionAmountDue(item).totalDue)}
                            </p>

                            <p className="text-xs">
                              Pago: {formatCurrency(item.paid_amount)}
                            </p>
                          </div>

                          <div className="font-black text-[#13233a] md:col-span-2 md:text-right">
                            {formatCurrency(balance)}
                          </div>

                          <div className="md:col-span-1 md:text-center">
                            <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                              {statusLabels[item.status] ?? item.status}
                            </span>
                          </div>

                          <div className="md:col-span-1 md:text-right">
                            {pendingReportItemIds.has(item.id) ? (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-amber-700">
                                Em análise
                              </span>
                            ) : (
                              <a
                                href={`/area/informar-contribuicao-extra/${item.id}`}
                                className="inline-flex rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
                              >
                                Informar
                              </a>
                            )}
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
                  Histórico de contribuições extras
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Rateios e cobranças pontuais lançados em seu nome.
                </p>
              </div>

              {items.length === 0 ? (
                <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
                  <p className="font-bold text-[#596579]">
                    Nenhuma contribuição extra lançada até o momento.
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                  <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                    <div className="col-span-4">Contribuição</div>
                    <div className="col-span-2">Vencimento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2 text-right">Pago/Saldo</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>

                  <div className="divide-y divide-[#eee7db]">
                    {items.map((item) => {
                      const contribution = getContribution(item);
                      const balance = calculateExtraContributionAmountDue(item).remaining;

                      return (
                        <article
                          key={item.id}
                          className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                        >
                          <div className="md:col-span-4">
                            <p className="font-black text-[#13233a]">
                              {contribution?.title ?? "Contribuição extra"}
                            </p>

                            {contribution?.description && (
                              <p className="mt-0.5 text-xs font-bold leading-5 text-[#596579]">
                                {contribution.description}
                              </p>
                            )}
                          </div>

                          <div className="font-bold text-[#596579] md:col-span-2">
                            {formatDate(item.due_date)}
                          </div>

                          <div className="font-black text-[#13233a] md:col-span-2 md:text-right">
                            {formatCurrency(calculateExtraContributionAmountDue(item).totalDue)}
                          </div>

                          <div className="font-bold text-[#596579] md:col-span-2 md:text-right">
                            <p>Pago: {formatCurrency(item.paid_amount)}</p>
                            <p className="text-xs">Saldo: {formatCurrency(balance)}</p>
                          </div>

                          <div className="md:col-span-2 md:text-center">
                            <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                              {statusLabels[item.status] ?? item.status}
                            </span>
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
