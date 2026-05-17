"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

type ExtraContributionItem = {
  id: string;
  amount: number;
  paid_amount: number;
  status: string;
};

type ExtraContribution = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  amount_mode: string;
  total_amount: number | null;
  individual_amount: number | null;
  due_date: string;
  target_type: string;
  status: string;
  created_at: string;
  extra_contribution_items: ExtraContributionItem[] | null;
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  ativa: "Ativa",
  encerrada: "Encerrada",
  cancelada: "Cancelada",
};

const itemStatusLabels: Record<string, string> = {
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

function toNumber(value: string) {
  return Number(String(value || "0").replace(",", "."));
}

function distributeTotalAmount(totalAmount: number, associates: Associate[]) {
  const totalCents = Math.round(totalAmount * 100);
  const count = associates.length;

  if (count <= 0) return [];

  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  return associates.map((associate, index) => {
    const cents = baseCents + (index < remainder ? 1 : 0);

    return {
      associate_id: associate.id,
      amount: Number((cents / 100).toFixed(2)),
    };
  });
}

export default function DashboardContribuicoesExtrasPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [associates, setAssociates] = useState<Associate[]>([]);
  const [contributions, setContributions] = useState<ExtraContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    reason: "",
    amount_mode: "rateio_total",
    total_amount: "",
    individual_amount: "",
    due_date: today,
  });

  const preview = useMemo(() => {
    const activeAssociates = associates.filter(
      (associate) => associate.status === "ativo"
    );

    if (activeAssociates.length === 0) {
      return {
        count: 0,
        total: 0,
        individualAverage: 0,
      };
    }

    if (form.amount_mode === "rateio_total") {
      const total = toNumber(form.total_amount);
      const individualAverage = total / activeAssociates.length;

      return {
        count: activeAssociates.length,
        total,
        individualAverage,
      };
    }

    const individualAmount = toNumber(form.individual_amount);
    const total = individualAmount * activeAssociates.length;

    return {
      count: activeAssociates.length,
      total,
      individualAverage: individualAmount,
    };
  }, [associates, form.amount_mode, form.total_amount, form.individual_amount]);

  async function getCurrentProfileId() {
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    return profile?.id ?? null;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data: associatesData, error: associatesError } = await supabase
      .from("associates")
      .select("id, full_name, email, status")
      .eq("status", "ativo")
      .order("full_name", { ascending: true });

    if (associatesError) {
      setMessage("Não foi possível carregar os associados ativos.");
      setLoading(false);
      return;
    }

    setAssociates((associatesData as Associate[]) ?? []);

    const { data: contributionsData, error: contributionsError } = await supabase
      .from("extra_contributions")
      .select(
        "id, title, description, reason, amount_mode, total_amount, individual_amount, due_date, target_type, status, created_at, extra_contribution_items(id, amount, paid_amount, status)"
      )
      .order("created_at", { ascending: false });

    if (contributionsError) {
      setMessage("Não foi possível carregar as contribuições extras.");
      setLoading(false);
      return;
    }

    setContributions((contributionsData as unknown as ExtraContribution[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const activeAssociates = associates.filter(
      (associate) => associate.status === "ativo"
    );

    if (!form.title.trim()) {
      setMessage("Informe o nome da contribuição extra.");
      setSaving(false);
      return;
    }

    if (!form.due_date) {
      setMessage("Informe o vencimento da contribuição extra.");
      setSaving(false);
      return;
    }

    if (activeAssociates.length === 0) {
      setMessage("Não há associados ativos para gerar o rateio.");
      setSaving(false);
      return;
    }

    const totalAmount = toNumber(form.total_amount);
    const individualAmount = toNumber(form.individual_amount);

    if (form.amount_mode === "rateio_total" && totalAmount <= 0) {
      setMessage("Informe um valor total válido para rateio.");
      setSaving(false);
      return;
    }

    if (form.amount_mode === "valor_individual" && individualAmount <= 0) {
      setMessage("Informe um valor individual válido.");
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const profileId = await getCurrentProfileId();

    const { data: contributionData, error: contributionError } = await supabase
      .from("extra_contributions")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        reason: form.reason.trim() || null,
        amount_mode: form.amount_mode,
        total_amount: form.amount_mode === "rateio_total" ? totalAmount : null,
        individual_amount:
          form.amount_mode === "valor_individual" ? individualAmount : null,
        due_date: form.due_date,
        target_type: "todos_ativos",
        status: "rascunho",
        created_by: profileId,
      })
      .select("id")
      .single();

    if (contributionError || !contributionData) {
      setMessage(
        contributionError?.message ||
          "Não foi possível criar a contribuição extra."
      );
      setSaving(false);
      return;
    }

    const contributionId = contributionData.id as string;

    const itemAmounts =
      form.amount_mode === "rateio_total"
        ? distributeTotalAmount(totalAmount, activeAssociates)
        : activeAssociates.map((associate) => ({
            associate_id: associate.id,
            amount: individualAmount,
          }));

    const itemsToInsert = itemAmounts.map((item) => ({
      contribution_id: contributionId,
      associate_id: item.associate_id,
      amount: item.amount,
      paid_amount: 0,
      due_date: form.due_date,
      status: "pendente",
    }));

    const { error: itemsError } = await supabase
      .from("extra_contribution_items")
      .insert(itemsToInsert);

    if (itemsError) {
      await supabase
        .from("extra_contributions")
        .update({
          status: "cancelada",
        })
        .eq("id", contributionId);

      setMessage(
        "A contribuição foi criada, mas houve erro ao gerar os itens individuais. Ela foi marcada como cancelada. Erro: " +
          itemsError.message
      );
      setSaving(false);
      await loadData();
      return;
    }

    const { error: activateError } = await supabase
      .from("extra_contributions")
      .update({
        status: "ativa",
      })
      .eq("id", contributionId);

    if (activateError) {
      setMessage(
        "Os itens foram gerados, mas houve erro ao ativar a contribuição: " +
          activateError.message
      );
      setSaving(false);
      await loadData();
      return;
    }

    setSuccessMessage("Contribuição extra criada e rateada com sucesso.");

    setForm({
      title: "",
      description: "",
      reason: "",
      amount_mode: "rateio_total",
      total_amount: "",
      individual_amount: "",
      due_date: today,
    });

    setSaving(false);
    await loadData();
  }

  function getContributionTotals(contribution: ExtraContribution) {
    const items = contribution.extra_contribution_items ?? [];

    const totalGenerated = items.reduce(
      (sum, item) => sum + Number(item.amount ?? 0),
      0
    );

    const totalPaid = items.reduce(
      (sum, item) => sum + Number(item.paid_amount ?? 0),
      0
    );

    const pendingItems = items.filter((item) =>
      ["pendente", "parcialmente_paga", "atrasada"].includes(item.status)
    );

    const paidItems = items.filter((item) => item.status === "paga");

    return {
      totalGenerated,
      totalPaid,
      pendingAmount: Math.max(totalGenerated - totalPaid, 0),
      totalItems: items.length,
      pendingItems: pendingItems.length,
      paidItems: paidItems.length,
    };
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Financeiro
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Contribuições Extras
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Crie cobranças pontuais e rateios extraordinários para os associados ativos.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Contribuições extras são cobranças pontuais. Elas só representam entrada no caixa quando forem efetivamente pagas e baixadas.
        </p>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Nova contribuição extra
          </h2>

          <p className="mt-2 text-sm font-medium text-[#596579]">
            Nesta primeira versão, o rateio será feito entre todos os associados ativos.
          </p>

          {message && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              {message}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleCreateContribution} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Nome da contribuição
                </span>

                <input
                  type="text"
                  value={form.title}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Rateio de despesas cartorárias"
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Vencimento
                </span>

                <input
                  type="date"
                  value={form.due_date}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      due_date: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Descrição
              </span>

              <textarea
                value={form.description}
                disabled={saving}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Explique de forma simples o que está sendo cobrado."
                className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Motivo/justificativa
              </span>

              <textarea
                value={form.reason}
                disabled={saving}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reason: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Ex.: despesa aprovada para registro de documentos no cartório."
                className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Tipo de cálculo
                </span>

                <select
                  value={form.amount_mode}
                  disabled={saving}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      amount_mode: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                >
                  <option value="rateio_total">Ratear valor total</option>
                  <option value="valor_individual">Valor individual fixo</option>
                </select>
              </label>

              {form.amount_mode === "rateio_total" ? (
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Valor total a ratear
                  </span>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.total_amount}
                    disabled={saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        total_amount: event.target.value,
                      }))
                    }
                    placeholder="Ex.: 500.00"
                    className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>
              ) : (
                <label className="grid gap-2 md:col-span-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Valor individual
                  </span>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.individual_amount}
                    disabled={saving}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        individual_amount: event.target.value,
                      }))
                    }
                    placeholder="Ex.: 25.00"
                    className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>
              )}
            </div>

            <div className="rounded-2xl bg-[#f7f8fa] p-4">
              <p className="text-sm font-bold text-[#596579]">Prévia do rateio</p>

              <div className="mt-3 grid gap-3 text-sm text-[#596579] md:grid-cols-3">
                <p>
                  <strong>Associados ativos:</strong> {preview.count}
                </p>

                <p>
                  <strong>Total previsto:</strong> {formatCurrency(preview.total)}
                </p>

                <p>
                  <strong>Valor médio individual:</strong>{" "}
                  {formatCurrency(preview.individualAverage)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-fit rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Gerando..." : "Criar e gerar rateio"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Contribuições criadas
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Acompanhe os rateios e cobranças pontuais já gerados.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando contribuições extras...
            </div>
          ) : contributions.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhuma contribuição extra criada
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Quando a Tesouraria criar um rateio ou cobrança pontual, ele aparecerá nesta lista.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {contributions.map((contribution) => {
                const totals = getContributionTotals(contribution);

                return (
                  <article
                    key={contribution.id}
                    className="rounded-3xl border border-[#e8dccb] p-5"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                          Vencimento em {formatDate(contribution.due_date)}
                        </p>

                        <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                          {contribution.title}
                        </h3>

                        {contribution.description && (
                          <p className="mt-2 text-sm leading-6 text-[#596579]">
                            {contribution.description}
                          </p>
                        )}
                      </div>

                      <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                        {statusLabels[contribution.status] ?? contribution.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-3">
                      <p>
                        <strong>Itens gerados:</strong> {totals.totalItems}
                      </p>

                      <p>
                        <strong>Pendentes:</strong> {totals.pendingItems}
                      </p>

                      <p>
                        <strong>Pagos:</strong> {totals.paidItems}
                      </p>

                      <p>
                        <strong>Total lançado:</strong>{" "}
                        {formatCurrency(totals.totalGenerated)}
                      </p>

                      <p>
                        <strong>Total pago:</strong>{" "}
                        {formatCurrency(totals.totalPaid)}
                      </p>

                      <p>
                        <strong>Total em aberto:</strong>{" "}
                        {formatCurrency(totals.pendingAmount)}
                      </p>
                    </div>
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
