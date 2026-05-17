"use client";

import { useEffect, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

type Payment = {
  id: string;
  associate_id: string;
  monthly_fee_id: string | null;
  amount: number;
  paid_at: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  created_at: string;
  monthly_fees:
    | {
        year: number;
        month: number;
        due_date: string;
        total_amount: number;
        paid_amount: number;
        status: string;
      }
    | {
        year: number;
        month: number;
        due_date: string;
        total_amount: number;
        paid_amount: number;
        status: string;
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

const paymentMethodLabels: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  deposito: "Depósito",
  cartao: "Cartão",
  outros: "Outros",
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

function getMonthlyFee(payment: Payment) {
  if (Array.isArray(payment.monthly_fees)) {
    return payment.monthly_fees[0] ?? null;
  }

  return payment.monthly_fees ?? null;
}

function getReferenceLabel(payment: Payment) {
  const monthlyFee = getMonthlyFee(payment);

  if (!monthlyFee) {
    return "Pagamento avulso";
  }

  const monthName = monthNames[Number(monthlyFee.month) - 1];

  return `${monthName} de ${monthlyFee.year}`;
}

export default function AreaPagamentosPage() {
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPayments() {
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
        setMessage("Não foi possível carregar seus dados de pagamento.");
        setLoading(false);
        return;
      }

      if (!associateData || associateData.status !== "ativo") {
        setAssociate(null);
        setPayments([]);
        setLoading(false);
        return;
      }

      setAssociate(associateData);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select(
          "id, associate_id, monthly_fee_id, amount, paid_at, payment_method, reference, notes, created_at, monthly_fees(year, month, due_date, total_amount, paid_amount, status)"
        )
        .eq("associate_id", associateData.id)
        .order("paid_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (paymentsError) {
        console.error("Erro ao carregar pagamentos:", paymentsError);
        setMessage("Não foi possível carregar seu histórico de pagamentos.");
        setLoading(false);
        return;
      }

      setPayments((paymentsData as unknown as Payment[]) ?? []);
      setLoading(false);
    }

    loadPayments();
  }, []);

  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0
  );

  return (
    <ProtectedArea>
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Minha área
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Pagamentos
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Consulte o histórico de pagamentos baixados pela Tesouraria da AAD Direito 2028.
          </p>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando pagamentos...</p>
          </div>
        ) : message ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : !associate ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Histórico de pagamentos indisponível
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              Esta área é liberada para associados ativos. Caso sua associação já tenha sido aprovada, aguarde a atualização do cadastro ou procure a Diretoria/Secretaria.
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-5 md:grid-cols-3">
              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:col-span-2">
                <p className="text-sm font-bold text-[#596579]">Associado</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#13233a]">
                  {associate.full_name}
                </p>
                <p className="mt-1 text-sm font-bold text-[#596579]">
                  {associate.email}
                </p>
              </div>

              <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-[#596579]">Total pago</p>
                <p className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#13233a]">
                  {formatCurrency(totalPaid)}
                </p>
                <p className="mt-1 text-sm font-bold text-[#596579]">
                  Conforme baixas registradas
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Histórico de pagamentos
              </h2>

              <p className="mt-2 text-sm font-medium text-[#596579]">
                Os registros abaixo correspondem aos pagamentos lançados pela Tesouraria.
              </p>

              {payments.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5">
                  <h3 className="text-xl font-black tracking-[-0.04em] text-[#13233a]">
                    Nenhum pagamento registrado
                  </h3>

                  <p className="mt-2 leading-7 text-[#596579]">
                    Quando a Tesouraria registrar pagamentos em seu nome, eles aparecerão nesta página.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3">
                  {payments.map((payment) => {
                    const monthlyFee = getMonthlyFee(payment);

                    return (
                      <article
                        key={payment.id}
                        className="rounded-3xl border border-[#e8dccb] p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                              {getReferenceLabel(payment)}
                            </p>

                            <h3 className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                              {formatCurrency(payment.amount)}
                            </h3>

                            <p className="mt-1 text-sm font-bold text-[#596579]">
                              Pago em {formatDate(payment.paid_at)}
                            </p>
                          </div>

                          {monthlyFee && (
                            <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                              {statusLabels[monthlyFee.status] ?? monthlyFee.status}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-[#596579] md:grid-cols-2">
                          <p>
                            <strong>Forma de pagamento:</strong>{" "}
                            {paymentMethodLabels[payment.payment_method] ??
                              payment.payment_method}
                          </p>

                          <p>
                            <strong>Comprovante/Referência:</strong>{" "}
                            {payment.reference || "Não informado"}
                          </p>

                          {monthlyFee && (
                            <>
                              <p>
                                <strong>Vencimento:</strong>{" "}
                                {formatDate(monthlyFee.due_date)}
                              </p>

                              <p>
                                <strong>Total da mensalidade:</strong>{" "}
                                {formatCurrency(monthlyFee.total_amount)}
                              </p>
                            </>
                          )}
                        </div>

                        {payment.notes && (
                          <p className="mt-4 whitespace-pre-line rounded-2xl bg-[#f7f8fa] p-4 text-sm leading-6 text-[#596579]">
                            {payment.notes}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </ProtectedArea>
  );
}
