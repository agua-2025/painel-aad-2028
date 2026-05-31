"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { useDashboardPermissions } from "@/lib/useDashboardPermissions";
import { registerAuditLog } from "@/lib/audit";

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
  const permissions = useDashboardPermissions("mensalidades");
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
    if (!permissions.canUpdate) {
      setMessage("Seu perfil pode consultar as mensalidades, mas não pode registrar baixa de pagamento.");
      return;
    }

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
    if (!permissions.canCreate) {
      setMessage("Seu perfil pode consultar as mensalidades, mas não pode gerar novas cobranças.");
      return;
    }

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
      setMessage("Não foi possível gerar as mensalidades. Verifique se seu perfil tem permissão para essa ação.");
      setGenerating(false);
      return;
    }

    await registerAuditLog({
      supabase,
      action: "generate_monthly_fees",
      module: "mensalidades",
      tableName: "monthly_fees",
      recordId: `${year}-${String(month).padStart(2, "0")}`,
      description: `Gerou ${payload.length} mensalidade(s) para ${selectedLabel}.`,
      oldData: {
        existing_count: existingFees?.length ?? 0,
      },
      newData: {
        year,
        month,
        due_date: dueDate,
        count: payload.length,
        base_amount: activeSetting.monthly_fee_amount,
        financial_setting_id: activeSetting.id,
        associates: payload.map((item) => ({
          associate_id: item.associate_id,
          amount: item.base_amount,
          status: item.status,
        })),
      },
    });

    setMessage(`${payload.length} mensalidade(s) gerada(s) com sucesso.`);
    setGenerating(false);
    await loadFees();
      }

  async function registerPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!permissions.canUpdate) {
      setMessage("Seu perfil pode consultar as mensalidades, mas não pode registrar baixa de pagamento.");
      return;
    }

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
      setMessage("Não foi possível registrar o pagamento. Verifique se seu perfil tem permissão para essa ação.");
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

  await registerAuditLog({
    supabase,
    action: "manual_monthly_payment",
    module: "mensalidades",
    tableName: "monthly_fees",
    recordId: selectedFee.id,
    description: `Registrou baixa manual da mensalidade de ${getAssociateName(selectedFee)} referente a ${monthNames[Number(selectedFee.month) - 1]} de ${selectedFee.year}.`,
    oldData: {
      status: selectedFee.status,
      paid_amount: selectedFee.paid_amount,
      total_amount: selectedFee.total_amount,
      paid_at: selectedFee.paid_at,
      late_fee_amount: selectedFee.late_fee_amount,
      interest_amount: selectedFee.interest_amount,
    },
    newData: {
      status: newStatus,
      paid_amount: newPaidAmount,
      total_amount: amountDueAtPaymentDate.totalDue,
      paid_at: paymentForm.paid_at,
      amount_paid_now: amount,
      payment_method: paymentForm.payment_method,
      reference: paymentForm.reference.trim() || null,
      notes: paymentForm.notes.trim() || null,
      late_fee_amount: amountDueAtPaymentDate.lateFeeAmount,
      interest_amount: amountDueAtPaymentDate.interestAmount,
      days_with_charges: amountDueAtPaymentDate.daysWithCharges,
    },
  });

  setMessage("Pagamento registrado com sucesso.");
  setSavingPayment(false);
  closePaymentForm();
  await loadFees();
    }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Gestão financeira
          </p>

          <h1 className="mt-2 text-lg font-black tracking-[-0.03em]">
            Mensalidades
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Gere, acompanhe e registre pagamentos das mensalidades dos associados ativos.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
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

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Associados ativos</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em]">
              {associates.length}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Mensalidades no mês</p>
            <p className="mt-2 text-lg font-black tracking-[-0.03em]">
              {fees.length}
            </p>
          </div>
        </section>

        {permissions.isReadOnly && !permissions.loadingPermissions && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            Seu perfil pode consultar as mensalidades, mas não pode gerar cobranças ou registrar pagamentos.
          </div>
        )}

        <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em]">
                Gerar mensalidades
              </h2>

              <p className="text-xs font-bold text-[#596579]">
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
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Mês</span>
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
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
                disabled={generating || permissions.loadingPermissions || !permissions.canCreate}
                className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70 sm:self-end"
              >
                {generating
                  ? "Gerando..."
                  : permissions.canCreate
                    ? "Gerar"
                    : "Somente leitura"}
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-5 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              {message}
            </div>
          )}
        </section>

        {selectedFee && (
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                  Baixa de pagamento
                </p>

                <h2 className="mt-2 text-lg font-black tracking-[-0.03em]">
                  Registrar pagamento
                </h2>

                <div className="mt-3 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold leading-7 text-[#596579]">
                  <p>
                    <strong>Associado:</strong> {getAssociateName(selectedFee)}
                  </p>

                  <p>
                    <strong>Referência:</strong> {monthNames[Number(selectedFee.month) - 1]} de {selectedFee.year}
                  </p>

                  <p>
                    <strong>Vencimento:</strong> {formatDate(selectedFee.due_date)}
                  </p>

                  <p>
                    <strong>Saldo na data efetiva do pagamento:</strong>{" "}
                    {formatCurrency(
                      calculateAmountDueAtDate(
                        selectedFee,
                        paymentForm.paid_at
                      ).totalDue - Number(selectedFee.paid_amount ?? 0)
                    )}
                  </p>
                </div>

                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
                  Antes de confirmar, confira se o pagamento pertence a esta mensalidade. Havendo meses anteriores em aberto, recomenda-se baixar primeiro a mensalidade mais antiga, salvo orientação expressa do associado.
                </div>
              </div>

              <button
                type="button"
                onClick={closePaymentForm}
                className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
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
                  disabled={savingPayment || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) => updatePaymentField("amount", event.target.value)}
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Data efetiva do pagamento</span>
                <input
                  type="date"
                  value={paymentForm.paid_at}
                  disabled={savingPayment || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) => updatePaymentField("paid_at", event.target.value)}
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Forma</span>
                <select
                  value={paymentForm.payment_method}
                  disabled={savingPayment || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) =>
                    updatePaymentField("payment_method", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
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
                  disabled={savingPayment || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) =>
                    updatePaymentField("reference", event.target.value)
                  }
                  className="w-full rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Ex.: Pix, recibo, comprovante"
                />
              </label>

              <button
                type="submit"
                disabled={savingPayment || permissions.loadingPermissions || !permissions.canUpdate}
                className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70 md:self-end"
              >
                {savingPayment
                  ? "Salvando..."
                  : permissions.canUpdate
                    ? "Confirmar"
                    : "Somente leitura"}
              </button>

              <label className="grid gap-2 md:col-span-2 xl:col-span-5">
                <span className="text-sm font-bold text-[#596579]">Observação</span>
                <textarea
                  value={paymentForm.notes}
                  disabled={savingPayment || permissions.loadingPermissions || !permissions.canUpdate}
                  onChange={(event) => updatePaymentField("notes", event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Observação interna sobre o pagamento, se necessário."
                />
              </label>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Mensalidades de {selectedLabel}
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Relação das mensalidades geradas para o período selecionado.
              </p>
            </div>

            <p className="text-xs font-bold text-[#596579]">
              {fees.length} registro(s)
            </p>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando mensalidades...
            </div>
          ) : fees.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhuma mensalidade gerada
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                Gere as mensalidades do mês usando o botão acima.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                <div className="col-span-3">Associado</div>
                <div className="col-span-2">Vencimento</div>
                <div className="col-span-2 text-right">Valor</div>
                <div className="col-span-2 text-right">Pago/Saldo</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-right">Ação</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {fees.map((fee) => {
                  const remainingAmount = Math.max(
                    Number(fee.total_amount ?? 0) - Number(fee.paid_amount ?? 0),
                    0
                  );

                  return (
                    <article
                      key={fee.id}
                      className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                    >
                      <div className="md:col-span-3">
                        <p className="font-black text-[#13233a]">
                          {getAssociateName(fee)}
                        </p>

                        <p className="mt-0.5 text-xs font-bold text-[#596579]">
                          {getAssociateEmail(fee) || "E-mail não informado"}
                        </p>
                      </div>

                      <div className="font-bold text-[#596579] md:col-span-2">
                        {formatDate(fee.due_date)}
                      </div>

                      <div className="font-black text-[#13233a] md:col-span-2 md:text-right">
                        {formatCurrency(fee.total_amount)}
                      </div>

                      <div className="font-bold text-[#596579] md:col-span-2 md:text-right">
                        <p className="font-black text-[#13233a]">
                          {formatCurrency(fee.paid_amount)}
                        </p>

                        <p className="text-xs">
                          Saldo: {formatCurrency(remainingAmount)}
                        </p>
                      </div>

                      <div className="md:col-span-1 md:text-center">
                        <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                          {statusLabels[fee.status] ?? fee.status}
                        </span>
                      </div>

                      <div className="md:col-span-2 md:text-right">
                        {fee.status === "paga" ? (
                          <span className="text-[11px] font-black uppercase tracking-[0.06em] text-[#596579]">
                            Quitada
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openPaymentForm(fee)}
                            disabled={permissions.loadingPermissions || !permissions.canUpdate}
                            className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {permissions.canUpdate ? "Registrar" : "Somente leitura"}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
