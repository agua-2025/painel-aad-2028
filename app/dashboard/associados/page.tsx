"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  status: string;
  financial_status: string;
  joined_at: string | null;
  created_at: string;
};

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    pendente: "Pendente",
    inativo: "Inativo",
    desligado: "Desligado",
    em_dia: "Em dia",
    pendente_financeiro: "Pendente",
    em_atraso: "Em atraso",
    inadimplente_grave: "Inadimplente grave",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const dateOnly = value.includes("T") ? value : value + "T00:00:00";
  const date = new Date(dateOnly);

  if (Number.isNaN(date.getTime())) return "Data não informada";

  return date.toLocaleDateString("pt-BR");
}

export default function AssociadosPage() {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const summary = useMemo(() => {
    const activeCount = associates.filter((item) => item.status === "ativo").length;
    const pendingCount = associates.filter((item) => item.status === "pendente").length;
    const overdueCount = associates.filter(
      (item) =>
        item.financial_status === "em_atraso" ||
        item.financial_status === "inadimplente_grave"
    ).length;

    return {
      total: associates.length,
      activeCount,
      pendingCount,
      overdueCount,
    };
  }, [associates]);

  useEffect(() => {
    async function loadAssociates() {
      setLoading(true);
      setErrorMessage("");

      const supabase = createClient();

      const { data, error } = await supabase
        .from("associates")
        .select(
          "id, full_name, cpf, phone, email, city, state, status, financial_status, joined_at, created_at"
        )
        .order("full_name", { ascending: true });

      if (error) {
        setErrorMessage("Não foi possível carregar os associados.");
        console.error(error);
        setLoading(false);
        return;
      }

      setAssociates(data ?? []);
      setLoading(false);
    }

    loadAssociates();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Módulo
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Associados
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Cadastro, acompanhamento, situação financeira e dados de contato dos associados.
              </p>
            </div>

            <a
              href="/dashboard/associados/novo"
              className="w-fit rounded-full bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Novo associado
            </a>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="font-bold text-red-700">{errorMessage}</p>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Total
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
              {summary.total}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Ativos
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
              {summary.activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Pendentes
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
              {summary.pendingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
              Com atraso
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
              {summary.overdueCount}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Lista de associados
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Consulta geral dos associados cadastrados no sistema.
              </p>
            </div>

            <p className="text-xs font-bold text-[#596579]">
              {associates.length} registro(s)
            </p>
          </div>

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              Carregando associados...
            </div>
          ) : associates.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
              <h3 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Nenhum associado cadastrado ainda
              </h3>

              <p className="mt-1 text-sm leading-6 text-[#596579]">
                O próximo passo será cadastrar o primeiro associado pelo botão “Novo associado”.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] lg:grid">
                <div className="col-span-3">Associado</div>
                <div className="col-span-2">Contato</div>
                <div className="col-span-2">Localidade</div>
                <div className="col-span-2 text-center">Status</div>
                <div className="col-span-2 text-center">Financeiro</div>
                <div className="col-span-1 text-right">Entrada</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {associates.map((associate) => (
                  <article
                    key={associate.id}
                    className="grid gap-3 px-3 py-3 text-sm lg:grid-cols-12 lg:items-center"
                  >
                    <div className="lg:col-span-3">
                      <p className="font-black text-[#13233a]">
                        {associate.full_name}
                      </p>

                      <p className="mt-0.5 text-xs font-bold text-[#596579]">
                        CPF: {associate.cpf || "Não informado"}
                      </p>
                    </div>

                    <div className="text-xs font-bold leading-5 text-[#596579] lg:col-span-2">
                      <p>{associate.email || "E-mail não informado"}</p>
                      <p>{associate.phone || "Telefone não informado"}</p>
                    </div>

                    <div className="text-xs font-bold text-[#596579] lg:col-span-2">
                      {[associate.city, associate.state].filter(Boolean).join(" / ") ||
                        "Cidade não informada"}
                    </div>

                    <div className="lg:col-span-2 lg:text-center">
                      <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                        {formatStatus(associate.status)}
                      </span>
                    </div>

                    <div className="lg:col-span-2 lg:text-center">
                      <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                        {formatStatus(associate.financial_status)}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-[#596579] lg:col-span-1 lg:text-right">
                      {formatDate(associate.joined_at || associate.created_at)}
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
