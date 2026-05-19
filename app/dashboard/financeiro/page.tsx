"use client";

import { useEffect, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type FinancialSetting = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  monthly_fee_amount: number;
  due_day: number;
  late_fee_percent: number;
  daily_interest_percent: number;
  late_fee_grace_days: number;
  delinquency_alert_days: number;
  delinquency_limit_days: number;
  requires_formal_notice: boolean;
  status: string;
  notes: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativa",
  encerrada: "Encerrada",
};

function formatCurrency(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function DashboardFinanceiroPage() {
  const [settings, setSettings] = useState<FinancialSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "Regra financeira",
    start_date: new Date().toISOString().slice(0, 10),
    monthly_fee_amount: "50",
    due_day: "10",
    late_fee_percent: "2",
    daily_interest_percent: "0.033",
    late_fee_grace_days: "5",
    delinquency_alert_days: "30",
    delinquency_limit_days: "60",
    requires_formal_notice: true,
    notes: "",
  });

  function updateField(field: string, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("financial_settings")
      .select(
        "id, title, start_date, end_date, monthly_fee_amount, due_day, late_fee_percent, daily_interest_percent, late_fee_grace_days, delinquency_alert_days, delinquency_limit_days, requires_formal_notice, status, notes, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar regras financeiras:", error);
      setMessage(error.message || "Não foi possível carregar as regras financeiras.");
      setLoading(false);
      return;
    }

    setSettings(data ?? []);
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setMessage("Informe o título da regra financeira.");
      return;
    }

    const monthlyFee = Number(form.monthly_fee_amount);
    const dueDay = Number(form.due_day);

    if (Number.isNaN(monthlyFee) || monthlyFee < 0) {
      setMessage("Informe um valor válido para a mensalidade.");
      return;
    }

    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      setMessage("Informe um dia de vencimento entre 1 e 28.");
      return;
    }

    setSaving(true);
    setMessage("Salvando regra financeira...");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profileId: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      profileId = profile?.id ?? null;
    }

    const { error } = await supabase.from("financial_settings").insert({
      title: form.title.trim(),
      start_date: form.start_date,
      monthly_fee_amount: monthlyFee,
      due_day: dueDay,
      late_fee_percent: Number(form.late_fee_percent) || 0,
      daily_interest_percent: Number(form.daily_interest_percent) || 0,
      late_fee_grace_days: Number(form.late_fee_grace_days) || 0,
      delinquency_alert_days: Number(form.delinquency_alert_days) || 30,
      delinquency_limit_days: Number(form.delinquency_limit_days) || 60,
      requires_formal_notice: form.requires_formal_notice,
      status: "ativo",
      created_by: profileId,
      approved_by: profileId,
      approved_at: new Date().toISOString(),
      notes: form.notes.trim() || null,
    });

    if (error) {
      console.error("Erro ao salvar regra financeira:", error);
      setMessage(error.message || "Não foi possível salvar a regra financeira.");
      setSaving(false);
      return;
    }

    setMessage("Regra financeira salva com sucesso.");
    setSaving(false);

    setForm({
      title: "Regra financeira",
      start_date: new Date().toISOString().slice(0, 10),
      monthly_fee_amount: "50",
      due_day: "10",
      late_fee_percent: "2",
      daily_interest_percent: "0.033",
      late_fee_grace_days: "5",
      delinquency_alert_days: "30",
      delinquency_limit_days: "60",
      requires_formal_notice: true,
      notes: "",
    });

    await loadSettings();
  }

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Regras de cobrança
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Configuração financeira
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Defina as regras de mensalidade, vencimento, multa, juros e critérios de inadimplência da associação.
          </p>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-1 border-b border-[#eee7db] pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Nova regra financeira
              </h2>

              <p className="text-sm font-bold text-[#596579]">
                Ao ativar uma nova regra, ela passa a valer para as próximas mensalidades.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="rounded-xl border border-[#eee7db] bg-[#fffdf9] p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#596579]">
                Identificação da regra
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-[1.5fr_0.5fr]">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Título *</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                    placeholder="Ex.: Regra financeira 2026"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Início de vigência *</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) => updateField("start_date", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#eee7db] bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#596579]">
                Mensalidade e vencimento
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Mensalidade</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthly_fee_amount}
                    onChange={(event) => updateField("monthly_fee_amount", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Dia de vencimento</span>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={form.due_day}
                    onChange={(event) => updateField("due_day", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Tolerância sem encargos</span>
                  <input
                    type="number"
                    min="0"
                    value={form.late_fee_grace_days}
                    onChange={(event) => updateField("late_fee_grace_days", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#eee7db] bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#596579]">
                Encargos e inadimplência
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-5">
                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Multa (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.late_fee_percent}
                    onChange={(event) => updateField("late_fee_percent", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Juros diário (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.daily_interest_percent}
                    onChange={(event) => updateField("daily_interest_percent", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Alerta após dias</span>
                  <input
                    type="number"
                    min="0"
                    value={form.delinquency_alert_days}
                    onChange={(event) => updateField("delinquency_alert_days", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-bold text-[#596579]">Limite após dias</span>
                  <input
                    type="number"
                    min="0"
                    value={form.delinquency_limit_days}
                    onChange={(event) => updateField("delinquency_limit_days", event.target.value)}
                    className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  />
                </label>

                <label className="flex items-center gap-2 rounded-xl bg-[#f7f8fa] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.requires_formal_notice}
                    onChange={(event) =>
                      updateField("requires_formal_notice", event.target.checked)
                    }
                  />

                  <span className="text-xs font-bold leading-5 text-[#596579]">
                    Exigir notificação formal
                  </span>
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-[#eee7db] bg-white p-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-bold text-[#596579]">Observações</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[#e8dccb] px-3 py-2 text-sm leading-5 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Ex.: Regra aprovada em assembleia."
                />
              </label>
            </div>

            {message && (
              <div className="rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
                {message}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Salvando..." : "Ativar regra"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Regras cadastradas
              </h2>

              <p className="text-sm font-bold text-[#596579]">
                Histórico das regras financeiras. A regra ativa é a que vale para novas mensalidades.
              </p>
            </div>

            <button
              type="button"
              onClick={loadSettings}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando regras...
            </div>
          ) : settings.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4 text-sm font-bold text-[#596579]">
              Nenhuma regra financeira cadastrada.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] xl:grid">
                <div className="col-span-3">Regra</div>
                <div className="col-span-2">Vigência</div>
                <div className="col-span-2">Mensalidade</div>
                <div className="col-span-2">Encargos</div>
                <div className="col-span-2">Inadimplência</div>
                <div className="col-span-1 text-center">Status</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {settings.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-3 px-3 py-3 text-sm xl:grid-cols-12 xl:items-start"
                  >
                    <div className="xl:col-span-3">
                      <p className="font-black text-[#13233a]">{item.title}</p>

                      {item.notes && (
                        <p className="mt-1 max-h-10 overflow-hidden text-xs font-medium leading-5 text-[#596579]">
                          Obs.: {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="font-bold text-[#596579] xl:col-span-2">
                      <p>
                        Início:{" "}
                        {new Date(item.start_date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>

                      <p className="text-xs">
                        Fim:{" "}
                        {item.end_date
                          ? new Date(item.end_date + "T00:00:00").toLocaleDateString("pt-BR")
                          : "Sem data final"}
                      </p>
                    </div>

                    <div className="font-bold text-[#596579] xl:col-span-2">
                      <p className="font-black text-[#13233a]">
                        {formatCurrency(item.monthly_fee_amount)}
                      </p>

                      <p className="text-xs">Venc.: dia {item.due_day}</p>
                    </div>

                    <div className="font-bold text-[#596579] xl:col-span-2">
                      <p>Multa: {item.late_fee_percent}%</p>
                      <p className="text-xs">
                        Juros: {item.daily_interest_percent}% ao dia
                      </p>
                      <p className="text-xs">
                        Tolerância: {item.late_fee_grace_days} dia(s)
                      </p>
                    </div>

                    <div className="font-bold text-[#596579] xl:col-span-2">
                      <p>Alerta: {item.delinquency_alert_days} dia(s)</p>
                      <p className="text-xs">Limite: {item.delinquency_limit_days} dia(s)</p>
                      <p className="text-xs">
                        Notificação formal: {item.requires_formal_notice ? "Sim" : "Não"}
                      </p>
                    </div>

                    <div className="xl:col-span-1 xl:text-center">
                      <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                        {statusLabels[item.status] ?? item.status}
                      </span>
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
