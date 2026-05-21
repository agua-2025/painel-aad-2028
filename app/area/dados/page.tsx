"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  semester: string | null;
  review_notes: string | null;
};

type Associate = {
  id: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string;
  financial_status: string;
  joined_at: string | null;
};

function formatStatus(value?: string | null) {
  if (!value) return "Não informado";

  const labels: Record<string, string> = {
    ativo: "Ativo",
    inativo: "Inativo",
    pendente: "Pendente",
    com_pendencia: "Com pendência",
    aprovada: "Aprovada",
    rejeitada: "Rejeitada",
    em_dia: "Em dia",
    em_atraso: "Em atraso",
    inadimplente_grave: "Inadimplente grave",
    suspenso: "Suspenso",
    desligado: "Desligado",
    reativado: "Reativado",
    regularizado: "Regularizado",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const [year, month, day] = value.split("-");

  if (year && month && day) {
    return `${day}/${month}/${year}`;
  }

  return value;
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="border-b border-[#e8dccb] py-3 last:border-b-0">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold leading-6 text-[#13233a]">
        {value || "Não informado"}
      </p>
    </div>
  );
}

function StatusCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#596579]">
        {label}
      </p>

      <p className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
        {value}
      </p>
    </div>
  );
}

export default function AreaDadosPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [request, setRequest] = useState<MembershipRequest | null>(null);
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profileData) {
        setErrorMessage("Não foi possível carregar seus dados.");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: requestData } = await supabase
        .from("membership_requests")
        .select(
          "id, status, full_name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, semester, review_notes"
        )
        .or(`profile_id.eq.${profileData.id},email.eq.${profileData.email}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setRequest(requestData);

      const { data: associateData } = await supabase
        .from("associates")
        .select(
          "id, full_name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, status, financial_status, joined_at"
        )
        .eq("email", profileData.email)
        .maybeSingle();

      setAssociate(associateData);
      setLoading(false);
    }

    loadData();
  }, []);

  const mainData = associate || request;

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] px-5 py-5 text-white shadow-xl shadow-slate-900/10 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Minha área
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">
                Meus dados
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Consulte seus dados cadastrais vinculados à solicitação e à Associação.
              </p>
            </div>

            <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
              Somente consulta
            </span>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {errorMessage}
          </section>
        )}

        {loading ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Carregando dados...</p>
          </section>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <StatusCard label="Perfil" value={formatStatus(profile?.status)} />

              <StatusCard
                label="Solicitação"
                value={request ? formatStatus(request.status) : "Não enviada"}
              />

              <StatusCard
                label="Associado"
                value={associate ? formatStatus(associate.status) : "Ainda não associado"}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
                <div className="border-b border-[#e8dccb] px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                    Cadastro
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                    Dados pessoais
                  </h2>
                </div>

                <div className="px-5">
                  <Field label="Nome completo" value={mainData?.full_name || profile?.full_name} />
                  <Field label="CPF" value={mainData?.cpf} />
                  <Field label="RG" value={mainData?.rg} />
                  <Field label="Data de nascimento" value={formatDate(mainData?.birth_date)} />
                  <Field label="Semestre" value={request?.semester} />
                  <Field
                    label="Data de ingresso"
                    value={associate ? formatDate(associate.joined_at) : "Não disponível"}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <section className="rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
                  <div className="border-b border-[#e8dccb] px-5 py-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                      Contato
                    </p>

                    <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                      Endereço e canais
                    </h2>
                  </div>

                  <div className="px-5">
                    <Field label="Telefone/WhatsApp" value={mainData?.phone} />
                    <Field label="E-mail" value={mainData?.email || profile?.email} />
                    <Field label="Endereço" value={mainData?.address} />
                    <Field label="Cidade" value={mainData?.city} />
                    <Field label="Estado" value={mainData?.state} />
                    <Field label="CEP" value={mainData?.zip_code} />
                  </div>
                </section>

                {request?.review_notes && (
                  <section className="rounded-2xl border border-[#e8dccb] bg-[#fffaf1] px-5 py-4 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                      Análise
                    </p>

                    <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                      Observação da Associação
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-[#596579]">
                      {request.review_notes}
                    </p>
                  </section>
                )}

                <section className="rounded-2xl border border-[#e8dccb] bg-white px-5 py-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                    Atualização
                  </p>

                  <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                    Precisa alterar algum dado?
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#596579]">
                    Por segurança, os dados não podem ser alterados livremente após o envio
                    ou aprovação da solicitação. Caso identifique alguma informação incorreta,
                    solicite orientação à Secretaria/Diretoria.
                  </p>

                  <Link
                    href="/area/suporte"
                    className="mt-4 inline-flex rounded-full bg-[#13233a] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#0c1728]"
                  >
                    Solicitar orientação
                  </Link>
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </ProtectedArea>
  );
}
