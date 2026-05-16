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
  review_notes: string | null;
  created_at: string;
};

type Associate = {
  id: string;
  status: string;
  financial_status: string;
};

function formatStatus(value?: string | null) {
  if (!value) return "Nenhuma solicitação enviada";

  const labels: Record<string, string> = {
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

  return labels[value] || value.replaceAll("_", " ");
}

export default function AreaPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [request, setRequest] = useState<MembershipRequest | null>(null);
  const [associate, setAssociate] = useState<Associate | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("user_id", user.id)
        .single();

      setProfile(profileData);

      if (profileData) {
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
      }

      setLoading(false);
    }

    loadData();
  }, []);

  return (
    <ProtectedArea>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Minha área
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Olá, {profile?.full_name || "usuário"}
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Acompanhe sua solicitação, documentos, avisos e informações da sua
          participação na AAD Direito 2028.
        </p>
      </div>

      {loading ? (
        <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
          <p className="font-bold text-[#596579]">Carregando informações...</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">
                Situação da solicitação
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {formatStatus(request?.status)}
              </p>
            </div>

            <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">
                Situação como associado
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {associate && (!request || request.status === "aprovada")
                  ? formatStatus(associate.status)
                  : "Ainda não associado"}
              </p>
            </div>

            <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">
                Situação financeira
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]">
                {associate && (!request || request.status === "aprovada")
                  ? formatStatus(associate.financial_status)
                  : "Não disponível"}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em]">
                Solicitação de associação
              </h2>

              {request ? (
                <div className="mt-4">
                  <p className="leading-7 text-[#596579]">
                    Sua solicitação está com status:
                    <strong className="text-[#13233a]">
                      {" "}
                      {formatStatus(request.status)}
                    </strong>
                    .
                  </p>

                  {request.review_notes && (
                    <div className="mt-5 rounded-2xl bg-[#fffaf1] p-5 text-sm leading-6 text-[#596579]">
                      <strong className="text-[#13233a]">
                        Análise da Associação:
                      </strong>{" "}
                      {request.review_notes}
                    </div>
                  )}

                  {(request.status === "com_pendencia" ||
                    request.status === "pendente") && (
                    <Link
                      href="/area/solicitacao"
                      className="mt-6 inline-flex rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white"
                    >
                      Ver ou corrigir solicitação
                    </Link>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <p className="leading-7 text-[#596579]">
                    Você ainda não enviou uma solicitação de associação.
                    Preencha a ficha para que a Diretoria/Secretaria possa
                    analisar seu pedido.
                  </p>

                  <Link
                    href="/area/solicitacao"
                    className="mt-6 inline-flex rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white"
                  >
                    Preencher solicitação
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-[-0.04em]">
                Avisos importantes
              </h2>

              <div className="mt-4 rounded-2xl bg-[#f7f8fa] p-5 text-sm leading-6 text-[#596579]">
                Nenhum aviso publicado no momento.
              </div>

              <Link
                href="/area/avisos"
                className="mt-6 inline-flex rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#13233a]"
              >
                Ver avisos
              </Link>
            </div>
          </div>
        </>
      )}
    </ProtectedArea>
  );
}
