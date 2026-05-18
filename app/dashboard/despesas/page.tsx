"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: string;
  expense_date: string;
  due_date: string | null;
  paid_at: string | null;
  amount: number;
  category: string;
  payee_name: string | null;
  description: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

const categoryLabels: Record<string, string> = {
  cartorio: "Cartório",
  taxa_bancaria: "Taxa bancária",
  fornecedor: "Fornecedor",
  evento: "Evento",
  material: "Material",
  servico: "Serviço",
  decoracao: "Decoração",
  cerimonial: "Cerimonial",
  locacao: "Locação",
  reembolso: "Reembolso",
  ajuste: "Ajuste",
  outros: "Outros",
};

const categoryOptions = [
  { value: "cartorio", label: "Cartório" },
  { value: "taxa_bancaria", label: "Taxa bancária" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "evento", label: "Evento" },
  { value: "material", label: "Material" },
  { value: "servico", label: "Serviço" },
  { value: "decoracao", label: "Decoração" },
  { value: "cerimonial", label: "Cerimonial" },
  { value: "locacao", label: "Locação" },
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
  pendente: "Pendente",
  paga: "Paga",
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

function getMonthFromDate(value?: string | null) {
  return value ? value.slice(0, 7) : "";
}

function getReferenceDate(expense: Expense) {
  return expense.status === "paga" && expense.paid_at
    ? expense.paid_at
    : expense.expense_date;
}

function getStatusClass(status: string) {
  if (status === "paga") {
    return "bg-green-100 text-green-800";
  }

  if (status === "cancelada") {
    return "bg-red-100 text-red-800";
  }

  return "bg-amber-100 text-amber-900";
}

export default function DashboardDespesasPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    status: "todos",
    category: "todas",
  });

  const [form, setForm] = useState({
    expense_date: today,
    due_date: "",
    paid_at: today,
    amount: "",
    category: "outros",
    payee_name: "",
    description: "",
    payment_method: "pix",
    reference: "",
    notes: "",
    status: "paga",
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const sameMonth = getMonthFromDate(getReferenceDate(expense)) === filters.month;

      const sameStatus =
        filters.status === "todos" || expense.status === filters.status;

      const sameCategory =
        filters.category === "todas" || expense.category === filters.category;

      return sameMonth && sameStatus && sameCategory;
    });
  }, [expenses, filters.month, filters.status, filters.category]);

  const summary = useMemo(() => {
    const paid = filteredExpenses.filter((expense) => expense.status === "paga");
    const pending = filteredExpenses.filter(
      (expense) => expense.status === "pendente"
    );
    const canceled = filteredExpenses.filter(
      (expense) => expense.status === "cancelada"
    );

    const paidTotal = paid.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0
    );

    const pendingTotal = pending.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0
    );

    return {
      paidTotal,
      pendingTotal,
      paidCount: paid.length,
      pendingCount: pending.length,
      canceledCount: canceled.length,
      totalCount: filteredExpenses.length,
    };
  }, [filteredExpenses]);

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

  async function loadExpenses() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, due_date, paid_at, amount, category, payee_name, description, payment_method, reference, notes, status, created_at"
      )
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar despesas:", error);
      setMessage(error.message || "Não foi possível carregar as despesas.");
      setLoading(false);
      return;
    }

    setExpenses((data as unknown as Expense[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const amount = Number(String(form.amount).replace(",", "."));

    if (!form.expense_date) {
      setMessage("Informe a data da despesa.");
      setSaving(false);
      return;
    }

    if (!amount || amount <= 0) {
      setMessage("Informe um valor válido.");
      setSaving(false);
      return;
    }

    if (!form.description.trim()) {
      setMessage("Informe uma descrição para identificar a despesa.");
      setSaving(false);
      return;
    }

    if (form.status === "paga" && !form.paid_at) {
      setMessage("Informe a data do pagamento da despesa.");
      setSaving(false);
      return;
    }

    const profileId = await getCurrentProfileId();
    const supabase = createClient();

    const { error } = await supabase.from("expenses").insert({
      expense_date: form.expense_date,
      due_date: form.due_date || null,
      paid_at: form.status === "paga" ? form.paid_at : null,
      amount,
      category: form.category,
      payee_name: form.payee_name.trim() || null,
      description: form.description.trim(),
      payment_method: form.status === "paga" ? form.payment_method : null,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      created_by: profileId,
    });

    if (error) {
      setMessage(error.message || "Não foi possível registrar a despesa.");
      setSaving(false);
      return;
    }

    setSuccessMessage("Despesa registrada com sucesso.");

    setForm({
      expense_date: today,
      due_date: "",
      paid_at: today,
      amount: "",
      category: "outros",
      payee_name: "",
      description: "",
      payment_method: "pix",
      reference: "",
      notes: "",
      status: "paga",
    });

    setSaving(false);
    await loadExpenses();
  }

  async function markAsPaid(expense: Expense) {
    const confirmed = window.confirm(
      "Confirmar o pagamento desta despesa com a data de hoje?"
    );

    if (!confirmed) return;

    setProcessingId(expense.id);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("expenses")
      .update({
        status: "paga",
        paid_at: today,
        payment_method: expense.payment_method || "pix",
        updated_at: new Date().toISOString(),
      })
      .eq("id", expense.id);

    if (error) {
      setMessage(error.message || "Não foi possível marcar a despesa como paga.");
      setProcessingId(null);
      return;
    }

    setSuccessMessage("Despesa marcada como paga.");
    setProcessingId(null);
    await loadExpenses();
  }

  async function cancelExpense(expense: Expense) {
    const confirmed = window.confirm(
      "Tem certeza que deseja cancelar esta despesa? Ela continuará no histórico, mas não contará como saída paga."
    );

    if (!confirmed) return;

    setProcessingId(expense.id);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("expenses")
      .update({
        status: "cancelada",
        updated_at: new Date().toISOString(),
      })
      .eq("id", expense.id);

    if (error) {
      setMessage(error.message || "Não foi possível cancelar a despesa.");
      setProcessingId(null);
      return;
    }

    setSuccessMessage("Despesa cancelada.");
    setProcessingId(null);
    await loadExpenses();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Saídas financeiras
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Despesas
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Registre e acompanhe despesas da Associação, identificando favorecido, finalidade, valor, vencimento e pagamento.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Despesas pagas serão consideradas como saídas no Movimento Financeiro após a integração. Despesas pendentes servem para controle de obrigações futuras.
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
            Nova despesa
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Data da despesa
                </span>

                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      expense_date: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      due_date: event.target.value,
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
                  Status
                </span>

                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      status: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                >
                  <option value="paga">Paga</option>
                  <option value="pendente">Pendente</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Data do pagamento
                </span>

                <input
                  type="date"
                  value={form.paid_at}
                  disabled={form.status !== "paga"}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      paid_at: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none disabled:bg-slate-50"
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
                  disabled={form.status !== "paga"}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payment_method: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none disabled:bg-slate-50"
                >
                  {paymentMethodOptions.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Favorecido/fornecedor
                </span>

                <input
                  type="text"
                  value={form.payee_name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payee_name: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Cartório, fornecedor, prestador..."
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Descrição/finalidade
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
                placeholder="Ex.: Pagamento de taxa de registro da Associação"
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
                placeholder="Ex.: ID do Pix, número do recibo, comprovante, nota fiscal..."
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
                placeholder="Informações adicionais sobre a despesa."
                className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-fit rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Registrar despesa"}
            </button>
          </form>
        </section>

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Pagas no período</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.paidTotal)}
            </p>
            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.paidCount} despesa(s)
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Pendentes</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {formatCurrency(summary.pendingTotal)}
            </p>
            <p className="mt-2 text-sm font-bold text-[#596579]">
              {summary.pendingCount} despesa(s)
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Canceladas</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.canceledCount}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Registros</p>
            <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.totalCount}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Mês
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
                Status
              </span>

              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              >
                <option value="todos">Todos</option>
                <option value="paga">Pagas</option>
                <option value="pendente">Pendentes</option>
                <option value="cancelada">Canceladas</option>
              </select>
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
                <option value="todas">Todas</option>
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
                onClick={loadExpenses}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Despesas registradas
          </h2>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando despesas...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhuma despesa encontrada
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Não há despesas para o mês, status e categoria selecionados.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {filteredExpenses.map((expense) => (
                <article
                  key={expense.id}
                  className="rounded-3xl border border-[#e8dccb] p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                          {categoryLabels[expense.category] ?? expense.category}
                        </p>

                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${getStatusClass(expense.status)}`}
                        >
                          {statusLabels[expense.status] ?? expense.status}
                        </span>
                      </div>

                      <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                        {formatCurrency(expense.amount)}
                      </h3>

                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        {expense.description}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-sm font-black text-[#13233a]">
                        {expense.status === "paga"
                          ? formatDate(expense.paid_at)
                          : formatDate(expense.expense_date)}
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        {expense.status === "paga"
                          ? paymentMethodLabels[expense.payment_method ?? ""] ??
                            expense.payment_method ??
                            "Forma não informada"
                          : "Pendente"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-[#596579] md:grid-cols-2">
                    <p>
                      <strong>Favorecido/fornecedor:</strong>{" "}
                      {expense.payee_name || "Não informado"}
                    </p>

                    <p>
                      <strong>Vencimento:</strong>{" "}
                      {formatDate(expense.due_date)}
                    </p>

                    <p>
                      <strong>Referência:</strong>{" "}
                      {expense.reference || "Não informado"}
                    </p>

                    <p>
                      <strong>Registro:</strong>{" "}
                      {formatDate(expense.created_at)}
                    </p>
                  </div>

                  {expense.notes && (
                    <p className="mt-3 whitespace-pre-line rounded-2xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                      {expense.notes}
                    </p>
                  )}

                  {expense.status !== "cancelada" && (
                    <div className="mt-4 flex flex-col gap-3 md:flex-row">
                      {expense.status === "pendente" && (
                        <button
                          type="button"
                          onClick={() => markAsPaid(expense)}
                          disabled={processingId === expense.id}
                          className="rounded-full bg-green-700 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Marcar como paga
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => cancelExpense(expense)}
                        disabled={processingId === expense.id}
                        className="rounded-full bg-red-700 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancelar despesa
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
