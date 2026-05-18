"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

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

const categoryLabels: Record<string, string> = {
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

const categoryOptions = [
  { value: "doacao", label: "Doação espontânea" },
  { value: "patrocinio", label: "Patrocínio" },
  { value: "rifa", label: "Rifa" },
  { value: "evento", label: "Evento" },
  { value: "venda", label: "Venda" },
  { value: "rendimento", label: "Rendimento bancário" },
  { value: "reembolso", label: "Reembolso" },
  { value: "ajuste", label: "Ajuste" },
  { value: "outros", label: "Outros" },
];

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  deposito: "Depósito",
  cartao: "Cartão",
  outros: "Outros",
};

const paymentMethodOptions = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "deposito", label: "Depósito" },
  { value: "cartao", label: "Cartão" },
  { value: "outros", label: "Outros" },
];

const statusLabels: Record<string, string> = {
  confirmada: "Confirmada",
  cancelada: "Cancelada",
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

export default function DashboardReceitasAvulsasPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [revenues, setRevenues] = useState<OtherRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    category: "todas",
  });

  const [form, setForm] = useState({
    received_at: today,
    amount: "",
    category: "doacao",
    payer_name: "",
    description: "",
    payment_method: "pix",
    reference: "",
    notes: "",
  });

  const filteredRevenues = useMemo(() => {
    return revenues.filter((revenue) => {
      const sameMonth = getMonthFromDate(revenue.received_at) === filters.month;

      const sameCategory =
        filters.category === "todas" || revenue.category === filters.category;

      return sameMonth && sameCategory;
    });
  }, [revenues, filters.month, filters.category]);

  const summary = useMemo(() => {
    const confirmed = filteredRevenues.filter(
      (revenue) => revenue.status === "confirmada"
    );

    const total = confirmed.reduce(
      (sum, revenue) => sum + Number(revenue.amount ?? 0),
      0
    );

    const canceled = filteredRevenues.filter(
      (revenue) => revenue.status === "cancelada"
    );

    return {
      total,
      count: confirmed.length,
      canceledCount: canceled.length,
    };
  }, [filteredRevenues]);

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

  async function loadRevenues() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("other_revenues")
      .select(
        "id, received_at, amount, category, payer_name, description, payment_method, reference, notes, status, created_at"
      )
      .order("received_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar receitas avulsas:", error);
      setMessage(error.message || "Não foi possível carregar as receitas avulsas.");
      setLoading(false);
      return;
    }

    setRevenues((data as unknown as OtherRevenue[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadRevenues();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const amount = Number(String(form.amount).replace(",", "."));

    if (!form.received_at) {
      setMessage("Informe a data do recebimento.");
      setSaving(false);
      return;
    }

    if (!amount || amount <= 0) {
      setMessage("Informe um valor válido.");
      setSaving(false);
      return;
    }

    if (!form.description.trim()) {
      setMessage("Informe uma descrição para identificar a receita.");
      setSaving(false);
      return;
    }

    const profileId = await getCurrentProfileId();
    const supabase = createClient();

    const { error } = await supabase.from("other_revenues").insert({
      received_at: form.received_at,
      amount,
      category: form.category,
      payer_name: form.payer_name.trim() || null,
      description: form.description.trim(),
      payment_method: form.payment_method,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      status: "confirmada",
      created_by: profileId,
    });

    if (error) {
      setMessage(error.message || "Não foi possível registrar a receita avulsa.");
      setSaving(false);
      return;
    }

    setSuccessMessage("Receita avulsa registrada com sucesso.");

    setForm({
      received_at: today,
      amount: "",
      category: "doacao",
      payer_name: "",
      description: "",
      payment_method: "pix",
      reference: "",
      notes: "",
    });

    setSaving(false);
    await loadRevenues();
  }

  async function cancelRevenue(revenue: OtherRevenue) {
    const confirmed = window.confirm(
      "Tem certeza que deseja cancelar esta receita avulsa? Ela continuará no histórico, mas não contará como entrada confirmada."
    );

    if (!confirmed) return;

    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("other_revenues")
      .update({
        status: "cancelada",
        updated_at: new Date().toISOString(),
      })
      .eq("id", revenue.id);

    if (error) {
      setMessage(error.message || "Não foi possível cancelar a receita avulsa.");
      return;
    }

    setSuccessMessage("Receita avulsa cancelada.");
    await loadRevenues();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Entradas financeiras
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Receitas Avulsas
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Registre entradas que não sejam mensalidades nem contribuições extras, como doações, patrocínios, rifas, vendas, eventos e outros recebimentos.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Use esta tela somente para receitas sem cobrança vinculada. Mensalidades e contribuições extras devem continuar sendo baixadas nos módulos próprios.
        </p>

        {successMessage && (
          <section className="rounded-3xl border border-green-200 bg-green-50 p-5 shadow-sm">
            <p className="font-bold text-green-800">{successMessage}</p>
          </section>
        )}

        {message && (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </section>
        )}

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Nova receita avulsa
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Data do recebimento
                </span>

                <input
                  type="date"
                  value={form.received_at}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      received_at: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Valor
                </span>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="0,00"
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Categoria
                </span>

                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      category: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                >
                  {categoryOptions.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Forma
                </span>

                <select
                  value={form.payment_method}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payment_method: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Pagador/contribuinte
                </span>

                <input
                  type="text"
                  value={form.payer_name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payer_name: event.target.value,
                    }))
                  }
                  placeholder="Ex.: João da Silva, Comércio X ou não identificado"
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Comprovante/Referência
                </span>

                <input
                  type="text"
                  value={form.reference}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      reference: event.target.value,
                    }))
                  }
                  placeholder="Ex.: ID do Pix, extrato, recibo, comprovante"
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Descrição
              </span>

              <input
                type="text"
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Ex.: Doação espontânea para a Associação"
                className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Observações
              </span>

              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
                placeholder="Informações adicionais sobre a receita."
                className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-fit rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Registrar receita"}
            </button>
          </form>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:col-span-2">
            <p className="text-sm font-bold text-[#596579]">
              Total confirmado no período
            </p>

            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.total)}
            </p>

            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.count} receita(s) confirmada(s)
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">
              Canceladas no período
            </p>

            <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.canceledCount}
            </p>
          </div>
        </section>

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
                Categoria
              </span>

              <select
                value={filters.category}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    category: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              >
                <option value="todas">Todas as categorias</option>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={loadRevenues}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Receitas registradas
          </h2>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando receitas avulsas...
            </div>
          ) : filteredRevenues.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhuma receita avulsa encontrada
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Não há receitas avulsas para o mês e categoria selecionados.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {filteredRevenues.map((revenue) => (
                <article
                  key={revenue.id}
                  className="rounded-3xl border border-[#e8dccb] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                          {categoryLabels[revenue.category] ?? revenue.category}
                        </p>

                        <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                          {statusLabels[revenue.status] ?? revenue.status}
                        </span>
                      </div>

                      <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                        {formatCurrency(revenue.amount)}
                      </h3>

                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        {revenue.description}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-sm font-black text-[#13233a]">
                        {formatDate(revenue.received_at)}
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        {paymentMethodLabels[revenue.payment_method] ??
                          revenue.payment_method}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-[#596579] md:grid-cols-2">
                    <p>
                      <strong>Pagador/contribuinte:</strong>{" "}
                      {revenue.payer_name || "Não informado"}
                    </p>

                    <p>
                      <strong>Referência:</strong>{" "}
                      {revenue.reference || "Não informado"}
                    </p>
                  </div>

                  {revenue.notes && (
                    <p className="mt-3 whitespace-pre-line rounded-2xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                      {revenue.notes}
                    </p>
                  )}

                  {revenue.status === "confirmada" && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => cancelRevenue(revenue)}
                        className="rounded-full bg-red-700 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white"
                      >
                        Cancelar receita
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
