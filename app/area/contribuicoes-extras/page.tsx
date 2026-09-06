"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";
import { calculateExtraContributionAmountDue } from "@/lib/extraContributionCharges";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

type PendingExtraReport = {
  id: string;
  extra_contribution_item_id: string | null;
  status: string;
};

type PixPaymentData = {
  id: string;
  txid: string;
  status: string;
  original_amount: number;
  updated_amount: number;
  expires_at: string | null;
  pix_copia_e_cola: string | null;
  location: string | null;
  loc_id: string | null;
  created_at: string;
};

type PixPaymentResponse = {
  ok: boolean;
  reused?: boolean;
  message: string;
  pix_charge?: PixPaymentData;
  error?: string;
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
  extra_contributions:
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
        apply_late_charges?: boolean | null;
        late_fee_percent?: number | null;
        daily_interest_percent?: number | null;
        late_fee_grace_days?: number | null;
      }
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
        apply_late_charges?: boolean | null;
        late_fee_percent?: number | null;
        daily_interest_percent?: number | null;
        late_fee_grace_days?: number | null;
      }[]
    | null;
};

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

  const dateOnly = value.includes("T") ? value : value + "T00:00:00";
  const date = new Date(dateOnly);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleString("pt-BR");
}

function getContribution(item: ExtraContributionItem) {
  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function isOpenItem(item: ExtraContributionItem) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(item.status);
}

const pixPaymentsEnabled = process.env.NEXT_PUBLIC_PIX_PAYMENTS_ENABLED === "true";

export default function AreaContribuicoesExtrasPage() {
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [items, setItems] = useState<ExtraContributionItem[]>([]);
  const [pendingReportItemIds, setPendingReportItemIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [generatingPixItemId, setGeneratingPixItemId] = useState<string | null>(null);
  const [pixPayment, setPixPayment] = useState<PixPaymentResponse | null>(null);
  const [pixQrCode, setPixQrCode] = useState("");
  const [pixMessage, setPixMessage] = useState("");

  const summary = useMemo(() => {
    const openItems = items
      .filter(isOpenItem)
      .sort((a, b) => {
        const dateA = new Date(a.due_date + "T00:00:00").getTime();
        const dateB = new Date(b.due_date + "T00:00:00").getTime();

        return dateA - dateB;
      });

    const paidItems = items.filter((item) => item.status === "paga");

    const totalOpen = openItems.reduce((sum, item) => {
      const balance = calculateExtraContributionAmountDue(item).remaining;

      return sum + balance;
    }, 0);

    const totalPaid = items.reduce(
      (sum, item) => sum + Number(item.paid_amount ?? 0),
      0
    );

    return {
      openItems,
      paidItems,
      totalOpen,
      totalPaid,
    };
  }, [items]);


  async function handleGeneratePix(itemId: string) {
    setGeneratingPixItemId(itemId);
    setPixPayment(null);
    setPixQrCode("");
    setPixMessage("");

    try {
      const response = await fetch(`/api/pix/extra-contribution-item/${itemId}`, {
        method: "POST",
      });

      const data = (await response.json()) as PixPaymentResponse;

      if (!response.ok || !data.ok || !data.pix_charge) {
        setPixMessage(data.message || data.error || "Não foi possível gerar o Pix.");
        return;
      }

      setPixPayment(data);

      setTimeout(() => {
        document.getElementById("pix-payment-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);

      if (data.pix_charge.pix_copia_e_cola) {
        const qrCode = await QRCode.toDataURL(data.pix_charge.pix_copia_e_cola, {
          margin: 2,
          width: 240,
        });

        setPixQrCode(qrCode);
      }
    } catch (error) {
      console.error("Erro ao gerar Pix:", error);
      setPixMessage("Não foi possível gerar o Pix. Tente novamente.");
    } finally {
      setGeneratingPixItemId(null);
    }
  }

  async function copyPixCode() {
    const pixCode = pixPayment?.pix_charge?.pix_copia_e_cola;

    if (!pixCode) return;

    try {
      await navigator.clipboard.writeText(pixCode);
      setPixMessage("Código Pix copiado.");
    } catch {
      setPixMessage("Não foi possível copiar automaticamente. Selecione e copie o código manualmente.");
    }
  }

  function closePixPayment() {
    setPixPayment(null);
    setPixQrCode("");
    setPixMessage("");
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setMessage("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: associateData, error: associateError } = await supabase
        .from("associates")
        .select("id, full_name, email, status")
        .eq("email", user.email)
        .maybeSingle();

      if (associateError) {
        console.error("Erro ao carregar associado:", associateError);
        setMessage("Não foi possível carregar seu cadastro de associado.");
        setLoading(false);
        return;
      }

      if (!associateData || associateData.status !== "ativo") {
        setAssociate(null);
        setItems([]);
        setPendingReportItemIds(new Set());
        setLoading(false);
        return;
      }

      setAssociate(associateData);

      const { data: itemsData, error: itemsError } = await supabase
        .from("extra_contribution_items")
        .select(
          "id, contribution_id, associate_id, amount, paid_amount, due_date, status, notes, extra_contributions(id, title, description, reason, status, apply_late_charges, late_fee_percent, daily_interest_percent, late_fee_grace_days)"
        )
        .eq("associate_id", associateData.id)
        .order("due_date", { ascending: true });

      if (itemsError) {
        console.error("Erro ao carregar contribuições extras:", itemsError);
        setMessage("Não foi possível carregar suas contribuições extras.");
        setLoading(false);
        return;
      }

      const { data: pendingReportsData, error: pendingReportsError } =
        await supabase
          .from("payment_reports")
          .select("id, extra_contribution_item_id, status")
          .eq("associate_id", associateData.id)
          .eq("status", "pendente")
          .not("extra_contribution_item_id", "is", null);

      if (pendingReportsError) {
        console.error(
          "Erro ao carregar informes pendentes de contribuições extras:",
          pendingReportsError
        );
      }

      const pendingIds = new Set(
        ((pendingReportsData as PendingExtraReport[] | null) ?? [])
          .map((report) => report.extra_contribution_item_id)
          .filter((id): id is string => Boolean(id))
      );

      setItems((itemsData as unknown as ExtraContributionItem[]) ?? []);
      setPendingReportItemIds(pendingIds);
      setLoading(false);
    }

    loadData();
  }, []);

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Minha área
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Contribuições Extras
              </h1>

              <p className="mt-2 text-sm font-bold text-white/75">
                {summary.totalOpen > 0 ? "Com contribuições em aberto" : "Sem contribuições em aberto"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[360px]">
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c7a56b]">
                  Em aberto
                </p>

                <p className="mt-1 text-xl font-black tracking-[-0.03em]">
                  {formatCurrency(summary.totalOpen)}
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c7a56b]">
                  Pago
                </p>

                <p className="mt-1 text-xl font-black tracking-[-0.03em]">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </div>
            </div>
          </div>
        </section>


        {pixPayment && pixPayment.pix_charge && (
          <section id="pix-payment-section" className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                  Pagamento Pix
                </p>

                <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                  QR Code gerado com sucesso
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#596579]">
                  Valor do Pix:{" "}
                  <span className="font-black text-[#13233a]">
                    {formatCurrency(pixPayment.pix_charge.updated_amount)}
                  </span>
                  {pixPayment.reused ? " · cobrança ativa reaproveitada" : " · nova cobrança gerada"}
                </p>

                <p className="mt-1 text-xs font-bold text-[#596579]">
                  Válido até: {formatDateTime(pixPayment.pix_charge.expires_at)}
                </p>
              </div>

              <button
                type="button"
                onClick={closePixPayment}
                className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="rounded-2xl border border-[#eee7db] bg-[#f7f8fa] p-4 text-center">
                {pixQrCode ? (
                  <img
                    src={pixQrCode}
                    alt="QR Code Pix"
                    className="mx-auto h-60 w-60 rounded-xl bg-white p-2"
                  />
                ) : (
                  <div className="flex h-60 items-center justify-center rounded-xl bg-white text-sm font-bold text-[#596579]">
                    QR Code indisponível
                  </div>
                )}

                <p className="mt-3 text-xs font-bold text-[#596579]">
                  Escaneie o QR Code no aplicativo do banco.
                </p>
              </div>

              <div className="rounded-2xl border border-[#eee7db] bg-[#f7f8fa] p-4">
                <p className="text-sm font-black text-[#13233a]">
                  Pix copia e cola
                </p>

                <textarea
                  readOnly
                  value={pixPayment.pix_charge.pix_copia_e_cola ?? ""}
                  className="mt-3 h-32 w-full resize-none rounded-xl border border-[#e8dccb] bg-white p-3 text-xs font-bold text-[#13233a] outline-none"
                />

                <button
                  type="button"
                  onClick={copyPixCode}
                  className="mt-3 rounded-full bg-[#13233a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-[#1d3557]"
                >
                  Copiar código Pix
                </button>

                {pixMessage && (
                  <p className="mt-3 text-sm font-bold text-[#596579]">
                    {pixMessage}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {pixMessage && !pixPayment && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{pixMessage}</p>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="font-bold text-[#596579]">
              Carregando contribuições extras...
            </p>
          </div>
        ) : message ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : !associate ? (
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Área indisponível
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              Esta área é liberada para associados ativos.
            </p>
          </div>
        ) : (
          <>
<section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Contribuições extras em aberto
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  {summary.openItems.length > 0 &&
                    `Mostrando ${summary.openItems.length} de ${summary.openItems.length}.`}
                </p>
              </div>

              {summary.openItems.length === 0 ? (
                <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
                  <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                    Nenhuma contribuição extra em aberto
                  </h3>

                  <p className="mt-1 text-sm leading-6 text-[#596579]">
                    Não há rateios ou cobranças pontuais pendentes no momento.
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                  <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                    <div className="col-span-4">Contribuição</div>
                    <div className="col-span-2">Vencimento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-1 text-right">Saldo</div>
                    <div className="col-span-1 text-center">Status</div>
                    <div className="col-span-2 text-right">Ação</div>
                  </div>

                  <div className="divide-y divide-[#eee7db]">
                    {summary.openItems.map((item) => {
                      const contribution = getContribution(item);
                      const balance = calculateExtraContributionAmountDue(item).remaining;

                      return (
                        <article
                          key={item.id}
                          className="px-3 py-2 text-sm md:grid md:grid-cols-12 md:items-center md:gap-3"
                        >
                          <div className="md:hidden">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-black text-[#13233a]">
                                  {contribution?.title ?? "Contribuição extra"}
                                </p>

                                <p className="mt-0.5 text-xs font-bold text-[#596579]">
                                  Vence: {formatDate(item.due_date)}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="whitespace-nowrap font-black text-[#13233a]">
                                  {formatCurrency(balance)}
                                </p>

                                <span className="mt-1 inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                                  {statusLabels[item.status] ?? item.status}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-[#596579]">
                              <div className="rounded-lg bg-[#f7f8fa] px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#a7834d]">
                                  Valor
                                </p>
                                <p className="font-black text-[#13233a]">
                                  {formatCurrency(calculateExtraContributionAmountDue(item).totalDue)}
                                </p>
                              </div>

                              <div className="rounded-lg bg-[#f7f8fa] px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#a7834d]">
                                  Pago
                                </p>
                                <p className="font-black text-[#13233a]">
                                  {formatCurrency(item.paid_amount)}
                                </p>
                              </div>
                            </div>

                            {(contribution?.description || contribution?.reason || item.notes) && (
                              <details className="mt-2 text-xs font-bold text-[#596579]">
                                <summary className="cursor-pointer text-[#a7834d]">
                                  Detalhes
                                </summary>

                                <div className="mt-1 rounded-lg bg-[#f7f8fa] px-3 py-2 leading-5">
                                  {contribution?.description && <p>{contribution.description}</p>}
                                  {contribution?.reason && <p>Motivo: {contribution.reason}</p>}
                                  {item.notes && <p>Obs.: {item.notes}</p>}
                                </div>
                              </details>
                            )}

                            <div
                              className={`mt-2 grid gap-2 ${
                                pixPaymentsEnabled ? "grid-cols-2" : "grid-cols-1"
                              }`}
                            >
                              {pendingReportItemIds.has(item.id) ? (
                                <span className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-amber-700">
                                  Em análise
                                </span>
                              ) : (
                                <>
                                  {pixPaymentsEnabled && (
                                    <button
                                      type="button"
                                      onClick={() => handleGeneratePix(item.id)}
                                      disabled={generatingPixItemId === item.id}
                                      className="inline-flex min-h-[36px] items-center justify-center rounded-full bg-[#13233a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-[#1d3557] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {generatingPixItemId === item.id ? "..." : "Pix"}
                                    </button>
                                  )}

                                  <a
                                    href={`/area/informar-contribuicao-extra/${item.id}`}
                                    className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] transition hover:bg-[#f7f8fa]"
                                  >
                                    Informar
                                  </a>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="hidden md:contents">
                            <div className="col-span-4">
                              <p className="font-black text-[#13233a]">
                                {contribution?.title ?? "Contribuição extra"}
                              </p>

                              {(contribution?.description || contribution?.reason || item.notes) && (
                                <details className="mt-1 text-xs font-bold text-[#596579]">
                                  <summary className="cursor-pointer text-[#a7834d]">
                                    Detalhes
                                  </summary>

                                  <div className="mt-1 rounded-lg bg-[#f7f8fa] px-3 py-2 leading-5">
                                    {contribution?.description && <p>{contribution.description}</p>}
                                    {contribution?.reason && <p>Motivo: {contribution.reason}</p>}
                                    {item.notes && <p>Obs.: {item.notes}</p>}
                                  </div>
                                </details>
                              )}
                            </div>

                            <div className="col-span-2 font-bold text-[#596579]">
                              {formatDate(item.due_date)}
                            </div>

                            <div className="col-span-2 text-right font-bold text-[#596579]">
                              <p className="font-black text-[#13233a]">
                                {formatCurrency(calculateExtraContributionAmountDue(item).totalDue)}
                              </p>
                              <p className="text-xs">Pago: {formatCurrency(item.paid_amount)}</p>
                            </div>

                            <div className="col-span-1 text-right font-black text-[#13233a]">
                              {formatCurrency(balance)}
                            </div>

                            <div className="col-span-1 text-center">
                              <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                                {statusLabels[item.status] ?? item.status}
                              </span>
                            </div>

                            <div className="col-span-2 text-right">
                              {pendingReportItemIds.has(item.id) ? (
                                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-amber-700">
                                  Em análise
                                </span>
                              ) : (
                                <div
                                  className={`grid gap-1.5 ${
                                    pixPaymentsEnabled ? "grid-cols-2" : "grid-cols-1"
                                  } md:inline-grid`}
                                >
                                  {pixPaymentsEnabled && (
                                    <button
                                      type="button"
                                      onClick={() => handleGeneratePix(item.id)}
                                      disabled={generatingPixItemId === item.id}
                                      className="inline-flex min-h-[32px] items-center justify-center rounded-full bg-[#13233a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-white transition hover:bg-[#1d3557] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {generatingPixItemId === item.id ? "..." : "Pix"}
                                    </button>
                                  )}

                                  <a
                                    href={`/area/informar-contribuicao-extra/${item.id}`}
                                    className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] transition hover:bg-[#f7f8fa]"
                                  >
                                    Informar
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Histórico de contribuições extras
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Rateios e cobranças pontuais lançados em seu nome.
                </p>
              </div>

              {items.length === 0 ? (
                <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
                  <p className="font-bold text-[#596579]">
                    Nenhuma contribuição extra lançada até o momento.
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                  <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
                    <div className="col-span-3">Contribuição</div>
                    <div className="col-span-2">Vencimento</div>
                    <div className="col-span-2 text-right">Valor</div>
                    <div className="col-span-2 text-right">Pago/Saldo</div>
                    <div className="col-span-2 text-center">Status</div>
                  </div>

                  <div className="divide-y divide-[#eee7db]">
                    {items.map((item) => {
                      const contribution = getContribution(item);
                      const balance = calculateExtraContributionAmountDue(item).remaining;

                      return (
                        <article
                          key={item.id}
                          className="grid gap-3 px-3 py-3 text-sm md:grid-cols-12 md:items-center"
                        >
                          <div className="md:col-span-4">
                            <p className="font-black text-[#13233a]">
                              {contribution?.title ?? "Contribuição extra"}
                            </p>

                            {contribution?.description && (
                              <p className="mt-0.5 text-xs font-bold leading-5 text-[#596579]">
                                {contribution.description}
                              </p>
                            )}
                          </div>

                          <div className="font-bold text-[#596579] md:col-span-2">
                            {formatDate(item.due_date)}
                          </div>

                          <div className="font-black text-[#13233a] md:col-span-2 md:text-right">
                            {formatCurrency(calculateExtraContributionAmountDue(item).totalDue)}
                          </div>

                          <div className="font-bold text-[#596579] md:col-span-2 md:text-right">
                            <p>Pago: {formatCurrency(item.paid_amount)}</p>
                            <p className="text-xs">Saldo: {formatCurrency(balance)}</p>
                          </div>

                          <div className="md:col-span-2 md:text-center">
                            <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                              {statusLabels[item.status] ?? item.status}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ProtectedArea>
  );
}
