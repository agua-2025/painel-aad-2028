"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type CashMonthlyBalance = {
  id: string;
  month_ref: string;
  opening_balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthToDate(month: string) {
  return `${month}-01`;
}

function dateToMonth(value: string) {
  return value.slice(0, 7);
}

function formatMonth(value: string) {
  const [year, month] = value.slice(0, 7).split("-");
  const monthIndex = Number(month) - 1;

  return `${monthNames[monthIndex] ?? month}/${year}`;
}

export default function DashboardSaldosCaixaPage() {
  const [balances, setBalances] = useState<CashMonthlyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    month: getCurrentMonth(),
    opening_balance: "",
    notes: "",
  });

  const selectedBalance = useMemo(() => {
    return balances.find(
      (balance) => dateToMonth(balance.month_ref) === form.month
    );
  }, [balances, form.month]);

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

  async function loadBalances() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("cash_monthly_balances")
      .select("id, month_ref, opening_balance, notes, created_at, updated_at")
      .order("month_ref", { ascending: false });

    if (error) {
      console.error("Erro ao carregar saldos:", error);
      setMessage(error.message || "Não foi possível carregar os saldos do caixa.");
      setLoading(false);
      return;
    }

    setBalances((data as unknown as CashMonthlyBalance[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadBalances();
  }, []);

  useEffect(() => {
    if (selectedBalance) {
      setForm((previous) => ({
        ...previous,
        opening_balance: String(Number(selectedBalance.opening_balance ?? 0)),
        notes: selectedBalance.notes ?? "",
      }));
    } else {
      setForm((previous) => ({
        ...previous,
        opening_balance: "",
        notes: "",
      }));
    }
  }, [selectedBalance?.id]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    if (!form.month) {
      setMessage("Informe o mês do saldo.");
      setSaving(false);
      return;
    }

    const openingBalance = Number(String(form.opening_balance).replace(",", "."));

    if (Number.isNaN(openingBalance)) {
      setMessage("Informe um valor válido para o saldo inicial.");
      setSaving(false);
      return;
    }

    const profileId = await getCurrentProfileId();
    const supabase = createClient();

    const payload = {
      month_ref: monthToDate(form.month),
      opening_balance: openingBalance,
      notes: form.notes.trim() || null,
      created_by: profileId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("cash_monthly_balances")
      .upsert(payload, { onConflict: "month_ref" });

    if (error) {
      setMessage(error.message || "Não foi possível salvar o saldo inicial.");
      setSaving(false);
      return;
    }

    setSuccessMessage("Saldo inicial salvo com sucesso.");
    setSaving(false);
    await loadBalances();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Caixa
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Saldos do Caixa
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Cadastre o saldo inicial de cada mês para que o Movimento Financeiro calcule o saldo final com mais precisão.
          </p>
        </section>

        <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
          O saldo inicial representa o valor disponível no caixa/banco no primeiro dia do mês, antes das entradas e saídas daquele período.
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
            Definir saldo inicial
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Mês
                </span>

                <input
                  type="month"
                  value={form.month}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      month: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Saldo inicial
                </span>

                <input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      opening_balance: event.target.value,
                    }))
                  }
                  placeholder="0,00"
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                />
              </label>
            </div>

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
                placeholder="Ex.: saldo conforme extrato bancário no início do mês."
                className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-fit rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : selectedBalance ? "Atualizar saldo" : "Salvar saldo"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Saldos cadastrados
          </h2>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando saldos...
            </div>
          ) : balances.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                Nenhum saldo cadastrado
              </h3>

              <p className="mt-2 leading-7 text-[#596579]">
                Cadastre o saldo inicial do mês para que ele seja considerado no Movimento Financeiro.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {balances.map((balance) => (
                <article
                  key={balance.id}
                  className="rounded-3xl border border-[#e8dccb] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                        {formatMonth(balance.month_ref)}
                      </p>

                      <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                        {formatCurrency(balance.opening_balance)}
                      </h3>

                      <p className="mt-1 text-sm font-bold text-[#596579]">
                        Saldo inicial do mês
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-sm font-black text-[#13233a]">
                        Atualizado em {formatDate(balance.updated_at)}
                      </p>
                    </div>
                  </div>

                  {balance.notes && (
                    <p className="mt-3 whitespace-pre-line rounded-2xl bg-[#f7f8fa] p-3 text-sm leading-6 text-[#596579]">
                      {balance.notes}
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
