"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  status: string | null;
};

type RelatedAssociate = {
  full_name: string;
  phone: string | null;
};

type MonthlyFee = {
  id: string;
  associate_id: string;
  year: number;
  month: number;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
  associates: RelatedAssociate | RelatedAssociate[] | null;
};

type ExtraContributionItem = {
  id: string;
  associate_id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  associates: RelatedAssociate | RelatedAssociate[] | null;
  extra_contributions:
    | {
        title: string;
        description: string | null;
        reason: string | null;
        status: string | null;
      }
    | {
        title: string;
        description: string | null;
        reason: string | null;
        status: string | null;
      }[]
    | null;
};

type CommunicationLog = {
  id: string;
  associate_id: string;
  communication_type: string;
  reference_id: string | null;
  sent_at: string;
};

type MonthlyFeeGroup = {
  associateId: string;
  associateName: string;
  phone: string | null;
  fees: {
    id: string;
    reference: string;
    dueDate: string;
    openAmount: number;
  }[];
  totalOpenAmount: number;
  referenceId: string;
  referenceLabel: string;
};

type ExtraContributionGroup = {
  associateId: string;
  associateName: string;
  phone: string | null;
  items: {
    id: string;
    title: string;
    dueDate: string;
    openAmount: number;
  }[];
  totalOpenAmount: number;
  referenceId: string;
  referenceLabel: string;
};

type UpcomingDueGroup = {
  associateId: string;
  associateName: string;
  phone: string | null;
  items: {
    id: string;
    title: string;
    dueDate: string;
    openAmount: number;
  }[];
  totalAmount: number;
  referenceId: string;
  referenceLabel: string;
};

function getTodayReference() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return {
    year,
    month,
    day,
    dateKey: `${year}-${month}-${day}`,
    birthdayReferenceId: `birthday-${year}-${month}-${day}`,
    birthdayReferenceLabel: `Aniversário ${day}/${month}/${year}`,
  };
}

function isBirthdayToday(birthDate: string | null, month: string, day: string) {
  if (!birthDate) return false;

  const parts = birthDate.split("-");
  if (parts.length < 3) return false;

  return parts[1] === month && parts[2] === day;
}

function firstName(fullName: string) {
  return fullName.trim().split(" ")[0] || fullName;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(date: string | null) {
  if (!date) return "Não informado";

  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;

  return `${day}/${month}/${year}`;
}

function isOverdueDate(dueDate: string | null, todayKey: string) {
  if (!dueDate) return false;

  return dueDate < todayKey;
}

function formatMonthReference(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const finalYear = date.getFullYear();
  const finalMonth = String(date.getMonth() + 1).padStart(2, "0");
  const finalDay = String(date.getDate()).padStart(2, "0");

  return `${finalYear}-${finalMonth}-${finalDay}`;
}

function isUpcomingDueDate(dueDate: string | null, todayKey: string, daysAhead = 3) {
  if (!dueDate) return false;

  const limitDate = addDaysToDateKey(todayKey, daysAhead);

  return dueDate >= todayKey && dueDate <= limitDate;
}

function normalizeAssociate(value: RelatedAssociate | RelatedAssociate[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeContribution(
  value: ExtraContributionItem["extra_contributions"]
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function makeBirthdayMessage(name: string) {
  return `*Feliz aniversário, ${firstName(name)}!*

Hoje é um dia especial, e a *AAD Direito 2028* deseja a você muita saúde, alegria, paz e realizações.

Que este novo ciclo seja leve, abençoado e cheio de conquistas, tanto na vida pessoal quanto na caminhada acadêmica.

Seguimos juntos nessa trajetória rumo à nossa formatura.

Um abraço,
*Diretoria da AAD Direito 2028*`;
}

function makeMonthlyFeeMessage(group: MonthlyFeeGroup) {
  const feeLines = group.fees
    .map(
      (fee) =>
        `• Referência ${fee.reference}, vencimento ${fee.dueDate}, valor em aberto ${formatCurrency(
          fee.openAmount
        )}`
    )
    .join("\n");

  return `Olá, ${firstName(group.associateName)}!

Constam em nosso controle financeiro mensalidade(s) vencida(s) da *AAD Direito 2028*:

${feeLines}

*Total em aberto:* ${formatCurrency(group.totalOpenAmount)}

Pedimos, por gentileza, que verifique a pendência. Caso o pagamento já tenha sido realizado, registre ou encaminhe o comprovante pela área do associado.

Esta mensagem é apenas um lembrete manual da Tesouraria.

Atenciosamente,
*Tesouraria da AAD Direito 2028*`;
}

function makeExtraContributionMessage(group: ExtraContributionGroup) {
  const itemLines = group.items
    .map(
      (item) =>
        `- ${item.title}, vencimento ${item.dueDate}, valor em aberto ${formatCurrency(
          item.openAmount
        )}`
    )
    .join("\n");

  return `Olá, ${firstName(group.associateName)}!

Consta em nosso controle financeiro contribuição(ões) extra(s) vencida(s) da *AAD Direito 2028*:

${itemLines}

*Total em aberto:* ${formatCurrency(group.totalOpenAmount)}

Pedimos, por gentileza, que verifique a pendência. Caso o pagamento já tenha sido realizado, registre ou encaminhe o comprovante pela área do associado.

Esta mensagem é apenas um lembrete manual da Tesouraria.

Atenciosamente,
*Tesouraria da AAD Direito 2028*`;
}

function makeUpcomingDueMessage(group: UpcomingDueGroup) {
  const itemLines = group.items
    .map(
      (item) =>
        `- ${item.title}, vencimento ${item.dueDate}, valor ${formatCurrency(
          item.openAmount
        )}`
    )
    .join("\n");

  return `Olá, ${firstName(group.associateName)}!

Passando apenas para lembrar que há lançamento(s) da *AAD Direito 2028* com vencimento próximo:

${itemLines}

*Total previsto:* ${formatCurrency(group.totalAmount)}

Caso o pagamento já tenha sido realizado, desconsidere esta mensagem ou registre o comprovante pela área do associado.

Esta mensagem é apenas um lembrete preventivo da Tesouraria.

Atenciosamente,
*Tesouraria da AAD Direito 2028*`;
}

function normalizePhoneForWhatsApp(phone: string | null) {
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("55")) return digits;

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function makeWhatsAppUrl(phone: string | null, message: string) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone);

  if (!normalizedPhone) return "";

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export default function ComunicacoesPage() {
  const supabase = createClient();

  const [associates, setAssociates] = useState<Associate[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraContributionItem[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");

  const today = useMemo(() => getTodayReference(), []);

  const birthdayAssociates = useMemo(() => {
    return associates
      .filter((associate) => associate.status === "ativo")
      .filter((associate) =>
        isBirthdayToday(associate.birth_date, today.month, today.day)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [associates, today.day, today.month]);

  const monthlyFeeGroups = useMemo(() => {
    const grouped = new Map<string, MonthlyFeeGroup>();

    monthlyFees
      .filter((fee) => ["pendente", "parcialmente_paga"].includes(fee.status))
      .forEach((fee) => {
        if (!isOverdueDate(fee.due_date, today.dateKey)) return;

        const associate = normalizeAssociate(fee.associates);
        if (!associate) return;

        const openAmount =
          Number(fee.total_amount || 0) - Number(fee.paid_amount || 0);

        if (openAmount <= 0) return;

        const item = {
          id: fee.id,
          reference: formatMonthReference(fee.year, fee.month),
          dueDate: formatDate(fee.due_date),
          openAmount,
        };

        const current = grouped.get(fee.associate_id);

        if (!current) {
          grouped.set(fee.associate_id, {
            associateId: fee.associate_id,
            associateName: associate.full_name,
            phone: associate.phone,
            fees: [item],
            totalOpenAmount: openAmount,
            referenceId: `monthly-fees-overdue-${today.dateKey}-${fee.associate_id}`,
            referenceLabel: `Mensalidades vencidas ${formatDate(
              today.dateKey
            )}`,
          });
          return;
        }

        current.fees.push(item);
        current.totalOpenAmount += openAmount;
      });

    return Array.from(grouped.values()).sort((a, b) =>
      a.associateName.localeCompare(b.associateName)
    );
  }, [monthlyFees, today.dateKey]);

  const upcomingDueGroups = useMemo(() => {
    const grouped = new Map<string, UpcomingDueGroup>();

    monthlyFees
      .filter((fee) => ["pendente", "parcialmente_paga"].includes(fee.status))
      .forEach((fee) => {
        if (!isUpcomingDueDate(fee.due_date, today.dateKey, 3)) return;

        const associate = normalizeAssociate(fee.associates);
        if (!associate) return;

        const openAmount =
          Number(fee.total_amount || 0) - Number(fee.paid_amount || 0);

        if (openAmount <= 0) return;

        const currentItem = {
          id: fee.id,
          title: `Mensalidade ${formatMonthReference(fee.year, fee.month)}`,
          dueDate: formatDate(fee.due_date),
          openAmount,
        };

        const current = grouped.get(fee.associate_id);

        if (!current) {
          grouped.set(fee.associate_id, {
            associateId: fee.associate_id,
            associateName: associate.full_name,
            phone: associate.phone,
            items: [currentItem],
            totalAmount: openAmount,
            referenceId: `upcoming-due-${today.dateKey}-${fee.associate_id}`,
            referenceLabel: `Vencimentos próximos ${formatDate(today.dateKey)}`,
          });
          return;
        }

        current.items.push(currentItem);
        current.totalAmount += openAmount;
      });

    extraItems
      .filter((item) => ["pendente", "parcialmente_paga"].includes(item.status))
      .forEach((item) => {
        if (!isUpcomingDueDate(item.due_date, today.dateKey, 3)) return;

        const associate = normalizeAssociate(item.associates);
        if (!associate) return;

        const contribution = normalizeContribution(item.extra_contributions);
        const title = contribution?.title || "Contribuição extra";

        const openAmount =
          Number(item.amount || 0) - Number(item.paid_amount || 0);

        if (openAmount <= 0) return;

        const currentItem = {
          id: item.id,
          title,
          dueDate: formatDate(item.due_date),
          openAmount,
        };

        const current = grouped.get(item.associate_id);

        if (!current) {
          grouped.set(item.associate_id, {
            associateId: item.associate_id,
            associateName: associate.full_name,
            phone: associate.phone,
            items: [currentItem],
            totalAmount: openAmount,
            referenceId: `upcoming-due-${today.dateKey}-${item.associate_id}`,
            referenceLabel: `Vencimentos próximos ${formatDate(today.dateKey)}`,
          });
          return;
        }

        current.items.push(currentItem);
        current.totalAmount += openAmount;
      });

    return Array.from(grouped.values()).sort((a, b) =>
      a.associateName.localeCompare(b.associateName)
    );
  }, [monthlyFees, extraItems, today.dateKey]);

  const extraContributionGroups = useMemo(() => {
    const grouped = new Map<string, ExtraContributionGroup>();

    extraItems
      .filter((item) => ["pendente", "parcialmente_paga"].includes(item.status))
      .forEach((item) => {
        if (!isOverdueDate(item.due_date, today.dateKey)) return;

        const associate = normalizeAssociate(item.associates);
        if (!associate) return;

        const contribution = normalizeContribution(item.extra_contributions);
        const title = contribution?.title || "Contribuição extra";

        const openAmount =
          Number(item.amount || 0) - Number(item.paid_amount || 0);

        if (openAmount <= 0) return;

        const currentItem = {
          id: item.id,
          title,
          dueDate: formatDate(item.due_date),
          openAmount,
        };

        const current = grouped.get(item.associate_id);

        if (!current) {
          grouped.set(item.associate_id, {
            associateId: item.associate_id,
            associateName: associate.full_name,
            phone: associate.phone,
            items: [currentItem],
            totalOpenAmount: openAmount,
            referenceId: `extra-contributions-overdue-${today.dateKey}-${item.associate_id}`,
            referenceLabel: `Contribuições extras vencidas ${formatDate(
              today.dateKey
            )}`,
          });
          return;
        }

        current.items.push(currentItem);
        current.totalOpenAmount += openAmount;
      });

    return Array.from(grouped.values()).sort((a, b) =>
      a.associateName.localeCompare(b.associateName)
    );
  }, [extraItems, today.dateKey]);

  function hasLog(type: string, referenceId: string, associateId: string) {
    return logs.some(
      (log) =>
        log.communication_type === type &&
        log.reference_id === referenceId &&
        log.associate_id === associateId
    );
  }

  function addLocalLog(type: string, referenceId: string, associateId: string) {
    setLogs((current) => {
      const exists = current.some(
        (log) =>
          log.communication_type === type &&
          log.reference_id === referenceId &&
          log.associate_id === associateId
      );

      if (exists) return current;

      return [
        ...current,
        {
          id: `${type}-${referenceId}-${associateId}`,
          associate_id: associateId,
          communication_type: type,
          reference_id: referenceId,
          sent_at: new Date().toISOString(),
        },
      ];
    });
  }

  const totalBirthdaysSentToday = birthdayAssociates.filter((associate) =>
    hasLog("birthday", today.birthdayReferenceId, associate.id)
  ).length;

  const totalUpcomingDueSent = upcomingDueGroups.filter((group) =>
    hasLog("upcoming_due_reminder", group.referenceId, group.associateId)
  ).length;

  const totalMonthlyFeeSent = monthlyFeeGroups.filter((group) =>
    hasLog("monthly_fee_overdue", group.referenceId, group.associateId)
  ).length;

  const totalExtraContributionSent = extraContributionGroups.filter((group) =>
    hasLog("extra_contribution_overdue", group.referenceId, group.associateId)
  ).length;

  async function loadData() {
    setLoading(true);
    setMessage("");
    setWarning("");

    const { data: associatesData, error: associatesError } = await supabase
      .from("associates")
      .select("id, full_name, phone, birth_date, status")
      .eq("status", "ativo")
      .order("full_name", { ascending: true });

    if (associatesError) {
      setMessage("Não foi possível carregar os associados.");
      setLoading(false);
      return;
    }

    const { data: feesData, error: feesError } = await supabase
      .from("monthly_fees")
      .select(
        "id, associate_id, year, month, due_date, total_amount, paid_amount, status, associates(full_name, phone)"
      )
      .in("status", ["pendente", "parcialmente_paga"])
      .order("due_date", { ascending: true });

    if (feesError) {
      setMessage("Não foi possível carregar as mensalidades em aberto.");
      setLoading(false);
      return;
    }

    const { data: extraData, error: extraError } = await supabase
      .from("extra_contribution_items")
      .select(
        "id, associate_id, amount, paid_amount, due_date, status, associates(full_name, phone), extra_contributions(title, description, reason, status)"
      )
      .in("status", ["pendente", "parcialmente_paga"])
      .order("due_date", { ascending: true });

    if (extraError) {
      setMessage("Não foi possível carregar as contribuições extras em aberto.");
      setLoading(false);
      return;
    }

    setAssociates((associatesData as Associate[]) ?? []);
    setMonthlyFees((feesData as MonthlyFee[]) ?? []);
    setExtraItems((extraData as ExtraContributionItem[]) ?? []);

    const { data: logsData, error: logsError } = await supabase
      .from("communication_logs")
      .select("id, associate_id, communication_type, reference_id, sent_at")
      .in("communication_type", [
        "birthday",
        "upcoming_due_reminder",
        "monthly_fee_overdue",
        "extra_contribution_overdue",
      ]);

    if (logsError) {
      setLogs([]);
      setWarning(
        "Os dados foram carregados, mas o histórico de envios não pôde ser consultado."
      );
      setLoading(false);
      return;
    }

    setLogs((logsData as CommunicationLog[]) ?? []);
    setLoading(false);
  }

  async function copyMessage(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Mensagem copiada.");
    } catch {
      setMessage("Não foi possível copiar a mensagem automaticamente.");
    }
  }

  async function openWhatsAppAndRegister(params: {
    associateId: string;
    phone: string | null;
    communicationType: string;
    referenceId: string;
    referenceLabel: string;
    preparedMessage: string;
  }) {
    const whatsappUrl = makeWhatsAppUrl(params.phone, params.preparedMessage);

    if (!whatsappUrl) {
      setMessage("Este associado não possui telefone válido para WhatsApp.");
      return;
    }

    const alreadySentBeforeOpen = hasLog(
      params.communicationType,
      params.referenceId,
      params.associateId
    );

    if (alreadySentBeforeOpen) {
      setMessage("Esta comunicação já foi registrada hoje para este associado.");
      return;
    }

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    const key = `${params.communicationType}-${params.referenceId}-${params.associateId}`;
    setSavingKey(key);
    setMessage("WhatsApp aberto. Registrando o clique...");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage(
        "WhatsApp aberto, mas não foi possível identificar o usuário logado para registrar o clique."
      );
      setSavingKey(null);
      return;
    }

    const { error } = await supabase.from("communication_logs").upsert(
      {
        associate_id: params.associateId,
        communication_type: params.communicationType,
        reference_id: params.referenceId,
        reference_label: params.referenceLabel,
        channel: "whatsapp",
        message: params.preparedMessage,
        sent_by: user.id,
      },
      {
        onConflict: "associate_id,communication_type,reference_id",
        ignoreDuplicates: true,
      }
    );

    if (error) {
      setMessage(
        "WhatsApp aberto, mas não foi possível registrar o clique: " +
          (error.message || "erro desconhecido")
      );
      setSavingKey(null);
      return;
    }

    addLocalLog(params.communicationType, params.referenceId, params.associateId);

    setMessage("WhatsApp aberto e clique registrado.");
    setSavingKey(null);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function StatusBadge({ sent }: { sent: boolean }) {
    return sent ? (
      <span className="rounded-full bg-[#13233a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
        enviado hoje
      </span>
    ) : (
      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
        pendente
      </span>
    );
  }

  function ActionButtons({
    sent,
    saving,
    hasPhone,
    preparedMessage,
    onSend,
  }: {
    sent: boolean;
    saving: boolean;
    hasPhone: boolean;
    preparedMessage: string;
    onSend: () => void;
  }) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
        <button
          type="button"
          onClick={() => copyMessage(preparedMessage)}
          className="rounded-full border border-[#d7c7b4] bg-white px-3.5 py-2 text-xs font-black text-[#13233a] transition hover:bg-[#f7f8fa]"
        >
          Copiar
        </button>

        {hasPhone && (
          <button
            type="button"
            onClick={onSend}
            disabled={saving || sent}
            className={`rounded-full px-3.5 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
              sent
                ? "bg-[#13233a] text-white"
                : "bg-[#13233a] text-white hover:bg-[#0c1728]"
            }`}
          >
            {saving ? "Abrindo..." : sent ? "Enviado hoje" : "Abrir e registrar"}
          </button>
        )}
      </div>
    );
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
          <div className="bg-[#13233a] px-5 py-4 text-white md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.26em] text-[#c7a56b]">
                  Comunicações
                </p>

                <h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">
                  WhatsApp manual
                </h1>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/70">
                  Mensagens prontas com registro de clique para evitar envios repetidos.
                </p>
              </div>

              <button
                type="button"
                onClick={loadData}
                className="w-fit rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#13233a] transition hover:bg-[#f7f8fa]"
              >
                Atualizar
              </button>
            </div>
          </div>
        </section>

        {(message || warning) && (
          <div className="grid gap-2">
            {message && (
              <div className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#13233a] shadow-sm">
                {message}
              </div>
            )}

            {warning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                {warning}
              </div>
            )}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
          <div className="border-b border-[#e8dccb] p-4 md:px-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#a7834d]">
                  Feliz aniversário
                </p>
                <h2 className="mt-1 text-lg font-black text-[#13233a]">
                  Aniversariantes de hoje
                </h2>
                <p className="mt-1 text-sm text-[#596579]">
                  Nascimento em {today.day}/{today.month}.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#f7f8fa] p-2.5 text-center md:min-w-[260px]">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                    Hoje
                  </p>
                  <p className="text-base font-black text-[#13233a]">
                    {today.day}/{today.month}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                    Pessoas
                  </p>
                  <p className="text-base font-black text-[#13233a]">
                    {birthdayAssociates.length}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                    Enviados
                  </p>
                  <p className="text-base font-black text-[#13233a]">
                    {totalBirthdaysSentToday}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5">
            {loading ? (
              <EmptyMessage text="Carregando aniversariantes..." />
            ) : birthdayAssociates.length === 0 ? (
              <EmptyMessage text="Nenhum associado ativo faz aniversário hoje." />
            ) : (
              <div className="space-y-2.5">
                {birthdayAssociates.map((associate) => {
                  const preparedMessage = makeBirthdayMessage(associate.full_name);
                  const referenceId = today.birthdayReferenceId;
                  const sent = hasLog("birthday", referenceId, associate.id);
                  const hasPhone = Boolean(normalizePhoneForWhatsApp(associate.phone));
                  const saving = savingKey === `birthday-${referenceId}-${associate.id}`;

                  return (
                    <article
                      key={associate.id}
                      className={`rounded-2xl border px-4 py-3 ${
                        sent
                          ? "border-[#d7c7b4] bg-[#f1f5f9]"
                          : "border-[#e8dccb] bg-[#f7f8fa]"
                      }`}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-[#13233a]">
                              {associate.full_name}
                            </p>
                            <StatusBadge sent={sent} />
                          </div>
                          <p className="mt-0.5 text-sm font-bold text-[#596579]">
                            {associate.phone || "Telefone não informado"}
                          </p>
                        </div>

                        <ActionButtons
                          sent={sent}
                          saving={saving}
                          hasPhone={hasPhone}
                          preparedMessage={preparedMessage}
                          onSend={() =>
                            openWhatsAppAndRegister({
                              associateId: associate.id,
                              phone: associate.phone,
                              communicationType: "birthday",
                              referenceId,
                              referenceLabel: today.birthdayReferenceLabel,
                              preparedMessage,
                            })
                          }
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <CommunicationSection
          title="Vencimentos próximos"
          eyebrow="Lembrete"
          description="Lançamentos com vencimento de hoje até os próximos 3 dias."
          totalLabel="Associados"
          total={upcomingDueGroups.length}
          sent={totalUpcomingDueSent}
          loading={loading}
          emptyText="Nenhum vencimento próximo encontrado."
        >
          {upcomingDueGroups.map((group) => {
            const preparedMessage = makeUpcomingDueMessage(group);
            const sent = hasLog(
              "upcoming_due_reminder",
              group.referenceId,
              group.associateId
            );
            const hasPhone = Boolean(normalizePhoneForWhatsApp(group.phone));
            const saving =
              savingKey ===
              `upcoming_due_reminder-${group.referenceId}-${group.associateId}`;

            return (
              <CompactCommunicationItem
                key={group.associateId}
                sent={sent}
                name={group.associateName}
                detail={`${group.phone || "Telefone não informado"} • ${
                  group.items.length
                } lançamento(s) • Total: ${formatCurrency(group.totalAmount)}`}
                saving={saving}
                hasPhone={hasPhone}
                preparedMessage={preparedMessage}
                onCopy={() => copyMessage(preparedMessage)}
                onSend={() =>
                  openWhatsAppAndRegister({
                    associateId: group.associateId,
                    phone: group.phone,
                    communicationType: "upcoming_due_reminder",
                    referenceId: group.referenceId,
                    referenceLabel: group.referenceLabel,
                    preparedMessage,
                  })
                }
              />
            );
          })}
        </CommunicationSection>

        <CommunicationSection
          title="Mensalidades vencidas"
          eyebrow="Financeiro"
          description="Uma mensagem consolidada por associado e por dia."
          totalLabel="Associados"
          total={monthlyFeeGroups.length}
          sent={totalMonthlyFeeSent}
          loading={loading}
          emptyText="Nenhuma mensalidade vencida encontrada."
        >
          {monthlyFeeGroups.map((group) => {
            const preparedMessage = makeMonthlyFeeMessage(group);
            const sent = hasLog("monthly_fee_overdue", group.referenceId, group.associateId);
            const hasPhone = Boolean(normalizePhoneForWhatsApp(group.phone));
            const saving =
              savingKey === `monthly_fee_overdue-${group.referenceId}-${group.associateId}`;

            return (
              <CompactCommunicationItem
                key={group.associateId}
                sent={sent}
                name={group.associateName}
                detail={`${group.phone || "Telefone não informado"} • ${
                  group.fees.length
                } mensalidade(s) • Total: ${formatCurrency(group.totalOpenAmount)}`}
                saving={saving}
                hasPhone={hasPhone}
                preparedMessage={preparedMessage}
                onCopy={() => copyMessage(preparedMessage)}
                onSend={() =>
                  openWhatsAppAndRegister({
                    associateId: group.associateId,
                    phone: group.phone,
                    communicationType: "monthly_fee_overdue",
                    referenceId: group.referenceId,
                    referenceLabel: group.referenceLabel,
                    preparedMessage,
                  })
                }
              />
            );
          })}
        </CommunicationSection>

        <CommunicationSection
          title="Contribuições extras vencidas"
          eyebrow="Financeiro"
          description="Uma mensagem consolidada por associado e por dia."
          totalLabel="Associados"
          total={extraContributionGroups.length}
          sent={totalExtraContributionSent}
          loading={loading}
          emptyText="Nenhuma contribuição extra vencida encontrada."
        >
          {extraContributionGroups.map((group) => {
            const preparedMessage = makeExtraContributionMessage(group);
            const sent = hasLog(
              "extra_contribution_overdue",
              group.referenceId,
              group.associateId
            );
            const hasPhone = Boolean(normalizePhoneForWhatsApp(group.phone));
            const saving =
              savingKey ===
              `extra_contribution_overdue-${group.referenceId}-${group.associateId}`;

            return (
              <CompactCommunicationItem
                key={group.associateId}
                sent={sent}
                name={group.associateName}
                detail={`${group.phone || "Telefone não informado"} • ${
                  group.items.length
                } contribuição(ões) • Total: ${formatCurrency(group.totalOpenAmount)}`}
                saving={saving}
                hasPhone={hasPhone}
                preparedMessage={preparedMessage}
                onCopy={() => copyMessage(preparedMessage)}
                onSend={() =>
                  openWhatsAppAndRegister({
                    associateId: group.associateId,
                    phone: group.phone,
                    communicationType: "extra_contribution_overdue",
                    referenceId: group.referenceId,
                    referenceLabel: group.referenceLabel,
                    preparedMessage,
                  })
                }
              />
            );
          })}
        </CommunicationSection>

        <p className="px-1 text-xs leading-5 text-[#667085]">
          O sistema não envia mensagens automaticamente. Ele abre o WhatsApp com
          a mensagem pronta e registra o clique para controle interno.
        </p>
      </div>
    </ProtectedDashboard>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
      {text}
    </div>
  );
}

function CommunicationSection({
  title,
  eyebrow,
  description,
  totalLabel,
  total,
  sent,
  loading,
  emptyText,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  totalLabel: string;
  total: number;
  sent: number;
  loading: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
      <div className="border-b border-[#e8dccb] p-4 md:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#a7834d]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-black text-[#13233a]">{title}</h2>
            <p className="mt-1 text-sm text-[#596579]">{description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f7f8fa] p-2.5 text-center md:min-w-[190px]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                {totalLabel}
              </p>
              <p className="text-base font-black text-[#13233a]">{total}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                Enviados
              </p>
              <p className="text-base font-black text-[#13233a]">{sent}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {loading ? (
          <EmptyMessage text="Carregando comunicações..." />
        ) : total === 0 ? (
          <EmptyMessage text={emptyText} />
        ) : (
          <div className="space-y-2.5">{children}</div>
        )}
      </div>
    </section>
  );
}

function CompactCommunicationItem({
  sent,
  name,
  detail,
  saving,
  hasPhone,
  preparedMessage,
  onCopy,
  onSend,
}: {
  sent: boolean;
  name: string;
  detail: string;
  saving: boolean;
  hasPhone: boolean;
  preparedMessage: string;
  onCopy: () => void;
  onSend: () => void;
}) {
  return (
    <article
      className={`rounded-2xl border px-4 py-3 ${
        sent ? "border-[#d7c7b4] bg-[#f1f5f9]" : "border-[#e8dccb] bg-[#f7f8fa]"
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-[#13233a]">{name}</p>
            {sent ? (
              <span className="rounded-full bg-[#13233a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                enviado hoje
              </span>
            ) : (
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                pendente
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm font-bold text-[#596579]">{detail}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-full border border-[#d7c7b4] bg-white px-3.5 py-2 text-xs font-black text-[#13233a] transition hover:bg-[#f7f8fa]"
          >
            Copiar
          </button>

          {hasPhone && (
            <button
              type="button"
              onClick={onSend}
              disabled={saving || sent}
              className={`rounded-full px-3.5 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-70 ${
                sent
                  ? "bg-[#13233a] text-white"
                  : "bg-[#13233a] text-white hover:bg-[#0c1728]"
              }`}
            >
              {saving ? "Abrindo..." : sent ? "Enviado hoje" : "Abrir e registrar"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
