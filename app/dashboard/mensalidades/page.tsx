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
  late_fee_percent: number;
  daily_interest_percent: number;
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
  financial_settings:
    | {
        late_fee_grace_days: number;
      }
    | {
        late_fee_grace_days: number;
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

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  deposito: "Depósito",
  cartao: "Cartão",
  outros: "Outros",
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


function getGraceDays(fee: MonthlyFee) {
  if (Array.isArray(fee.financial_settings)) {
    return Number(fee.financial_settings[0]?.late_fee_grace_days ?? 0);
  }

  return Number(fee.financial_settings?.late_fee_grace_days ?? 0);
}

function calculateAmountDueAtDate(fee: MonthlyFee, paymentDateValue: string) {
  const baseAmount = Number(fee.base_amount ?? 0);
  const dueDate = new Date(fee.due_date + "T00:00:00");
  const paymentDate = new Date(paymentDateValue + "T00:00:00");

  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(paymentDate.getTime())) {
    return {
      daysWithCharges: 0,
      lateFeeAmount: 0,
      interestAmount: 0,
      totalDue: baseAmount,
    };
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysAfterDue = Math.floor(
    (paymentDate.getTime() - dueDate.getTime()) / millisecondsPerDay
  );

  const graceDays = getGraceDays(fee);
  const daysWithCharges = Math.max(daysAfterDue - graceDays, 0);

  const lateFeeAmount =
    daysWithCharges > 0
      ? Number((baseAmount * (Number(fee.late_fee_percent ?? 0) / 100)).toFixed(2))
      : 0;

  const interestAmount =
    daysWithCharges > 0
      ? Number(
          (
            baseAmount *
            (Number(fee.daily_interest_percent ?? 0) / 100) *
            daysWithCharges
          ).toFixed(2)
        )
      : 0;

  const totalDue = Number((baseAmount + lateFeeAmount + interestAmount).toFixed(2));

  return {
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
  };
}

export default function DashboardMensalidadesPage() {
  const today = new Date();

  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));

  const [activeSetting, setActiveSetting] = useState<FinancialSetting | null>(null);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [fees, setFees] = useState<MonthlyFee[]>([]);

  const [selectedFee, setSelectedFee] = useState<MonthlyFee | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "pix",
    reference: "",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [message, setMessage] = useState("");

  const selectedLabel = useMemo(() => {
    const monthIndex = Number(selectedMonth) - 1;
    return `${monthNames[monthIndex]} de ${selectedYear}`;
  }, [selectedMonth, selectedYear]);

  function updatePaymentField(field: string, value: string) {
    setPaymentForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openPaymentForm(fee: MonthlyFee) {
    const remainingAmount = Math.max(
      Number(fee.total_amount ?? 0) - Number(fee.paid_amount ?? 0),
      0
    );

    setSelectedFee(fee);
    setPaymentForm({
      amount: String(remainingAmount.toFixed(2)),
      paid_at: new Date().toISOString().slice(0, 10),
      payment_method: "pix",
      reference: "",
      notes: "",
    });
    setMessage("");
  }

  function closePaymentForm() {
    setSelectedFee(null);
    setPaymentForm({
      amount: "",
      paid_at: new Date().toISOString().slice(0, 10),
      payment_method: "pix",
      reference: "",
      notes: "",
    });
  }

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
        "id, associate_id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, late_fee_amount, interest_amount, total_amount, paid_amount, paid_at, status, notes, associates(full_name, email), financial_settings(late_fee_grace_days)"
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

  async function registerPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFee) {
      setMessage("Selecione uma mensalidade para registrar o pagamento.");
      return;
    }

    const amount = Number(paymentForm.amount.replace(",", "."));

    if (Number.isNaN(amount) || amount <= 0) {
      setMessage("Informe um valor de pagamento válido.");
      return;
    }

    if (!paymentForm.paid_at) {
      setMessage("Informe a data do pagamento.");
      return;
    }

    const currentPaidAmount = Number(selectedFee.paid_amount ?? 0);
    const amountDueAtPaymentDate = calculateAmountDueAtDate(
      selectedFee,
      paymentForm.paid_at
    );

    const totalAmount = amountDueAtPaymentDate.totalDue;
    const newPaidAmount = Number((currentPaidAmount + amount).toFixed(2));
    const remainingAmount = Number((totalAmount - currentPaidAmount).toFixed(2));

    if (newPaidAmount > totalAmount) {
      setMessage(
        `O valor informado ultrapassa o saldo devido na data efetiva do pagamento. Saldo nessa data: ${formatCurrency(
          remainingAmount
        )}.`
      );
      return;
    }

    setSavingPayment(true);
    setMessage("Registrando pagamento...");

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

    const { error: paymentError } = await supabase.from("payments").insert({
      associate_id: selectedFee.associate_id,
      monthly_fee_id: selectedFee.id,
      amount,
      paid_at: paymentForm.paid_at,
      payment_method: paymentForm.payment_method,
      reference: paymentForm.reference.trim() || null,
      created_by: profileId,
      notes: paymentForm.notes.trim() || null,
    });

    if (paymentError) {
      console.error("Erro ao registrar pagamento:", paymentError);
      setMessage(paymentError.message || "Não foi possível registrar o pagamento.");
      setSavingPayment(false);
      return;
    }

    const newStatus = newPaidAmount >= totalAmount ? "paga" : "parcialmente_paga";

    const { error: feeError } = await supabase
      .from("monthly_fees")
      .update({
        late_fee_amount: amountDueAtPaymentDate.lateFeeAmount,
        interest_amount: amountDueAtPaymentDate.interestAmount,
        total_amount: amountDueAtPaymentDate.totalDue,
        paid_amount: newPaidAmount,
        paid_at: paymentForm.paid_at,
        status: newStatus,
      })
      .eq("id", selectedFee.id);

    if (feeError) {
      console.error("Erro ao atualizar mensalidade:", feeError);
      setMessage(
        "O pagamento foi registrado, mas não foi possível atualizar a mensalidade."
      );
      setSavingPayment(false);
      return;
    }

    setMessage("Pagamento registrado com sucesso.");
    setSavingPayment(false);
    closePaymentForm();
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
            Gere, acompanhe e registre pagamentos das mensalidades dos associados ativos.
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

        {selectedFee && (
          <section className="rounded-3xl border border-[#c7a56b] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                  Baixa de pagamento
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                  Registrar pagamento
                </h2>

                <p className="mt-2 text-sm font-bold text-[#596579]">
                  {getAssociateName(selectedFee)} · saldo{" "}
                  {formatCurrency(
                    calculateAmountDueAtDate(
                      selectedFee,
                      paymentForm.paid_at
                    ).totalDue - Number(selectedFee.paid_amount ?? 0)
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closePaymentForm}
                className="rounded-full border border-[#e8dccb] bg-white px-5 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Fechar
              </button>
            </div>

            <form
              onSubmit={registerPayment}
              className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
            >
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Valor pago</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(event) => updatePaymentField("amount", event.target.value)}
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Data efetiva do pagamento</span>
                <input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(event) => updatePaymentField("paid_at", event.target.value)}
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Forma</span>
                <select
                  value={paymentForm.payment_method}
                  onChange={(event) =>
                    updatePaymentField("payment_method", event.target.value)
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                >
                  {Object.entries(paymentMethodLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Comprovante/Referência</span>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(event) =>
                    updatePaymentField("reference", event.target.value)
                  }
                  className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Ex.: Pix, recibo, comprovante"
                />
              </label>

              <button
                type="submit"
                disabled={savingPayment}
                className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70 md:self-end"
              >
                {savingPayment ? "Salvando..." : "Confirmar"}
              </button>

              <label className="grid gap-2 md:col-span-2 xl:col-span-5">
                <span className="text-sm font-bold text-[#596579]">Observação</span>
                <textarea
                  value={paymentForm.notes}
                  onChange={(event) => updatePaymentField("notes", event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Observação interna sobre o pagamento, se necessário."
                />
              </label>
            </form>
          </section>
        )}

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
              <div className="hidden bg-[#f7f8fa] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#596579] md:grid md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr]">
                <span>Associado</span>
                <span>Vencimento</span>
                <span>Valor</span>
                <span>Pago</span>
                <span>Status</span>
                <span>Ação</span>
              </div>

              <div className="divide-y divide-[#e8dccb]">
                {fees.map((fee) => (
                  <div
                    key={fee.id}
                    className="grid gap-4 px-5 py-5 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr] md:items-center"
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

                    <div>
                      {fee.status === "paga" ? (
                        <span className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                          Quitada
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPaymentForm(fee)}
                          className="rounded-full bg-[#13233a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white"
                        >
                          Registrar
                        </button>
                      )}
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
