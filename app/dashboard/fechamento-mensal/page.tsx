"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { registerAuditLog } from "@/lib/audit";

type Payment = {
  id: string;
  amount: number;
  paid_at: string;
};

type OtherRevenue = {
  id: string;
  received_at: string;
  amount: number;
  status: string;
};

type Expense = {
  id: string;
  paid_at: string | null;
  amount: number;
  status: string;
  receipt_path: string | null;
};

type CashMonthlyBalance = {
  id: string;
  month_ref: string;
  opening_balance: number;
};

type MonthlyClosingLog = {
  id: string;
  monthly_closing_id: string | null;
  month_ref: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
};

type MonthlyClosing = {
  id: string;
  month_ref: string;
  status: string;
  opening_balance: number;
  total_entries: number;
  total_exits: number;
  period_result: number;
  final_balance: number;
  bank_balance: number | null;
  difference_amount: number | null;
  checked_with_bank_statement: boolean;
  has_pending_receipts: boolean;
  notes: string | null;
  closed_at: string;
  reopened_at: string | null;
  reopen_reason: string | null;
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

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthToDate(month: string) {
  return `${month}-01`;
}

function getMonthFromDate(value?: string | null) {
  return value ? value.slice(0, 7) : "";
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  const index = Number(monthNumber) - 1;

  return `${monthNames[index] ?? monthNumber} de ${year}`;
}

function parseMoney(value: string) {
  const cleaned = value.trim();

  if (!cleaned) return null;

  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);

  if (Number.isNaN(number)) return null;

  return number;
}

function getConciliationInfo(difference: number | null) {
  if (difference === null) {
    return {
      title: "Informe o saldo do extrato para calcular a diferença.",
      description:
        "Digite o saldo final real da conta bancária no último dia do mês selecionado.",
      status: "neutral",
    };
  }

  if (Math.abs(difference) < 0.01) {
    return {
      title: "Banco e sistema conferem.",
      description:
        "O saldo do extrato é igual ao saldo final apurado pelos lançamentos do sistema.",
      status: "ok",
    };
  }

  if (difference > 0) {
    return {
      title: "O saldo do banco está maior que o saldo calculado pelo sistema.",
      description:
        "Verifique se faltou lançar alguma entrada, se alguma despesa foi lançada em duplicidade, se houve despesa lançada a maior ou se o saldo inicial está incorreto.",
      status: "warning",
    };
  }

  return {
    title: "O saldo calculado pelo sistema está maior que o saldo do banco.",
    description:
      "Verifique se faltou lançar alguma despesa, tarifa bancária ou saída, se alguma receita foi lançada a maior ou se o saldo inicial está incorreto.",
    status: "danger",
  };
}

function getLogActionLabel(action: string) {
  if (action === "fechamento") return "Fechamento registrado";
  if (action === "atualizacao_fechamento") return "Fechamento atualizado";
  if (action === "reabertura") return "Mês reaberto";
  return action;
}

function formatStatus(status?: string | null) {
  if (!status) return "—";
  if (status === "fechado") return "Fechado";
  if (status === "reaberto") return "Reaberto";
  return status;
}

export default function DashboardFechamentoMensalPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenues, setRevenues] = useState<OtherRevenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashBalance, setCashBalance] = useState<CashMonthlyBalance | null>(null);
  const [closings, setClosings] = useState<MonthlyClosing[]>([]);
  const [logs, setLogs] = useState<MonthlyClosingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    bank_balance: "",
    checked_with_bank_statement: false,
    notes: "",
  });

  const selectedClosing = useMemo(() => {
    return closings.find((closing) => getMonthFromDate(closing.month_ref) === month) ?? null;
  }, [closings, month]);

  const selectedMonthLogs = useMemo(() => {
    return logs.filter((log) => getMonthFromDate(log.month_ref) === month);
  }, [logs, month]);

  const summary = useMemo(() => {
    const monthPayments = payments.filter(
      (payment) => getMonthFromDate(payment.paid_at) === month
    );

    const monthRevenues = revenues.filter(
      (revenue) =>
        revenue.status === "confirmada" &&
        getMonthFromDate(revenue.received_at) === month
    );

    const monthExpenses = expenses.filter(
      (expense) =>
        expense.status === "paga" &&
        expense.paid_at &&
        getMonthFromDate(expense.paid_at) === month
    );

    const entriesFromPayments = monthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0
    );

    const entriesFromRevenues = monthRevenues.reduce(
      (sum, revenue) => sum + Number(revenue.amount ?? 0),
      0
    );

    const totalEntries = Number((entriesFromPayments + entriesFromRevenues).toFixed(2));

    const totalExits = Number(
      monthExpenses
        .reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
        .toFixed(2)
    );

    const openingBalance = Number(cashBalance?.opening_balance ?? 0);
    const periodResult = Number((totalEntries - totalExits).toFixed(2));
    const finalBalance = Number((openingBalance + periodResult).toFixed(2));

    const expensesWithoutReceipt = monthExpenses.filter(
      (expense) => !expense.receipt_path
    );

    const bankBalance = parseMoney(form.bank_balance);
    const difference =
      bankBalance === null
        ? null
        : Number((bankBalance - finalBalance).toFixed(2));

    return {
      openingBalance,
      totalEntries,
      totalExits,
      periodResult,
      finalBalance,
      paymentsCount: monthPayments.length,
      revenuesCount: monthRevenues.length,
      expensesCount: monthExpenses.length,
      expensesWithoutReceiptCount: expensesWithoutReceipt.length,
      hasPendingReceipts: expensesWithoutReceipt.length > 0,
      bankBalance,
      difference,
    };
  }, [payments, revenues, expenses, cashBalance, month, form.bank_balance]);

  const conciliationInfo = useMemo(() => {
    return getConciliationInfo(summary.difference);
  }, [summary.difference]);

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
    setSuccess("");

    const supabase = createClient();

    const { data: paymentsData, error: paymentsError } = await supabase
      .from("payments")
      .select("id, amount, paid_at")
      .order("paid_at", { ascending: false });

    if (paymentsError) {
      setMessage(paymentsError.message || "Não foi possível carregar pagamentos.");
      setLoading(false);
      return;
    }

    const { data: revenuesData, error: revenuesError } = await supabase
      .from("other_revenues")
      .select("id, received_at, amount, status")
      .order("received_at", { ascending: false });

    if (revenuesError) {
      setMessage(revenuesError.message || "Não foi possível carregar receitas.");
      setLoading(false);
      return;
    }

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select("id, paid_at, amount, status, receipt_path")
      .order("paid_at", { ascending: false });

    if (expensesError) {
      setMessage(expensesError.message || "Não foi possível carregar despesas.");
      setLoading(false);
      return;
    }

    const { data: balanceData, error: balanceError } = await supabase
      .from("cash_monthly_balances")
      .select("id, month_ref, opening_balance")
      .eq("month_ref", monthToDate(month))
      .maybeSingle();

    if (balanceError) {
      setMessage(balanceError.message || "Não foi possível carregar saldo inicial.");
      setLoading(false);
      return;
    }

    const { data: closingsData, error: closingsError } = await supabase
      .from("monthly_closings")
      .select(
        "id, month_ref, status, opening_balance, total_entries, total_exits, period_result, final_balance, bank_balance, difference_amount, checked_with_bank_statement, has_pending_receipts, notes, closed_at, reopened_at, reopen_reason"
      )
      .order("month_ref", { ascending: false });

    if (closingsError) {
      setMessage(closingsError.message || "Não foi possível carregar fechamentos.");
      setLoading(false);
      return;
    }

    const { data: logsData, error: logsError } = await supabase
      .from("monthly_closing_logs")
      .select(
        "id, monthly_closing_id, month_ref, action, previous_status, new_status, reason, notes, created_at"
      )
      .order("created_at", { ascending: false });

    if (logsError) {
      setMessage(logsError.message || "Não foi possível carregar o histórico do fechamento.");
      setLoading(false);
      return;
    }

    setPayments((paymentsData as unknown as Payment[]) ?? []);
    setRevenues((revenuesData as unknown as OtherRevenue[]) ?? []);
    setExpenses((expensesData as unknown as Expense[]) ?? []);
    setCashBalance((balanceData as unknown as CashMonthlyBalance) ?? null);
    setClosings((closingsData as unknown as MonthlyClosing[]) ?? []);
    setLogs((logsData as unknown as MonthlyClosingLog[]) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    if (selectedClosing) {
      setForm({
        bank_balance:
          selectedClosing.bank_balance === null
            ? ""
            : String(Number(selectedClosing.bank_balance)).replace(".", ","),
        checked_with_bank_statement: selectedClosing.checked_with_bank_statement,
        notes: selectedClosing.notes ?? "",
      });
    } else {
      setForm({
        bank_balance: "",
        checked_with_bank_statement: false,
        notes: "",
      });
    }
  }, [selectedClosing?.id]);

  async function closeMonth() {
    setSaving(true);
    setMessage("");
    setSuccess("");

    if (!cashBalance) {
      setMessage("Cadastre o saldo inicial do mês antes de fazer o fechamento.");
      setSaving(false);
      return;
    }

    if (summary.bankBalance === null) {
      setMessage("Informe o saldo final conforme extrato bancário.");
      setSaving(false);
      return;
    }

    if (!form.checked_with_bank_statement) {
      setMessage("Marque a conferência com extrato bancário antes de fechar o mês.");
      setSaving(false);
      return;
    }

    if (
      summary.difference !== null &&
      Math.abs(summary.difference) >= 0.01 &&
      !form.notes.trim()
    ) {
      setMessage(
        "Existe diferença entre banco e sistema. Informe uma observação justificando a diferença ou corrija os lançamentos antes de fechar o mês."
      );
      setSaving(false);
      return;
    }

    const profileId = await getCurrentProfileId();
    const supabase = createClient();

    const payload = {
      month_ref: monthToDate(month),
      status: "fechado",
      opening_balance: summary.openingBalance,
      total_entries: summary.totalEntries,
      total_exits: summary.totalExits,
      period_result: summary.periodResult,
      final_balance: summary.finalBalance,
      bank_balance: summary.bankBalance,
      difference_amount: summary.difference,
      checked_with_bank_statement: form.checked_with_bank_statement,
      has_pending_receipts: summary.hasPendingReceipts,
      notes: form.notes.trim() || null,
      closed_by: profileId,
      closed_at: new Date().toISOString(),
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("monthly_closings")
      .upsert(payload, { onConflict: "month_ref" });

    if (error) {
  setMessage(error.message || "Não foi possível fechar o mês.");
  setSaving(false);
  return;
}

await registerAuditLog({
  supabase,
  action: selectedClosing ? "update_monthly_closing" : "close_monthly_period",
  module: "fechamento_mensal",
  tableName: "monthly_closings",
  recordId: selectedClosing?.id ?? monthToDate(month),
  description: selectedClosing
    ? `Atualizou o fechamento mensal de ${formatMonth(month)}.`
    : `Fechou o mês de ${formatMonth(month)}.`,
  oldData: selectedClosing
    ? {
        status: selectedClosing.status,
        opening_balance: selectedClosing.opening_balance,
        total_entries: selectedClosing.total_entries,
        total_exits: selectedClosing.total_exits,
        period_result: selectedClosing.period_result,
        final_balance: selectedClosing.final_balance,
        bank_balance: selectedClosing.bank_balance,
        difference_amount: selectedClosing.difference_amount,
        checked_with_bank_statement: selectedClosing.checked_with_bank_statement,
        has_pending_receipts: selectedClosing.has_pending_receipts,
        notes: selectedClosing.notes,
      }
    : null,
  newData: {
    month_ref: payload.month_ref,
    status: payload.status,
    opening_balance: payload.opening_balance,
    total_entries: payload.total_entries,
    total_exits: payload.total_exits,
    period_result: payload.period_result,
    final_balance: payload.final_balance,
    bank_balance: payload.bank_balance,
    difference_amount: payload.difference_amount,
    checked_with_bank_statement: payload.checked_with_bank_statement,
    has_pending_receipts: payload.has_pending_receipts,
    notes: payload.notes,
    closed_by: payload.closed_by,
    closed_at: payload.closed_at,
  },
});

setSuccess("Fechamento mensal registrado com sucesso.");
setSaving(false);
await loadData();
  }

  async function reopenMonth() {
    setMessage("");
    setSuccess("");

    if (!selectedClosing) return;

    const reason = window.prompt(
      "Informe o motivo da reabertura do mês. Ex.: corrigir receita lançada incorretamente, incluir tarifa bancária, corrigir despesa duplicada etc."
    );

    if (reason === null) return;

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      setMessage("Informe uma justificativa mais detalhada para reabrir o mês.");
      return;
    }

    const confirmed = window.confirm(
      "Confirma a reabertura deste mês? Após reabrir, lançamentos financeiros do mês poderão ser alterados e o mês deverá ser fechado novamente."
    );

    if (!confirmed) return;

    setSaving(true);

    const profileId = await getCurrentProfileId();
    const supabase = createClient();

    const { error } = await supabase
      .from("monthly_closings")
      .update({
        status: "reaberto",
        reopened_by: profileId,
        reopened_at: new Date().toISOString(),
        reopen_reason: trimmedReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedClosing.id);

    if (error) {
  setMessage(error.message || "Não foi possível reabrir o mês.");
  setSaving(false);
  return;
}

await registerAuditLog({
  supabase,
  action: "reopen_monthly_period",
  module: "fechamento_mensal",
  tableName: "monthly_closings",
  recordId: selectedClosing.id,
  description: `Reabriu o mês de ${formatMonth(month)}.`,
  oldData: {
    status: selectedClosing.status,
    month_ref: selectedClosing.month_ref,
    opening_balance: selectedClosing.opening_balance,
    total_entries: selectedClosing.total_entries,
    total_exits: selectedClosing.total_exits,
    period_result: selectedClosing.period_result,
    final_balance: selectedClosing.final_balance,
    bank_balance: selectedClosing.bank_balance,
    difference_amount: selectedClosing.difference_amount,
    notes: selectedClosing.notes,
    closed_at: selectedClosing.closed_at,
    reopened_at: selectedClosing.reopened_at,
    reopen_reason: selectedClosing.reopen_reason,
  },
  newData: {
    status: "reaberto",
    month_ref: selectedClosing.month_ref,
    reopened_by: profileId,
    reopened_at: new Date().toISOString(),
    reopen_reason: trimmedReason,
  },
});

setSuccess("Mês reaberto com justificativa registrada.");
setSaving(false);
await loadData();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
            Caixa
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Fechamento Mensal
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Confira o saldo mensal do sistema com o extrato bancário e registre a situação do caixa.
          </p>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[280px_auto_1fr] md:items-end">
            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-[#13233a]">
                Mês para fechamento
              </span>

              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <button
              type="button"
              onClick={loadData}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Atualizar
            </button>

            {selectedClosing && (
              <div className="flex justify-start md:justify-end">
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                    selectedClosing.status === "fechado"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {selectedClosing.status === "fechado" ? "Mês fechado" : "Mês reaberto"}
                </span>
              </div>
            )}
          </div>
        </section>

        {message && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-red-700">{message}</p>
          </section>
        )}

        {success && (
          <section className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-green-800">{success}</p>
          </section>
        )}

        {!cashBalance && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-amber-900">
              Cadastre o saldo inicial deste mês em “Saldos do Caixa” antes de fazer o fechamento.
            </p>
          </section>
        )}

        {selectedClosing?.status === "reaberto" && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-black text-amber-900">
              Este mês está reaberto para correção.
            </p>

            <p className="mt-1 text-xs font-bold leading-5 text-amber-900">
              Motivo: {selectedClosing.reopen_reason || "Motivo não informado."}
            </p>

            <p className="mt-1 text-xs font-bold leading-5 text-amber-900">
              Após concluir os ajustes, faça novo fechamento e confira se o saldo final alterou o saldo inicial dos meses seguintes.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Resumo de {formatMonth(month)}
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Valores apurados com base nos lançamentos do painel.
              </p>
            </div>

            {selectedClosing && (
              <p className="text-xs font-bold text-[#596579]">
                Fechado em {formatDate(selectedClosing.closed_at)}
                {selectedClosing.reopened_at
                  ? ` • Reaberto em ${formatDate(selectedClosing.reopened_at)}`
                  : ""}
              </p>
            )}
          </div>

          {loading ? (
            <p className="mt-4 text-sm font-bold text-[#596579]">
              Carregando dados do fechamento...
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b border-[#eee7db]">
                    <td className="bg-[#fafafa] px-3 py-2 font-bold text-[#596579]">
                      Saldo inicial
                    </td>
                    <td className="px-3 py-2 text-right font-black text-[#13233a]">
                      {formatCurrency(summary.openingBalance)}
                    </td>
                  </tr>

                  <tr className="border-b border-[#eee7db]">
                    <td className="bg-[#fafafa] px-3 py-2 font-bold text-[#596579]">
                      Entradas do mês
                    </td>
                    <td className="px-3 py-2 text-right font-black text-green-700">
                      {formatCurrency(summary.totalEntries)}
                    </td>
                  </tr>

                  <tr className="border-b border-[#eee7db]">
                    <td className="bg-[#fafafa] px-3 py-2 font-bold text-[#596579]">
                      Saídas do mês
                    </td>
                    <td className="px-3 py-2 text-right font-black text-red-700">
                      {formatCurrency(summary.totalExits)}
                    </td>
                  </tr>

                  <tr className="border-b border-[#eee7db]">
                    <td className="bg-[#fafafa] px-3 py-2 font-bold text-[#596579]">
                      Resultado do mês
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-black ${
                        summary.periodResult < 0 ? "text-red-700" : "text-[#13233a]"
                      }`}
                    >
                      {formatCurrency(summary.periodResult)}
                    </td>
                  </tr>

                  <tr>
                    <td className="bg-[#fafafa] px-3 py-2 font-black text-[#13233a]">
                      Saldo final apurado pelo sistema
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-black ${
                        summary.finalBalance < 0 ? "text-red-700" : "text-[#13233a]"
                      }`}
                    >
                      {formatCurrency(summary.finalBalance)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
            Conciliação bancária
          </h2>

          <p className="mt-1 text-sm leading-6 text-[#596579]">
            Informe o saldo final do extrato bancário. O sistema calcula automaticamente se o saldo do banco confere com o saldo apurado no painel.
          </p>



          {summary.finalBalance < 0 && (
            <p className="mt-3 rounded-xl border border-[#f1d4d4] bg-[#fffafa] px-3 py-2 text-xs font-bold leading-5 text-[#8b1e1e]">
              O saldo final apurado pelo sistema está negativo. Confira se faltou lançar alguma entrada, se alguma despesa foi registrada em duplicidade ou se o saldo inicial está correto.
            </p>
          )}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] p-4">
              <label className="block text-sm font-bold text-[#13233a]">
                Saldo final conforme extrato bancário
              </label>

              <p className="mt-1 text-xs leading-5 text-[#596579]">
                Digite exatamente o saldo que aparece no extrato no último dia do mês.
              </p>

              <input
                value={form.bank_balance}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    bank_balance: event.target.value,
                  }))
                }
                placeholder="0,00"
                className="mt-3 w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
              />
            </div>

            <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] p-4">
              <p className="text-sm font-bold text-[#13233a]">
                Diferença a conciliar
              </p>

              <p
                className={`mt-2 text-2xl font-black tracking-[-0.04em] ${
                  conciliationInfo.status === "ok"
                    ? "text-green-700"
                    : summary.difference === null
                      ? "text-[#13233a]"
                      : "text-red-700"
                }`}
              >
                {summary.difference === null
                  ? "R$ 0,00"
                  : formatCurrency(Math.abs(summary.difference))}
              </p>

              <p className="mt-2 text-sm font-black text-[#13233a]">
                {conciliationInfo.title}
              </p>

              <p className="mt-1 text-xs leading-5 text-[#596579]">
                {conciliationInfo.description}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#e8dccb] bg-white p-3">
            <p className="text-sm font-black text-[#13233a]">
              Pontos de conferência
            </p>

            <div className="mt-2 grid gap-2 text-xs font-bold leading-5 text-[#596579] md:grid-cols-2">
              <p>• Saldo inicial do mês está correto?</p>
              <p>• Todas as entradas foram lançadas?</p>
              <p>• Todas as despesas pagas foram lançadas?</p>
              <p>• Há tarifa bancária, duplicidade ou ajuste pendente?</p>
            </div>
          </div>

          {summary.hasPendingReceipts && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
              Existem {summary.expensesWithoutReceiptCount} despesa(s) paga(s) sem comprovante neste mês.
            </p>
          )}

          <label className="mt-4 grid gap-2">
            <span className="text-sm font-bold text-[#13233a]">
              Observações do fechamento
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
              placeholder="Ex.: banco e sistema conferidos sem diferença; diferença justificada por tarifa bancária; entrada pendente de lançamento; despesa em duplicidade a corrigir."
              className="w-full resize-none rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm text-[#13233a] outline-none"
            />
          </label>

          <label className="mt-4 flex items-start gap-3 rounded-xl border border-[#e8dccb] bg-[#fcfcfd] px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.checked_with_bank_statement}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  checked_with_bank_statement: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4"
            />

            <span className="text-sm font-bold leading-6 text-[#13233a]">
              Confirmo que o saldo final foi conferido com o extrato bancário e que eventuais diferenças foram corrigidas ou justificadas.
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={closeMonth}
              disabled={saving}
              className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : selectedClosing ? "Atualizar fechamento" : "Fechar mês"}
            </button>

            {selectedClosing?.status === "fechado" && (
              <button
                type="button"
                onClick={reopenMonth}
                disabled={saving}
                className="rounded-full border border-amber-300 bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reabrir mês
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
            Fechamentos registrados
          </h2>

          {closings.length === 0 ? (
            <p className="mt-3 text-sm font-bold text-[#596579]">
              Nenhum fechamento mensal registrado.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-[#fafafa] text-[11px] uppercase tracking-[0.08em] text-[#596579]">
                  <tr>
                    <th className="px-3 py-2.5">Mês</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Sistema</th>
                    <th className="px-3 py-2.5 text-right">Banco</th>
                    <th className="px-3 py-2.5 text-right">Diferença</th>
                    <th className="px-3 py-2.5">Fechado em</th>
                  </tr>
                </thead>

                <tbody>
                  {closings.map((closing) => (
                    <tr key={closing.id} className="border-t border-[#eee7db]">
                      <td className="px-3 py-2.5 font-bold text-[#13233a]">
                        {formatMonth(getMonthFromDate(closing.month_ref))}
                      </td>

                      <td className="px-3 py-2.5 font-bold text-[#596579]">
                        {closing.status === "fechado" ? "Fechado" : "Reaberto"}
                      </td>

                      <td className="px-3 py-2.5 text-right font-black text-[#13233a]">
                        {formatCurrency(closing.final_balance)}
                      </td>

                      <td className="px-3 py-2.5 text-right font-black text-[#13233a]">
                        {formatCurrency(closing.bank_balance)}
                      </td>

                      <td
                        className={`px-3 py-2.5 text-right font-black ${
                          Math.abs(Number(closing.difference_amount ?? 0)) < 0.01
                            ? "text-[#13233a]"
                            : "text-red-700"
                        }`}
                      >
                        {formatCurrency(Math.abs(Number(closing.difference_amount ?? 0)))}
                      </td>

                      <td className="px-3 py-2.5 font-bold text-[#596579]">
                        {formatDate(closing.closed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-sm font-black tracking-[-0.02em] text-[#13233a]">
                Histórico do mês selecionado
              </h2>

              <p className="text-[11px] font-bold text-[#596579]">
                Registro técnico de alterações do fechamento.
              </p>
            </div>

            <p className="text-[11px] font-bold text-[#596579]">
              {selectedMonthLogs.length} ocorrência(s)
            </p>
          </div>

          {selectedMonthLogs.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#f7f8fa] px-4 py-3 text-xs font-bold text-[#596579]">
              Nenhum histórico encontrado para este mês.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                <div className="col-span-3">Ocorrência</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-5">Justificativa/observações</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {selectedMonthLogs.map((log) => (
                  <article
                    key={log.id}
                    className="grid gap-2 px-3 py-2 text-xs md:grid-cols-12 md:items-start"
                  >
                    <div className="md:col-span-3">
                      <p className={`font-bold ${log.action === "reabertura" ? "text-amber-800" : "text-[#13233a]"}`}>
                        {getLogActionLabel(log.action)}
                      </p>

                      <p className="text-[11px] font-bold text-[#596579]">
                        {formatMonth(month)}
                      </p>
                    </div>

                    <div className="font-bold text-[#596579] md:col-span-2">
                      {formatDate(log.created_at)}
                    </div>

                    <div className="font-bold text-[#596579] md:col-span-2">
                      {formatStatus(log.previous_status)} → {formatStatus(log.new_status)}
                    </div>

                    <div className="space-y-1 md:col-span-5">
                      {log.reason && (
                        <p className="font-bold text-[#13233a]">
                          Motivo: {log.reason}
                        </p>
                      )}

                      {log.notes && (
                        <p className="text-[11px] font-bold leading-5 text-[#596579]">
                          Observações: {log.notes}
                        </p>
                      )}

                      {!log.reason && !log.notes && (
                        <p className="text-[11px] font-bold text-[#596579]">
                          Sem justificativa adicional.
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
