"use client";

import { useEffect, useState } from "react";
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
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AssociadosPage() {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadAssociates() {
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

  const activeCount = associates.filter((item) => item.status === "ativo").length;
  const pendingCount = associates.filter((item) => item.status === "pendente").length;
  const overdueCount = associates.filter(
    (item) =>
      item.financial_status === "em_atraso" ||
      item.financial_status === "inadimplente_grave"
  ).length;

  return (
    <ProtectedDashboard>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
              Módulo
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
              Associados
            </h1>

            <p className="mt-4 max-w-3xl leading-7 text-white/75">
              Cadastro, acompanhamento, situação financeira, histórico e gestão
              dos associados da AAD Direito 2028.
            </p>
          </div>

          <a
            href="/dashboard/associados/novo"
            className="rounded-full bg-[#c7a56b] px-6 py-3 text-center text-sm font-black uppercase tracking-[0.1em] text-[#13233a] shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5"
          >
            Novo associado
          </a>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Total</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {associates.length}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Ativos</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {activeCount}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Pendentes</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {pendingCount}
          </p>
        </div>

        <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#596579]">Com atraso</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.05em]">
            {overdueCount}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.04em]">
              Lista de associados
            </h2>
            <p className="mt-2 text-sm font-medium text-[#596579]">
              Consulta geral dos associados cadastrados no sistema.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-5 font-bold text-[#596579]">
            Carregando associados...
          </div>
        ) : associates.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-6">
            <h3 className="text-xl font-black tracking-[-0.04em]">
              Nenhum associado cadastrado ainda
            </h3>
            <p className="mt-3 leading-7 text-[#596579]">
              O próximo passo será cadastrar o primeiro associado pelo botão
              “Novo associado”.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#e8dccb]">
            <div className="hidden bg-[#f7f8fa] px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#596579] md:grid md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
              <span>Nome</span>
              <span>Status</span>
              <span>Financeiro</span>
              <span>Contato</span>
            </div>

            <div className="divide-y divide-[#e8dccb]">
              {associates.map((associate) => (
                <div
                  key={associate.id}
                  className="grid gap-4 px-5 py-5 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] md:items-center"
                >
                  <div>
                    <p className="font-black text-[#13233a]">
                      {associate.full_name}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#596579]">
                      {associate.email || "E-mail não informado"}
                    </p>
                  </div>

                  <div>
                    <span className="inline-flex rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                      {formatStatus(associate.status)}
                    </span>
                  </div>

                  <div>
                    <span className="inline-flex rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]">
                      {formatStatus(associate.financial_status)}
                    </span>
                  </div>

                  <div className="text-sm font-medium text-[#596579]">
                    <p>{associate.phone || "Telefone não informado"}</p>
                    <p>
                      {[associate.city, associate.state]
                        .filter(Boolean)
                        .join(" / ") || "Cidade não informada"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedDashboard>
  );
}
