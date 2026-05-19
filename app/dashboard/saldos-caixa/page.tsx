"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { useDashboardPermissions } from "@/lib/useDashboardPermissions";

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
  const permissions = useDashboardPermissions("saldos_caixa");
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

    setMessage("");
    setSuccessMessage("");

    if (!permissions.canUpdate) {
      setMessage("Seu perfil pode consultar os saldos do caixa, mas não pode salvar ou atualizar saldo inicial.");
      return;
    }

    setSaving(true);

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
      console.error("Erro ao salvar saldo inicial:", error);
      setMessage("Não foi possível salvar o saldo inicial. Verifique se seu perfil tem permissão para essa ação.");
      setSaving(false);
      return;
    }

    setSuccessMessage("Saldo inicial salvo com sucesso.");
    setSaving(false);
    await loadBalances();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Caixa
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Saldos do Caixa
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Cadastre o saldo inicial de cada mês para que o Movimento Financeiro calcule o saldo final com mais precisão.
          </p>
        </section>

        <p className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2.5 text-sm font-bold text-[#596579]">
          O saldo inicial representa o valor disponível no caixa/banco no primeiro dia do mês, antes das entradas e saídas daquele período.
        </p>

        {successMessage && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="font-bold text-green-800">{successMessage}</p>
          </section>
        )}

        {message && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </section>
        )}

        {permissions.isReadOnly && !permissions.loadingPermissions && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Seu perfil pode consultar os saldos do caixa, mas não pode cadastrar ou alterar saldo inicial.
          </section>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Definir saldo inicial
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Informe o saldo existente no caixa/banco no primeiro dia do mês.
              </p>
            </div>

            {selectedBalance && (
              <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#596579]">
                Atualizando saldo existente
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#13233a]">
                  Mês
                </span>

                <input
                  type="month"
                  value={form.month}
                  disabled={saving || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      month: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
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
                  disabled={saving || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      opening_balance: event.target.value,
                    }))
                  }
                  placeholder="0,00"
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
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
                disabled={saving || permissions.loadingPermissions || !permissions.canUpdate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    notes: event.target.value,
                  }))
                }
                placeholder="Ex.: saldo conforme extrato bancário no início do mês."
                className="w-full resize-none rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-bold text-[#13233a] outline-none"
              />
            </label>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <button
                type="submit"
                disabled={saving || permissions.loadingPermissions || !permissions.canUpdate}
                className="w-fit rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Salvando..."
                  : permissions.canUpdate
                    ? selectedBalance
                      ? "Atualizar saldo"
                      : "Salvar saldo"
                    : "Somente leitura"}
              </button>

              <p className="text-xs font-bold text-[#596579]">
                O mês só pode ter um saldo inicial cadastrado.
              </p>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Saldos cadastrados
            </h2>

            <p className="text-xs font-bold text-[#596579]">
              Lista dos saldos iniciais mensais usados nos relatórios e fechamentos.
            </p>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando saldos...
            </div>
          ) : balances.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhum saldo cadastrado
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                Cadastre o saldo inicial do mês para que ele seja considerado no Movimento Financeiro.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                <div className="col-span-3">Mês</div>
                <div className="col-span-3 text-right">Saldo inicial</div>
                <div className="col-span-3">Atualização</div>
                <div className="col-span-3">Observações</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {balances.map((balance) => (
                  <article
                    key={balance.id}
                    className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-start"
                  >
                    <div className="md:col-span-3">
                      <p className="font-black text-[#13233a]">
                        {formatMonth(balance.month_ref)}
                      </p>

                      <p className="mt-0.5 text-xs font-bold text-[#596579]">
                        Saldo inicial do mês
                      </p>
                    </div>

                    <div className="font-black text-[#13233a] md:col-span-3 md:text-right">
                      {formatCurrency(balance.opening_balance)}
                    </div>

                    <div className="font-bold text-[#596579] md:col-span-3">
                      {formatDate(balance.updated_at)}
                    </div>

                    <div className="whitespace-pre-line text-xs font-bold leading-5 text-[#596579] md:col-span-3">
                      {balance.notes || "Sem observações."}
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
