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
  receipt_path: string | null;
  receipt_filename: string | null;
  receipt_mime_type: string | null;
  receipt_size: number | null;
  receipt_uploaded_at: string | null;
  created_at: string;
};

const categories = [
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

const statusOptions = [
  { value: "pendente", label: "Pendente" },
  { value: "paga", label: "Paga" },
  { value: "cancelada", label: "Cancelada" },
];

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  deposito: "Depósito",
  cartao: "Cartão",
  outros: "Outros",
};

const allowedReceiptTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
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

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthFromDate(value: string) {
  return value ? value.slice(0, 7) : "";
}

function getReferenceDate(expense: Expense) {
  return expense.status === "paga" && expense.paid_at
    ? expense.paid_at
    : expense.expense_date;
}

function getCategoryLabel(value: string) {
  return categories.find((category) => category.value === value)?.label ?? value;
}

function getStatusLabel(value: string) {
  return statusOptions.find((status) => status.value === value)?.label ?? value;
}

function getStatusClass(status: string) {
  if (status === "paga") {
    return "bg-green-100 text-green-800";
  }

  if (status === "cancelada") {
    return "bg-red-100 text-red-800";
  }

  return "bg-amber-100 text-amber-800";
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function formatFileSize(size?: number | null) {
  if (!size) return "Tamanho não informado";

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DashboardDespesasPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [filters, setFilters] = useState({
    month: getCurrentMonth(),
    status: "todos",
    category: "todas",
  });

  const [form, setForm] = useState({
    expense_date: getToday(),
    due_date: "",
    paid_at: "",
    amount: "",
    category: "outros",
    payee_name: "",
    description: "",
    status: "pendente",
    payment_method: "pix",
    reference: "",
    notes: "",
  });

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const sameMonth = getMonthFromDate(getReferenceDate(expense)) === filters.month;

      const statusMatches =
        filters.status === "todos" || expense.status === filters.status;

      const categoryMatches =
        filters.category === "todas" || expense.category === filters.category;

      return sameMonth && statusMatches && categoryMatches;
    });
  }, [expenses, filters]);

  const summary = useMemo(() => {
    const paidExpenses = filteredExpenses.filter(
      (expense) => expense.status === "paga"
    );

    const pendingExpenses = filteredExpenses.filter(
      (expense) => expense.status === "pendente"
    );

    const canceledExpenses = filteredExpenses.filter(
      (expense) => expense.status === "cancelada"
    );

    const paidWithoutReceipt = paidExpenses.filter(
      (expense) => !expense.receipt_path
    );

    return {
      paidTotal: paidExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0
      ),
      pendingTotal: pendingExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0
      ),
      canceledTotal: canceledExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount ?? 0),
        0
      ),
      totalCount: filteredExpenses.length,
      paidCount: paidExpenses.length,
      pendingCount: pendingExpenses.length,
      canceledCount: canceledExpenses.length,
      paidWithoutReceiptCount: paidWithoutReceipt.length,
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

  async function uploadReceipt(expenseId: string, file: File) {
    if (!allowedReceiptTypes.includes(file.type)) {
      throw new Error("Formato de comprovante inválido. Use PDF, JPG, PNG ou WEBP.");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error("O comprovante deve ter no máximo 10 MB.");
    }

    const supabase = createClient();
    const safeFileName = sanitizeFileName(file.name);
    const filePath = `expenses/${expenseId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("expense-receipts")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Não foi possível enviar o comprovante.");
    }

    const { error: updateError } = await supabase
      .from("expenses")
      .update({
        receipt_path: filePath,
        receipt_filename: file.name,
        receipt_mime_type: file.type,
        receipt_size: file.size,
        receipt_uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", expenseId);

    if (updateError) {
      throw new Error(
        updateError.message || "O arquivo foi enviado, mas não foi vinculado à despesa."
      );
    }
  }

  async function openReceipt(expense: Expense) {
    if (!expense.receipt_path) {
      setMessage("Esta despesa não possui comprovante anexado.");
      return;
    }

    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from("expense-receipts")
      .createSignedUrl(expense.receipt_path, 60 * 5);

    if (error || !data?.signedUrl) {
      setMessage(error?.message || "Não foi possível abrir o comprovante.");
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function loadExpenses() {
    setLoading(true);
    setMessage("");
    setSuccess("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, expense_date, due_date, paid_at, amount, category, payee_name, description, payment_method, reference, notes, status, receipt_path, receipt_filename, receipt_mime_type, receipt_size, receipt_uploaded_at, created_at"
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
    setSuccess("");

    const amount = Number(String(form.amount).replace(",", "."));

    if (!form.description.trim()) {
      setMessage("Informe a descrição da despesa.");
      setSaving(false);
      return;
    }

    if (Number.isNaN(amount) || amount <= 0) {
      setMessage("Informe um valor válido para a despesa.");
      setSaving(false);
      return;
    }

    if (form.status === "paga" && !form.paid_at) {
      setMessage("Informe a data de pagamento da despesa paga.");
      setSaving(false);
      return;
    }

    if (receiptFile && !allowedReceiptTypes.includes(receiptFile.type)) {
      setMessage("Formato de comprovante inválido. Use PDF, JPG, PNG ou WEBP.");
      setSaving(false);
      return;
    }

    if (receiptFile && receiptFile.size > 10 * 1024 * 1024) {
      setMessage("O comprovante deve ter no máximo 10 MB.");
      setSaving(false);
      return;
    }

    const profileId = await getCurrentProfileId();
    const supabase = createClient();

    const payload = {
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
      updated_at: new Date().toISOString(),
    };

    const { data: insertedExpense, error } = await supabase
      .from("expenses")
      .insert(payload)
      .select("id")
      .single();

    if (error || !insertedExpense?.id) {
      setMessage(error?.message || "Não foi possível registrar a despesa.");
      setSaving(false);
      return;
    }

    try {
      if (receiptFile) {
        await uploadReceipt(insertedExpense.id, receiptFile);
      }

      setSuccess("Despesa registrada com sucesso.");
    } catch (receiptError) {
      setMessage(
        receiptError instanceof Error
          ? `Despesa registrada, mas houve erro no comprovante: ${receiptError.message}`
          : "Despesa registrada, mas houve erro ao enviar o comprovante."
      );
    }

    setForm({
      expense_date: getToday(),
      due_date: "",
      paid_at: "",
      amount: "",
      category: "outros",
      payee_name: "",
      description: "",
      status: "pendente",
      payment_method: "pix",
      reference: "",
      notes: "",
    });

    setReceiptFile(null);

    const input = document.getElementById("receipt_file") as HTMLInputElement | null;
    if (input) input.value = "";

    setSaving(false);
    await loadExpenses();
  }

  async function handleAttachReceipt(expense: Expense, file: File) {
    setSaving(true);
    setMessage("");
    setSuccess("");

    try {
      await uploadReceipt(expense.id, file);
      setSuccess("Comprovante anexado com sucesso.");
      await loadExpenses();
    } catch (receiptError) {
      setMessage(
        receiptError instanceof Error
          ? receiptError.message
          : "Não foi possível anexar o comprovante."
      );
    } finally {
      setSaving(false);
    }
  }

  async function markAsPaid(expense: Expense) {
    setMessage("");
    setSuccess("");

    const supabase = createClient();

    const { error } = await supabase
      .from("expenses")
      .update({
        status: "paga",
        paid_at: expense.paid_at ?? getToday(),
        payment_method: expense.payment_method ?? "pix",
        updated_at: new Date().toISOString(),
      })
      .eq("id", expense.id);

    if (error) {
      setMessage(error.message || "Não foi possível marcar a despesa como paga.");
      return;
    }

    setSuccess("Despesa marcada como paga.");
    await loadExpenses();
  }

  async function cancelExpense(expense: Expense) {
    setMessage("");
    setSuccess("");

    const confirmed = window.confirm(
      "Deseja cancelar esta despesa? O registro ficará no histórico."
    );

    if (!confirmed) return;

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
      return;
    }

    setSuccess("Despesa cancelada.");
    await loadExpenses();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-5">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Financeiro
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Despesas
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Registre despesas, pagamentos e comprovantes vinculados às saídas da Associação.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          Despesas pendentes não entram como saída no Movimento Financeiro. Apenas despesas pagas reduzem o saldo do caixa.
        </p>

        {success && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="font-bold text-green-800">{success}</p>
          </section>
        )}

        {message && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </section>
        )}

        {summary.paidWithoutReceiptCount > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="font-bold text-amber-900">
              Atenção: há {summary.paidWithoutReceiptCount} despesa(s) paga(s) sem comprovante anexado no período filtrado.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Registrar despesa
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
                  required
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
                  value={form.amount}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      amount: event.target.value,
                    }))
                  }
                  required
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
                      paid_at:
                        event.target.value === "paga"
                          ? previous.paid_at || getToday()
                          : "",
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
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
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Favorecido/fornecedor
                </span>

                <input
                  value={form.payee_name}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payee_name: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Cartório, fornecedor, prestador de serviço"
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Descrição
              </span>

              <input
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                required
                placeholder="Ex.: Pagamento de taxa de registro em cartório"
                className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            {form.status === "paga" && (
              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Data do pagamento
                  </span>

                  <input
                    type="date"
                    value={form.paid_at}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        paid_at: event.target.value,
                      }))
                    }
                    required
                    className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Forma de pagamento
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
                    <option value="pix">Pix</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="transferencia">Transferência</option>
                    <option value="deposito">Depósito</option>
                    <option value="cartao">Cartão</option>
                    <option value="outros">Outros</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Referência/comprovante
                  </span>

                  <input
                    value={form.reference}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Ex.: ID Pix, boleto, recibo"
                    className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>
              </div>
            )}

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#13233a]">
                Comprovante/documento
              </span>

              <input
                id="receipt_file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setReceiptFile(file);
                }}
                className="w-full rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#13233a] outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[#13233a] file:px-4 file:py-2 file:text-sm file:font-black file:text-white"
              />

              <span className="text-xs font-bold text-[#596579]">
                Aceita PDF, JPG, PNG e WEBP até 10 MB. Para despesa pendente é opcional; para despesa paga é recomendado.
              </span>
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

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
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
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
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
                {categories.map((category) => (
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

        <section className="grid gap-5 md:grid-cols-4">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-green-800">
              Pagas no período
            </p>

            <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-green-800">
              {formatCurrency(summary.paidTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-green-800/80">
              {summary.paidCount} despesa(s)
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-amber-800">
              Pendentes
            </p>

            <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-amber-800">
              {formatCurrency(summary.pendingTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-amber-800/80">
              {summary.pendingCount} despesa(s)
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-red-800">
              Canceladas
            </p>

            <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-red-800">
              {formatCurrency(summary.canceledTotal)}
            </p>

            <p className="mt-1 text-xs font-bold text-red-800/80">
              {summary.canceledCount} despesa(s)
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-[#596579]">
              Registros
            </p>

            <p className="mt-1 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
              {summary.totalCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#596579]">
              No filtro atual
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
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
                Não há despesas para os filtros selecionados.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {filteredExpenses.map((expense) => (
                <article
                  key={expense.id}
                  className="rounded-xl border border-[#e8dccb] px-4 py-3"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] ${getStatusClass(
                            expense.status
                          )}`}
                        >
                          {getStatusLabel(expense.status)}
                        </span>

                        <span className="rounded-full bg-[#f7f8fa] px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                          {getCategoryLabel(expense.category)}
                        </span>

                        {expense.receipt_path ? (
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-green-800">
                            Comprovante anexado
                          </span>
                        ) : expense.status === "paga" ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-amber-800">
                            Sem comprovante
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-2 text-base font-black tracking-[-0.03em] text-[#13233a]">
                        {expense.description}
                      </h3>

                      <p className="mt-0.5 text-xs font-bold text-[#596579]">
                        Favorecido: {expense.payee_name || "Não informado"}
                      </p>

                      <p className="mt-0.5 text-xs font-bold text-[#596579]">
                        Data da despesa: {formatDate(expense.expense_date)} · Vencimento: {formatDate(expense.due_date)}
                      </p>

                      {expense.status === "paga" && (
                        <p className="mt-0.5 text-xs font-bold text-[#596579]">
                          Pago em: {formatDate(expense.paid_at)} · Forma:{" "}
                          {expense.payment_method
                            ? paymentMethodLabels[expense.payment_method] ??
                              expense.payment_method
                            : "Não informado"}
                        </p>
                      )}

                      {expense.reference && (
                        <p className="mt-0.5 text-xs font-bold text-[#596579]">
                          Referência: {expense.reference}
                        </p>
                      )}

                      {expense.receipt_path && (
                        <p className="mt-0.5 text-xs font-bold text-[#596579]">
                          Arquivo: {expense.receipt_filename || "Comprovante"} · {formatFileSize(expense.receipt_size)}
                        </p>
                      )}
                    </div>

                    <div className="md:text-right">
                      <p className="text-lg font-black tracking-[-0.04em] text-red-700">
                        {formatCurrency(expense.amount)}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 md:justify-end">
                        {expense.receipt_path && (
                          <button
                            type="button"
                            onClick={() => openReceipt(expense)}
                            className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]"
                          >
                            Ver comprovante
                          </button>
                        )}

                        {!expense.receipt_path && expense.status !== "cancelada" && (
                          <label className="cursor-pointer rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]">
                            {saving ? "Enviando..." : "Anexar comprovante"}

                            <input
                              type="file"
                              accept="application/pdf,image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;

                                if (file) {
                                  void handleAttachReceipt(expense, file);
                                }

                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        )}

                        {expense.status === "pendente" && (
                          <button
                            type="button"
                            onClick={() => markAsPaid(expense)}
                            className="rounded-full bg-green-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white"
                          >
                            Marcar como paga
                          </button>
                        )}

                        {expense.status !== "cancelada" && (
                          <button
                            type="button"
                            onClick={() => cancelExpense(expense)}
                            className="rounded-full bg-red-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {expense.notes && (
                    <p className="mt-2 whitespace-pre-line rounded-xl bg-[#f7f8fa] px-3 py-2 text-xs leading-5 text-[#596579]">
                      {expense.notes}
                    </p>
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
