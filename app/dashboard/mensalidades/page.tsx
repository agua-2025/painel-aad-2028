"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type FinancialSetting = {
  id: string;
  title: string;
  monthly_fee_amount: number;
  due_day: number;
  late_fee_percent: number;
  daily_interest_percent: number;
  status: string;
};

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

type MonthlyFee = {
  id: string;
  associate_id: string;
  year: number;
  month: number;
  base_amount: number;
  due_date: string;
  late_fee_amount: number;
  interest_amount: number;
  total_amount: number;
  paid_amount: number;
  paid_at: string | null;
  status: string;
  notes: string | null;
  associates:
    | {
        full_name: string;
        email: string | null;
      }
    | {
        full_name: string;
        email: string | null;
      }[]
    | null;
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

  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function getAssociateName(fee: MonthlyFee) {
  if (Array.isArray(fee.associates)) {
    return fee.associates[0]?.full_name || "Associado não localizado";
  }

  return fee.associates?.full_name || "Associado não localizado";
}

function getAssociateEmail(fee: MonthlyFee) {
  if (Array.isArray(fee.associates)) {
    return fee.associates[0]?.email || "";
  }

  return fee.associates?.email || "";
}

export default function DashboardMensalidadesPage() {
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));

  const [activeSetting, setActiveSetting] = useState<FinancialSetting | null>(null);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [fees, setFees] = useState<MonthlyFee[]>([]);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  const selectedLabel = useMemo(() => {
    const monthIndex = Number(selectedMonth) - 1;
    return `${monthNames[monthIndex]} de ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data: settingData, error: settingError } = await supabase
      .from("financial_settings")
      .select("id, title, monthly_fee_amount, due_day, late_fee_percent, daily_interest_percent, status")
      .eq("status", "ativo")
      .maybeSingle();

    if (settingError) {
      console.error("Erro ao carregar regra financeira:", settingError);
      setMessage("Não foi possível carregar a regra financeira ativa.");
      setLoading(false);
      return;
    }

    setActiveSetting(settingData);

    const { data: associatesData, error: associatesError } = await supabase
      .from("associates")
      .select("id, full_name, email, status")
      .eq("status", "ativo")
      .order("full_name", { ascending: true });

    if (associatesError) {
      console.error("Erro ao carregar associados:", associatesError);
      setMessage("Não foi possível carregar os associados ativos.");
      setLoading(false);
      return;
    }

    setAssociates(associatesData ?? []);

    await loadFees();

    setLoading(false);
  }

  async function loadFees() {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("monthly_fees")
      .select(
        "id, associate_id, year, month, base_amount, due_date, late_fee_amount, interest_amount, total_amount, paid_amount, paid_at, status, notes, associates(full_name, email)"
      )
      .eq("year", Number(selectedYear))
      .eq("month", Number(selectedMonth))
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar mensalidades:", error);
      setMessage("Não foi possível carregar as mensalidades.");
      return;
    }

    setFees((data as unknown as MonthlyFee[]) ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadFees();
  }, [selectedYear, selectedMonth]);

  async function generateMonthlyFees() {
    if (!activeSetting) {
      setMessage("Não existe regra financeira ativa. Cadastre uma regra financeira antes de gerar mensalidades.");
      return;
    }

    if (associates.length === 0) {
      setMessage("Não há associados ativos para gerar mensalidades.");
      return;
    }

    setGenerating(true);
    setMessage("Gerando mensalidades...");

    const supabase = createClient();

    const year = Number(selectedYear);
    const month = Number(selectedMonth);

    const dueDate = `${year}-${String(month).padStart(2, "0")}-${String(
      activeSetting.due_day
    ).padStart(2, "0")}`;

    const { data: existingFees, error: existingError } = await supabase
      .from("monthly_fees")
      .select("associate_id")
      .eq("year", year)
      .eq("month", month);

    if (existingError) {
      console.error("Erro ao consultar mensalidades existentes:", existingError);
      setMessage("Não foi possível verificar mensalidades já existentes.");
      setGenerating(false);
      return;
    }

    const existingAssociateIds = new Set(
      (existingFees ?? []).map((item) => item.associate_id)
    );

    const payload = associates
      .filter((associate) => !existingAssociateIds.has(associate.id))
      .map((associate) => ({
        associate_id: associate.id,
        financial_setting_id: activeSetting.id,
        year,
        month,
        base_amount: activeSetting.monthly_fee_amount,
        due_date: dueDate,
        late_fee_percent: activeSetting.late_fee_percent,
        daily_interest_percent: activeSetting.daily_interest_percent,
        late_fee_amount: 0,
        interest_amount: 0,
        total_amount: activeSetting.monthly_fee_amount,
        paid_amount: 0,
        status: "pendente",
        notes: `Mensalidade gerada automaticamente para ${selectedLabel}.`,
      }));

    if (payload.length === 0) {
      setMessage("Todas as mensalidades deste mês já foram geradas.");
      setGenerating(false);
      await loadFees();
      return;
    }

    const { error: insertError } = await supabase.from("monthly_fees").insert(payload);

    if (insertError) {
      console.error("Erro ao gerar mensalidades:", insertError);
      setMessage(insertError.message || "Não foi possível gerar as mensalidades.");
      setGenerating(false);
      return;
    }

    setMessage(`${payload.length} mensalidade(s) gerada(s) com sucesso.`);
    setGenerating(false);
    await loadFees();
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Gestão financeira
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Mensalidades
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Gere e acompanhe mensalidades dos associados ativos com base na regra financeira vigente.
          </p>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Regra ativa</p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em]">
              {activeSetting ? activeSetting.title : "Nenhuma"}
            </p>
            {activeSetting && (
              <p className="mt-2 text-sm font-bold text-[#596579]">
                {formatCurrency(activeSetting.monthly_fee_amount)} · vencimento dia{" "}
                {activeSetting.due_day}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Associados ativos</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
              {associates.length}
            </p>
          </div>

          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Mensalidades no mês</p>
            <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
              {fees.length}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em]">
                Gerar mensalidades
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Escolha o mês de referência. O sistema não gera duplicidade para associado que já possui mensalidade no mês.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_170px_auto]">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Ano</span>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Mês</span>
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                >
                  {monthNames.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={generateMonthlyFees}
                disabled={generating}
                className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70 sm:self-end"
              >
                {generating ? "Gerando..." : "Gerar"}
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              {message}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-[-0.04em]">
                Mensalidades de {selectedLabel}
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Relação das mensalidades geradas para o período selecionado.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              Carregando mensalidades...
            </div>
          ) : fees.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
              <h3 className="text-xl font-black tracking-[-0.04em]">
                Nenhuma mensalidade gerada
              </h3>
              <p className="mt-2 leading-7 text-[#596579]">
                Gere as mensalidades do mês usando o botão acima.
              </p>
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#e8dccb]">
              <div className="hidden bg-[#f7f8fa] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#596579] md:grid md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr]">
                <span>Associado</span>
                <span>Vencimento</span>
                <span>Valor</span>
                <span>Pago</span>
                <span>Status</span>
              </div>

              <div className="divide-y divide-[#e8dccb]">
                {fees.map((fee) => (
                  <div
                    key={fee.id}
                    className="grid gap-4 px-5 py-5 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr] md:items-center"
                  >
                    <div>
                      <p className="font-black text-[#13233a]">
                        {getAssociateName(fee)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#596579]">
                        {getAssociateEmail(fee) || "E-mail não informado"}
                      </p>
                    </div>

                    <div className="text-sm font-bold text-[#596579]">
                      {formatDate(fee.due_date)}
                    </div>

                    <div className="text-sm font-black text-[#13233a]">
                      {formatCurrency(fee.total_amount)}
                    </div>

                    <div className="text-sm font-black text-[#13233a]">
                      {formatCurrency(fee.paid_amount)}
                    </div>

                    <div>
                      <span className="inline-flex rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                        {statusLabels[fee.status] ?? fee.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
