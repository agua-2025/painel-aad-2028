"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type MonthlyFee = {
  id: string;
  associate_id: string;
  year: number;
  month: number;
  base_amount: number;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  paid_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type ExtraContribution = {
  id: string;
  title: string;
  description: string | null;
  reason: string | null;
  status: string;
};

type ExtraContributionItem = {
  id: string;
  contribution_id: string;
  associate_id: string;
  amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type ChargeItem = {
  id: string;
  type: "mensalidade" | "contribuicao_extra";
  associateId: string;
  associateName: string;
  associateEmail: string | null;
  associatePhone: string | null;
  reference: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
  sourceLabel: string;
  sourceHref: string;
  createdAt: string;
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
  parcialmente_paga: "Parcial",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
  isenta: "Isenta",
};

const typeLabels: Record<ChargeItem["type"], string> = {
  mensalidade: "Mensalidade",
  contribuicao_extra: "Contribuição extra",
};

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

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getStatusClass(status: string) {
  if (status === "paga") return "bg-green-100 text-green-800";
  if (status === "parcialmente_paga") return "bg-blue-100 text-blue-800";
  if (status === "atrasada") return "bg-red-100 text-red-800";
  if (status === "cancelada") return "bg-slate-200 text-slate-700";
  if (status === "isenta") return "bg-purple-100 text-purple-800";

  return "bg-amber-100 text-amber-900";
}

function monthReference(year: number, month: number) {
  return `${monthNames[month - 1] ?? String(month)} de ${year}`;
}

export default function DashboardCobrancasPage() {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [monthlyFees, setMonthlyFees] = useState<MonthlyFee[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraContributionItem[]>([]);
  const [extraContributions, setExtraContributions] = useState<ExtraContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("em_aberto");
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const [
      associatesResult,
      monthlyFeesResult,
      extraItemsResult,
      extraContributionsResult,
    ] = await Promise.all([
      supabase
        .from("associates")
        .select("id, full_name, email, phone")
        .order("full_name", { ascending: true }),

      supabase
        .from("monthly_fees")
        .select(
          "id, associate_id, year, month, base_amount, due_date, total_amount, paid_amount, paid_at, status, notes, created_at"
        )
        .order("due_date", { ascending: false }),

      supabase
        .from("extra_contribution_items")
        .select(
          "id, contribution_id, associate_id, amount, paid_amount, due_date, status, notes, created_at"
        )
        .order("due_date", { ascending: false }),

      supabase
        .from("extra_contributions")
        .select("id, title, description, reason, status")
        .order("created_at", { ascending: false }),
    ]);

    const errors = [
      associatesResult.error,
      monthlyFeesResult.error,
      extraItemsResult.error,
      extraContributionsResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error("Erro ao carregar cobranças:", errors);
      setMessage("Não foi possível carregar todas as cobranças.");
      setLoading(false);
      return;
    }

    setAssociates((associatesResult.data as Associate[]) ?? []);
    setMonthlyFees((monthlyFeesResult.data as MonthlyFee[]) ?? []);
    setExtraItems((extraItemsResult.data as ExtraContributionItem[]) ?? []);
    setExtraContributions(
      (extraContributionsResult.data as ExtraContribution[]) ?? []
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const charges = useMemo(() => {
    const associateMap = new Map(
      associates.map((associate) => [associate.id, associate])
    );

    const contributionMap = new Map(
      extraContributions.map((contribution) => [contribution.id, contribution])
    );

    const monthlyCharges: ChargeItem[] = monthlyFees.map((fee) => {
      const associate = associateMap.get(fee.associate_id);
      const amount = Number(fee.total_amount ?? fee.base_amount ?? 0);
      const paidAmount = Number(fee.paid_amount ?? 0);

      return {
        id: fee.id,
        type: "mensalidade",
        associateId: fee.associate_id,
        associateName: associate?.full_name ?? "Associado não localizado",
        associateEmail: associate?.email ?? null,
        associatePhone: associate?.phone ?? null,
        reference: monthReference(Number(fee.year), Number(fee.month)),
        dueDate: fee.due_date,
        amount,
        paidAmount,
        balance: Math.max(amount - paidAmount, 0),
        status: fee.status,
        sourceLabel: "Mensalidades",
        sourceHref: "/dashboard/mensalidades",
        createdAt: fee.created_at,
      };
    });

    const extraCharges: ChargeItem[] = extraItems.map((item) => {
      const associate = associateMap.get(item.associate_id);
      const contribution = contributionMap.get(item.contribution_id);
      const amount = Number(item.amount ?? 0);
      const paidAmount = Number(item.paid_amount ?? 0);

      return {
        id: item.id,
        type: "contribuicao_extra",
        associateId: item.associate_id,
        associateName: associate?.full_name ?? "Associado não localizado",
        associateEmail: associate?.email ?? null,
        associatePhone: associate?.phone ?? null,
        reference: contribution?.title ?? "Contribuição extra",
        dueDate: item.due_date,
        amount,
        paidAmount,
        balance: Math.max(amount - paidAmount, 0),
        status: item.status,
        sourceLabel: "Contribuições Extras",
        sourceHref: "/dashboard/contribuicoes-extras",
        createdAt: item.created_at,
      };
    });

    return [...monthlyCharges, ...extraCharges].sort((a, b) => {
      const dateComparison =
        new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();

      if (dateComparison !== 0) return dateComparison;

      return a.associateName.localeCompare(b.associateName);
    });
  }, [associates, monthlyFees, extraItems, extraContributions]);

  const filteredCharges = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim());

    return charges.filter((charge) => {
      if (typeFilter !== "todos" && charge.type !== typeFilter) return false;

      if (statusFilter === "em_aberto") {
        if (!["pendente", "parcialmente_paga", "atrasada"].includes(charge.status)) {
          return false;
        }
      } else if (statusFilter !== "todos" && charge.status !== statusFilter) {
        return false;
      }

      if (monthFilter) {
        const chargeMonth = charge.dueDate.slice(0, 7);
        if (chargeMonth !== monthFilter) return false;
      }

      if (normalizedSearch) {
        const haystack = normalizeText(
          [
            charge.associateName,
            charge.associateEmail,
            charge.associatePhone,
            charge.reference,
            typeLabels[charge.type],
            statusLabels[charge.status] ?? charge.status,
          ]
            .filter(Boolean)
            .join(" ")
        );

        if (!haystack.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }, [charges, typeFilter, statusFilter, search, monthFilter]);

  const summary = useMemo(() => {
    const totalAmount = filteredCharges.reduce(
      (sum, charge) => sum + charge.amount,
      0
    );

    const paidAmount = filteredCharges.reduce(
      (sum, charge) => sum + charge.paidAmount,
      0
    );

    const openAmount = filteredCharges.reduce(
      (sum, charge) => sum + charge.balance,
      0
    );

    const openCount = filteredCharges.filter((charge) =>
      ["pendente", "parcialmente_paga", "atrasada"].includes(charge.status)
    ).length;

    return {
      totalAmount,
      paidAmount,
      openAmount,
      openCount,
      totalCount: filteredCharges.length,
    };
  }, [filteredCharges]);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Financeiro
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Cobranças
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Visão consolidada das mensalidades e contribuições extras lançadas para pagamento.
          </p>
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2.5 text-sm font-medium leading-6 text-[#596579] shadow-sm">
          Esta tela é somente consulta. Para gerar cobranças ou registrar pagamentos, utilize os módulos próprios de Mensalidades, Contribuições Extras e Informes de Pagamento.
        </section>

        {message && (
          <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {message}
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
              Total lançado
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              {formatCurrency(summary.totalAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
              Total pago
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-green-700">
              {formatCurrency(summary.paidAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
              Em aberto
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-red-700">
              {formatCurrency(summary.openAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
              Cobranças em aberto
            </p>
            <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              {summary.openCount}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Consulta de cobranças
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                {summary.totalCount} registro(s) conforme os filtros aplicados.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.4fr]">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Tipo
              </span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none"
              >
                <option value="todos">Todos</option>
                <option value="mensalidade">Mensalidades</option>
                <option value="contribuicao_extra">Contribuições extras</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none"
              >
                <option value="todos">Todos</option>
                <option value="em_aberto">Em aberto</option>
                <option value="pendente">Pendente</option>
                <option value="parcialmente_paga">Parcial</option>
                <option value="atrasada">Atrasada</option>
                <option value="paga">Paga</option>
                <option value="cancelada">Cancelada</option>
                <option value="isenta">Isenta</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Mês de vencimento
              </span>
              <input
                type="month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Buscar
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome, e-mail, telefone ou referência"
                className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none"
              />
            </label>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando cobranças...
            </div>
          ) : filteredCharges.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhuma cobrança encontrada
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                Altere os filtros ou gere cobranças nos módulos de mensalidades e contribuições extras.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#596579] xl:grid">
                <div className="col-span-3">Associado</div>
                <div className="col-span-2">Tipo/Referência</div>
                <div className="col-span-1">Vencimento</div>
                <div className="col-span-2 text-right">Valores</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2">Contato</div>
                <div className="col-span-1 text-right">Origem</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {filteredCharges.map((charge) => (
                  <article
                    key={`${charge.type}-${charge.id}`}
                    className="grid gap-3 px-3 py-3 text-sm xl:grid-cols-12 xl:items-center"
                  >
                    <div className="xl:col-span-3">
                      <p className="font-black text-[#13233a]">
                        {charge.associateName}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-[#596579]">
                        ID: {charge.associateId.slice(0, 8)}
                      </p>
                    </div>

                    <div className="xl:col-span-2">
                      <p className="text-xs font-black uppercase tracking-[0.06em] text-[#b28743]">
                        {typeLabels[charge.type]}
                      </p>
                      <p className="mt-0.5 text-xs font-medium leading-5 text-[#596579]">
                        {charge.reference}
                      </p>
                    </div>

                    <div className="text-xs font-bold text-[#596579] xl:col-span-1">
                      {formatDate(charge.dueDate)}
                    </div>

                    <div className="space-y-0.5 text-xs font-medium text-[#596579] xl:col-span-2 xl:text-right">
                      <p>
                        Valor:{" "}
                        <span className="font-black text-[#13233a]">
                          {formatCurrency(charge.amount)}
                        </span>
                      </p>
                      <p>Pago: {formatCurrency(charge.paidAmount)}</p>
                      <p className={charge.balance > 0 ? "font-black text-red-700" : "font-black text-green-700"}>
                        Saldo: {formatCurrency(charge.balance)}
                      </p>
                    </div>

                    <div className="xl:col-span-1 xl:text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${getStatusClass(charge.status)}`}>
                        {statusLabels[charge.status] ?? charge.status}
                      </span>
                    </div>

                    <div className="text-xs font-medium leading-5 text-[#596579] xl:col-span-2">
                      <p>{charge.associateEmail || "E-mail não informado"}</p>
                      <p>{charge.associatePhone || "Telefone não informado"}</p>
                    </div>

                    <div className="xl:col-span-1 xl:text-right">
                      <Link
                        href={charge.sourceHref}
                        className="inline-flex rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
                      >
                        Abrir
                      </Link>
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
