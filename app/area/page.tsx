"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type MembershipRequest = {
  id: string;
  status: string;
  review_notes: string | null;
  created_at: string;
};

type Associate = {
  id: string;
  status: string;
  financial_status: string;
};

type MonthlyFee = {
  id: string;
  year: number;
  month: number;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: string;
};

type ExtraContributionItem = {
  id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  extra_contributions:
    | {
        title: string;
      }
    | {
        title: string;
      }[]
    | null;
};

type PaymentReport = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
};

type Notice = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
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
  com_pendencia: "Com pendência",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  ativo: "Ativo",
  em_dia: "Em dia",
  pendente_financeiro: "Pendente",
  em_atraso: "Em atraso",
  inadimplente_grave: "Inadimplente grave",
};

const chartColors = {
  monthly: "#13233a",
  extra: "#c7a56b",
};

function formatStatus(value?: string | null) {
  if (!value) return "Sem solicitação";

  return statusLabels[value] || value.replaceAll("_", " ");
}

function getFirstName(name?: string | null) {
  if (!name) return "usuário";
  return name.trim().split(" ")[0] || name;
}

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

function getMonthLabel(fee: MonthlyFee) {
  return `${monthNames[Number(fee.month) - 1] ?? fee.month} de ${fee.year}`;
}

function getExtraTitle(item: ExtraContributionItem) {
  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0]?.title ?? "Contribuição extra";
  }

  return item.extra_contributions?.title ?? "Contribuição extra";
}

function getRemaining(total: number, paid: number) {
  return Math.max(Number(total ?? 0) - Number(paid ?? 0), 0);
}

function SimpleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-xs font-bold text-[#13233a] shadow-sm">
      {payload.map((item) => (
        <p key={item.name}>
          {item.name}: {formatCurrency(item.value)}
        </p>
      ))}
    </div>
  );
}

export default function AreaPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [request, setRequest] = useState<MembershipRequest | null>(null);
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraContributionItem[]>([]);
  const [paymentReports, setPaymentReports] = useState<PaymentReport[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [message, setMessage] = useState("");

  const isActiveAssociate = associate?.status === "ativo";

  const summary = useMemo(() => {
    const openMonthlyFees = monthlyFees.filter((fee) =>
      ["pendente", "parcialmente_paga", "atrasada"].includes(fee.status)
    );

    const openExtraItems = extraItems.filter((item) =>
      ["pendente", "parcialmente_paga", "atrasada"].includes(item.status)
    );

    const monthlyOpenAmount = openMonthlyFees.reduce((sum, fee) => {
      return sum + getRemaining(fee.total_amount, fee.paid_amount);
    }, 0);

    const extraOpenAmount = openExtraItems.reduce((sum, item) => {
      return sum + getRemaining(item.amount, item.paid_amount);
    }, 0);

    const pendingReports = paymentReports.filter(
      (report) => report.status === "pendente"
    );

    const nextMonthly = openMonthlyFees
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

    const nextExtra = openExtraItems
      .slice()
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

    const candidates = [
      nextMonthly
        ? {
            type: "monthly" as const,
            title: getMonthLabel(nextMonthly),
            dueDate: nextMonthly.due_date,
            amount: getRemaining(nextMonthly.total_amount, nextMonthly.paid_amount),
            href: "/area/financeiro",
          }
        : null,
      nextExtra
        ? {
            type: "extra" as const,
            title: getExtraTitle(nextExtra),
            dueDate: nextExtra.due_date,
            amount: getRemaining(nextExtra.amount, nextExtra.paid_amount),
            href: "/area/contribuicoes-extras",
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    const nextPending = candidates.sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate)
    )[0];

    return {
      openMonthlyFees,
      openExtraItems,
      monthlyOpenAmount,
      extraOpenAmount,
      totalOpenAmount: monthlyOpenAmount + extraOpenAmount,
      pendingReports,
      nextPending,
    };
  }, [monthlyFees, extraItems, paymentReports]);

  const chartData = [
    {
      name: "Mensalidades",
      valor: summary.monthlyOpenAmount,
      fill: chartColors.monthly,
    },
    {
      name: "Extras",
      valor: summary.extraOpenAmount,
      fill: chartColors.extra,
    },
  ];

  const mainAction = useMemo(() => {
    if (!request) {
      return {
        title: "Envie sua solicitação de associação",
        text: "Preencha a ficha para que a Associação possa analisar seu pedido.",
        href: "/area/solicitacao",
        label: "Preencher solicitação",
      };
    }

    if (request.status === "com_pendencia") {
      return {
        title: "Sua solicitação precisa de correção",
        text: request.review_notes || "Confira a observação registrada e ajuste as informações solicitadas.",
        href: "/area/solicitacao",
        label: "Corrigir solicitação",
      };
    }

    if (request.status === "pendente") {
      return {
        title: "Solicitação em análise",
        text: "Aguarde a conferência da Diretoria/Secretaria. Você pode acompanhar o andamento por aqui.",
        href: "/area/solicitacao",
        label: "Ver solicitação",
      };
    }

    if (request.status === "rejeitada") {
      return {
        title: "Solicitação analisada",
        text: request.review_notes || "Confira os detalhes e procure a Associação, se necessário.",
        href: "/area/solicitacao",
        label: "Ver detalhes",
      };
    }

    if (summary.nextPending) {
      return {
        title: "Há pendência financeira em aberto",
        text: `${summary.nextPending.title} vence/venceu em ${formatDate(
          summary.nextPending.dueDate
        )}.`,
        href: summary.nextPending.href,
        label: "Ver pendência",
      };
    }

    if (isActiveAssociate) {
      return {
        title: "Sua situação está organizada",
        text: "Acompanhe avisos, documentos e histórico financeiro sempre que precisar.",
        href: "/area/pagamentos",
        label: "Ver histórico",
      };
    }

    return {
      title: "Cadastro em atualização",
      text: "Sua solicitação foi aprovada. Aguarde a liberação completa do cadastro de associado.",
      href: "/area/solicitacao",
      label: "Ver solicitação",
    };
  }, [request, isActiveAssociate, summary.nextPending]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      setMessage("Não foi possível carregar seu perfil.");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const { data: requestData } = await supabase
      .from("membership_requests")
      .select("id, status, review_notes, created_at")
      .or(`profile_id.eq.${profileData.id},email.eq.${profileData.email}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setRequest(requestData);

    const { data: associateData } = await supabase
      .from("associates")
      .select("id, status, financial_status")
      .eq("email", profileData.email)
      .maybeSingle();

    setAssociate(associateData);

    if (associateData?.id) {
      const [feesResult, extrasResult, reportsResult] = await Promise.all([
        supabase
          .from("monthly_fees")
          .select("id, year, month, due_date, total_amount, paid_amount, status")
          .eq("associate_id", associateData.id)
          .in("status", ["pendente", "parcialmente_paga", "atrasada"])
          .order("due_date", { ascending: true }),
        supabase
          .from("extra_contribution_items")
          .select(
            "id, amount, paid_amount, due_date, status, extra_contributions(title)"
          )
          .eq("associate_id", associateData.id)
          .in("status", ["pendente", "parcialmente_paga", "atrasada"])
          .order("due_date", { ascending: true }),
        supabase
          .from("payment_reports")
          .select("id, amount, status, created_at")
          .eq("associate_id", associateData.id)
          .eq("status", "pendente")
          .order("created_at", { ascending: false }),
      ]);

      if (feesResult.error || extrasResult.error || reportsResult.error) {
        console.error("Erro ao carregar dados financeiros:", {
          feesError: feesResult.error,
          extrasError: extrasResult.error,
          reportsError: reportsResult.error,
        });

        setMessage("Seu perfil foi carregado, mas alguns indicadores financeiros não puderam ser exibidos.");
      }

      setMonthlyFees((feesResult.data as MonthlyFee[] | null) ?? []);
      setExtraItems(
        (extrasResult.data as unknown as ExtraContributionItem[] | null) ?? []
      );
      setPaymentReports((reportsResult.data as PaymentReport[] | null) ?? []);
    }

    const { data: noticesData } = await supabase
      .from("notices")
      .select("id, title, content, category, created_at")
      .eq("status", "publicado")
      .order("created_at", { ascending: false })
      .limit(3);

    setNotices((noticesData as Notice[] | null) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Minha área
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Olá, {getFirstName(profile?.full_name)}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Acompanhe sua situação, pendências financeiras e avisos importantes da Associação.
              </p>
            </div>

            <div className="w-fit rounded-xl bg-white/10 px-4 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/60">
                Situação
              </p>

              <p className="text-sm font-black text-white">
                {isActiveAssociate ? "Associado ativo" : formatStatus(request?.status)}
              </p>
            </div>
          </div>
        </section>

        {message && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </section>
        )}

        {loading ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando sua área...</p>
          </section>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                  Total em aberto
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {isActiveAssociate
                    ? formatCurrency(summary.totalOpenAmount)
                    : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                  Mensalidades
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {isActiveAssociate ? summary.openMonthlyFees.length : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                  Contribuições extras
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {isActiveAssociate ? summary.openExtraItems.length : "—"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                  Informes pendentes
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {isActiveAssociate ? summary.pendingReports.length : "—"}
                </p>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                      Pendências financeiras
                    </h2>

                    <p className="text-xs font-bold text-[#596579]">
                      Valores em aberto vinculados ao seu cadastro.
                    </p>
                  </div>

                  {isActiveAssociate && (
                    <Link
                      href="/area/financeiro"
                      className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
                    >
                      Ver detalhes
                    </Link>
                  )}
                </div>

                <div className="mt-4 h-52">
                  {!isActiveAssociate ? (
                    <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8fa] px-4 text-center text-sm font-bold leading-6 text-[#596579]">
                      O financeiro será exibido após a aprovação e ativação do cadastro como associado.
                    </div>
                  ) : summary.totalOpenAmount <= 0 ? (
                    <div className="flex h-full items-center justify-center rounded-xl bg-[#f7f8fa] px-4 text-center text-sm font-bold leading-6 text-[#596579]">
                      Nenhuma pendência financeira em aberto no momento.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: "#596579", fontWeight: 700 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: "#596579", fontWeight: 700 }}
                          width={76}
                          tickFormatter={(value) => formatCurrency(Number(value))}
                        />
                        <Tooltip content={<SimpleTooltip />} cursor={{ fill: "#f7f8fa" }} />
                        <Bar dataKey="valor" radius={[10, 10, 0, 0]}>
                          {chartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                  Próxima ação
                </p>

                <h2 className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  {mainAction.title}
                </h2>

                <p className="mt-2 text-sm font-bold leading-6 text-[#596579]">
                  {mainAction.text}
                </p>

                <Link
                  href={mainAction.href}
                  className="mt-4 inline-flex rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white"
                >
                  {mainAction.label}
                </Link>

                {request?.review_notes && (
                  <div className="mt-4 rounded-xl bg-[#fffaf1] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#b28743]">
                      Observação
                    </p>

                    <p className="mt-1 text-sm font-bold leading-6 text-[#596579]">
                      {request.review_notes}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Próxima pendência
                </h2>

                {isActiveAssociate && summary.nextPending ? (
                  <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3">
                    <p className="font-black text-[#13233a]">
                      {summary.nextPending.title}
                    </p>

                    <div className="mt-2 grid gap-2 text-sm font-bold text-[#596579] sm:grid-cols-2">
                      <p>Vencimento: {formatDate(summary.nextPending.dueDate)}</p>
                      <p>Valor: {formatCurrency(summary.nextPending.amount)}</p>
                    </div>

                    <Link
                      href={summary.nextPending.href}
                      className="mt-3 inline-flex text-xs font-black uppercase tracking-[0.08em] text-[#13233a] underline decoration-[#c7a56b] decoration-2 underline-offset-4"
                    >
                      Acompanhar pendência
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4 text-sm font-bold leading-6 text-[#596579]">
                    {isActiveAssociate
                      ? "Nenhuma pendência financeira em aberto."
                      : "Nenhuma pendência financeira disponível enquanto o cadastro não estiver ativo."}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                      Avisos recentes
                    </h2>

                    <p className="text-xs font-bold text-[#596579]">
                      Últimos comunicados publicados pela Associação.
                    </p>
                  </div>

                  <Link
                    href="/area/avisos"
                    className="text-xs font-black uppercase tracking-[0.08em] text-[#13233a] underline decoration-[#c7a56b] decoration-2 underline-offset-4"
                  >
                    Ver todos
                  </Link>
                </div>

                {notices.length === 0 ? (
                  <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4 text-sm font-bold text-[#596579]">
                    Nenhum aviso publicado no momento.
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-[#eee7db] overflow-hidden rounded-xl border border-[#e8dccb]">
                    {notices.map((notice) => (
                      <article key={notice.id} className="px-3 py-3">
                        <p className="font-black text-[#13233a]">{notice.title}</p>

                        <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-[#596579]">
                          {notice.content}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </ProtectedArea>
  );
}
