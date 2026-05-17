"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
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
  extra_contributions:
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
      }
    | {
        id: string;
        title: string;
        description: string | null;
        reason: string | null;
        status: string;
      }[]
    | null;
};

type PaymentReport = {
  id: string;
  status: string;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  review_notes: string | null;
  created_at: string;
};

const paymentMethodLabels = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "deposito", label: "Depósito" },
  { value: "cartao", label: "Cartão" },
  { value: "outros", label: "Outros" },
];

const statusLabels: Record<string, string> = {
  pendente: "Pendente de análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
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

function getContribution(item: ExtraContributionItem) {
  if (Array.isArray(item.extra_contributions)) {
    return item.extra_contributions[0] ?? null;
  }

  return item.extra_contributions ?? null;
}

function isOpenItem(status: string) {
  return ["pendente", "parcialmente_paga", "atrasada"].includes(status);
}

export default function InformarContribuicaoExtraPage() {
  const params = useParams<{ id: string }>();
  const itemId = params.id;

  const today = new Date().toISOString().slice(0, 10);

  const [associate, setAssociate] = useState<Associate | null>(null);
  const [item, setItem] = useState<ExtraContributionItem | null>(null);
  const [reports, setReports] = useState<PaymentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState({
    amount: "",
    paid_at: today,
    payment_method: "pix",
    reference: "",
    notes: "",
  });

  const balance = useMemo(() => {
    if (!item) return 0;

    return Math.max(
      Number(item.amount ?? 0) - Number(item.paid_amount ?? 0),
      0
    );
  }, [item]);

  const pendingReport = reports.find((report) => report.status === "pendente");

  async function loadData() {
    setLoading(true);
    setMessage("");
    setSuccessMessage("");

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

    if (associateError || !associateData || associateData.status !== "ativo") {
      setMessage("Não foi possível localizar seu cadastro de associado ativo.");
      setLoading(false);
      return;
    }

    setAssociate(associateData);

    const { data: itemData, error: itemError } = await supabase
      .from("extra_contribution_items")
      .select(
        "id, contribution_id, associate_id, amount, paid_amount, due_date, status, notes, extra_contributions(id, title, description, reason, status)"
      )
      .eq("id", itemId)
      .eq("associate_id", associateData.id)
      .maybeSingle();

    if (itemError || !itemData) {
      setMessage("Contribuição extra não localizada para este associado.");
      setLoading(false);
      return;
    }

    const typedItem = itemData as unknown as ExtraContributionItem;
    setItem(typedItem);

    const currentBalance = Math.max(
      Number(typedItem.amount ?? 0) - Number(typedItem.paid_amount ?? 0),
      0
    );

    setForm((previous) => ({
      ...previous,
      amount: currentBalance.toFixed(2),
    }));

    const { data: reportsData, error: reportsError } = await supabase
      .from("payment_reports")
      .select(
        "id, status, amount, paid_at, payment_method, reference, notes, review_notes, created_at"
      )
      .eq("extra_contribution_item_id", itemId)
      .eq("associate_id", associateData.id)
      .order("created_at", { ascending: false });

    if (reportsError) {
      setMessage("Não foi possível carregar os informes desta contribuição extra.");
      setLoading(false);
      return;
    }

    setReports((reportsData as unknown as PaymentReport[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!associate || !item) return;

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    const amount = Number(String(form.amount).replace(",", "."));

    if (!amount || amount <= 0) {
      setMessage("Informe um valor válido para o pagamento.");
      setSaving(false);
      return;
    }

    if (!form.paid_at) {
      setMessage("Informe a data efetiva do pagamento.");
      setSaving(false);
      return;
    }

    if (!isOpenItem(item.status)) {
      setMessage("Esta contribuição extra não está aberta para informe de pagamento.");
      setSaving(false);
      return;
    }

    if (pendingReport) {
      setMessage("Já existe um informe pendente de análise para esta contribuição extra.");
      setSaving(false);
      return;
    }

    const supabase = createClient();

    const { error } = await supabase.from("payment_reports").insert({
      associate_id: associate.id,
      monthly_fee_id: null,
      extra_contribution_item_id: item.id,
      amount,
      paid_at: form.paid_at,
      payment_method: form.payment_method,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
      status: "pendente",
    });

    if (error) {
      setMessage(error.message || "Não foi possível enviar o informe de pagamento.");
      setSaving(false);
      return;
    }

    setSuccessMessage(
      "Informe de pagamento enviado com sucesso. A Tesouraria fará a conferência antes da baixa."
    );

    setSaving(false);
    await loadData();
  }

  const contribution = item ? getContribution(item) : null;

  return (
    <ProtectedArea>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Informar pagamento
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Informe à Tesouraria que você realizou o pagamento de uma contribuição extra.
          </p>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">
              Carregando contribuição extra...
            </p>
          </div>
        ) : message && !item ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>

            <Link
              href="/area/contribuicoes-extras"
              className="mt-4 inline-flex rounded-full bg-[#13233a] px-5 py-2 text-sm font-black text-white"
            >
              Voltar
            </Link>
          </div>
        ) : item ? (
          <>
            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                Vencimento em {formatDate(item.due_date)}
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                {contribution?.title ?? "Contribuição extra"}
              </h2>

              <p className="mt-2 text-sm font-bold text-[#596579]">
                {associate?.full_name}
              </p>

              {contribution?.description && (
                <p className="mt-4 leading-7 text-[#596579]">
                  {contribution.description}
                </p>
              )}

              <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-3">
                <p>
                  <strong>Valor:</strong> {formatCurrency(item.amount)}
                </p>

                <p>
                  <strong>Valor já pago:</strong>{" "}
                  {formatCurrency(item.paid_amount)}
                </p>

                <p>
                  <strong>Saldo:</strong> {formatCurrency(balance)}
                </p>
              </div>

              {contribution?.reason && (
                <p className="mt-4 rounded-2xl bg-[#f7f8fa] p-4 text-sm leading-6 text-[#596579]">
                  <strong>Motivo:</strong> {contribution.reason}
                </p>
              )}
            </section>

            {pendingReport && (
              <p className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 text-sm font-bold text-[#596579]">
                Já existe um informe pendente de análise para esta contribuição extra.
              </p>
            )}

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
                Dados do pagamento
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#596579]">
                Este envio não quita automaticamente a contribuição. A baixa depende de conferência da Tesouraria.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#13233a]">
                      Valor pago
                    </span>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount}
                      disabled={!!pendingReport || saving || !isOpenItem(item.status)}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          amount: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#13233a]">
                      Data do pagamento
                    </span>

                    <input
                      type="date"
                      value={form.paid_at}
                      disabled={!!pendingReport || saving || !isOpenItem(item.status)}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          paid_at: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold text-[#13233a]">
                      Forma
                    </span>

                    <select
                      value={form.payment_method}
                      disabled={!!pendingReport || saving || !isOpenItem(item.status)}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          payment_method: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                    >
                      {paymentMethodLabels.map((method) => (
                        <option key={method.value} value={method.value}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Comprovante/Referência
                  </span>

                  <input
                    type="text"
                    value={form.reference}
                    disabled={!!pendingReport || saving || !isOpenItem(item.status)}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="Ex.: ID do Pix, nome usado no Pix, número do comprovante..."
                    className="w-full rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#13233a]">
                    Observações
                  </span>

                  <textarea
                    value={form.notes}
                    disabled={!!pendingReport || saving || !isOpenItem(item.status)}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Ex.: pagamento feito por terceiro, valor complementar ou observação sobre o comprovante..."
                    className="w-full resize-none rounded-2xl border border-[#e8dccb] px-4 py-3 text-sm font-bold text-[#13233a] outline-none"
                  />
                </label>

                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    type="submit"
                    disabled={
                      !!pendingReport ||
                      saving ||
                      !isOpenItem(item.status) ||
                      balance <= 0
                    }
                    className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Enviando..." : "Enviar informe"}
                  </button>

                  <Link
                    href="/area/contribuicoes-extras"
                    className="rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-[#13233a]"
                  >
                    Voltar
                  </Link>
                </div>
              </form>
            </section>

            {reports.length > 0 && (
              <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                  Informes enviados
                </h2>

                <div className="mt-5 grid gap-3">
                  {reports.map((report) => (
                    <article
                      key={report.id}
                      className="rounded-2xl border border-[#e8dccb] p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-black text-[#13233a]">
                            {formatCurrency(report.amount)} em{" "}
                            {formatDate(report.paid_at)}
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#596579]">
                            {paymentMethodLabels.find(
                              (method) => method.value === report.payment_method
                            )?.label ?? report.payment_method}
                          </p>
                        </div>

                        <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                          {statusLabels[report.status] ?? report.status}
                        </span>
                      </div>

                      {report.reference && (
                        <p className="mt-3 text-sm text-[#596579]">
                          <strong>Referência:</strong> {report.reference}
                        </p>
                      )}

                      {report.review_notes && (
                        <p className="mt-3 rounded-2xl bg-[#f7f8fa] p-3 text-sm text-[#596579]">
                          <strong>Observação da Tesouraria:</strong>{" "}
                          {report.review_notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </ProtectedArea>
  );
}
