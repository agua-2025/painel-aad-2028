"use client";

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

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl bg-[#f7f8fa] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#596579]">
        {label}
      </p>

      <p className="mt-2 break-words text-base font-black text-[#13233a]">
        {value || "Não informado"}
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
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Minha área
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Meus dados
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Consulte seus dados cadastrais vinculados à solicitação e à Associação.
        </p>
      </div>

      {errorMessage && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
          <p className="font-bold text-[#596579]">Carregando dados...</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">Perfil</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {formatStatus(profile?.status)}
              </p>
            </div>

            <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">Solicitação</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {request ? formatStatus(request.status) : "Não enviada"}
              </p>
            </div>

            <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">Associado</p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {associate ? formatStatus(associate.status) : "Ainda não associado"}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-black tracking-[-0.04em]">
                  Dados cadastrais
                </h2>

                <p className="mt-2 text-sm font-medium text-[#596579]">
                  Essas informações são usadas para identificação interna e
                  acompanhamento da participação na Associação.
                </p>
              </div>

              <span className="rounded-full bg-[#f7f8fa] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                Somente consulta
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Nome completo" value={mainData?.full_name || profile?.full_name} />
              <Field label="CPF" value={mainData?.cpf} />
              <Field label="RG" value={mainData?.rg} />
              <Field label="Data de nascimento" value={formatDate(mainData?.birth_date)} />
              <Field label="Telefone/WhatsApp" value={mainData?.phone} />
              <Field label="E-mail" value={mainData?.email || profile?.email} />
              <Field label="Endereço" value={mainData?.address} />
              <Field label="Cidade" value={mainData?.city} />
              <Field label="Estado" value={mainData?.state} />
              <Field label="CEP" value={mainData?.zip_code} />
              <Field label="Semestre" value={request?.semester} />
              <Field
                label="Data de ingresso"
                value={associate ? formatDate(associate.joined_at) : "Não disponível"}
              />
            </div>
          </div>

          {request?.review_notes && (
            <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-[#fffaf1] p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em]">
                Análise da Associação
              </h2>

              <p className="mt-3 leading-7 text-[#596579]">
                {request.review_notes}
              </p>
            </div>
          )}

          <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-black tracking-[-0.04em]">
              Precisa alterar algum dado?
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              Por segurança, os dados não podem ser alterados livremente após o
              envio ou aprovação da solicitação. Caso identifique alguma
              informação incorreta, solicite orientação à Secretaria/Diretoria da
              Associação.
            </p>
          </div>
        </>
      )}
    </ProtectedArea>
  );
}
