"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
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
      }
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
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
      const balance = Math.max(
        Number(item.amount ?? 0) - Number(item.paid_amount ?? 0),
        0
      );

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
        setLoading(false);
        return;
      }

      setAssociate(associateData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("extra_contribution_items")
        .select(
          "id, contribution_id, associate_id, amount, paid_amount, due_date, status, notes, extra_contributions(id, title, description, reason, status)"
        )
        .eq("associate_id", associateData.id)
        .order("due_date", { ascending: true });

      if (itemsError) {
        console.error("Erro ao carregar contribuições extras:", itemsError);
        setMessage("Não foi possível carregar suas contribuições extras.");
        setLoading(false);
        return;
      }

      setItems((itemsData as unknown as ExtraContributionItem[]) ?? []);
      setLoading(false);
    }

    loadData();
  }, []);

  return (
    <ProtectedArea>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Contribuições Extras
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Consulte rateios e cobranças pontuais lançados pela Associação.
          </p>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">
              Carregando contribuições extras...
            </p>
          </div>
        ) : message ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : !associate ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Área indisponível
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              Esta área é liberada para associados ativos.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-5 md:grid-cols-3">
              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:col-span-2">
                <p className="text-sm font-bold text-[#596579]">Associado</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
                  {associate.full_name}
                </p>
                <p className="mt-2 text-sm font-bold text-[#596579]">
                  {associate.email}
                </p>
              </div>

              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">
                  Total em aberto
                </p>
                <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
                  {formatCurrency(summary.totalOpen)}
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Contribuições extras em aberto
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                São cobranças pontuais ou rateios lançados pela Associação, diferentes da mensalidade ordinária.
              </p>

              {summary.openItems.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
                  <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                    Nenhuma contribuição extra em aberto
                  </h3>

                  <p className="mt-2 leading-7 text-[#596579]">
                    Não há rateios ou cobranças pontuais pendentes no momento.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {summary.openItems.map((item) => {
                    const contribution = getContribution(item);
                    const balance = Math.max(
                      Number(item.amount ?? 0) - Number(item.paid_amount ?? 0),
                      0
                    );

                    return (
                      <article
                        key={item.id}
                        className="rounded-3xl border border-[#e8dccb] p-5"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                              Vencimento em {formatDate(item.due_date)}
                            </p>

                            <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                              {contribution?.title ?? "Contribuição extra"}
                            </h3>

                            {contribution?.description && (
                              <p className="mt-2 text-sm leading-6 text-[#596579]">
                                {contribution.description}
                              </p>
                            )}
                          </div>

                          <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {statusLabels[item.status] ?? item.status}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-3">
                          <p>
                            <strong>Valor:</strong> {formatCurrency(item.amount)}
                          </p>

                          <p>
                            <strong>Pago:</strong>{" "}
                            {formatCurrency(item.paid_amount)}
                          </p>

                          <p>
                            <strong>Saldo:</strong> {formatCurrency(balance)}
                          </p>
                        </div>

                        {contribution?.reason && (
                          <p className="mt-4 rounded-2xl bg-[#f7f8fa] p-4 text-sm leading-6 text-[#596579]">
                            <strong>Motivo:</strong> {contribution.reason}
                          </p>
                        )}

                        <a
                          href={`/area/informar-contribuicao-extra/${item.id}`}
                          className="mt-4 inline-flex w-fit rounded-full bg-[#13233a] px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-white"
                        >
                          Informar pagamento
                        </a>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Histórico de contribuições extras
              </h2>

              {items.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
                  <p className="font-bold text-[#596579]">
                    Nenhuma contribuição extra lançada até o momento.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {items.map((item) => {
                    const contribution = getContribution(item);
                    const balance = Math.max(
                      Number(item.amount ?? 0) - Number(item.paid_amount ?? 0),
                      0
                    );

                    return (
                      <article
                        key={item.id}
                        className="rounded-2xl border border-[#e8dccb] p-4"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="font-black text-[#13233a]">
                              {contribution?.title ?? "Contribuição extra"}
                            </h3>

                            <p className="mt-1 text-sm font-bold text-[#596579]">
                              Vencimento: {formatDate(item.due_date)} · Valor:{" "}
                              {formatCurrency(item.amount)} · Saldo:{" "}
                              {formatCurrency(balance)}
                            </p>
                          </div>

                          <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {statusLabels[item.status] ?? item.status}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ProtectedArea>
  );
}
