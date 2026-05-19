"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

function getFirstName(name?: string | null) {
  if (!name) return "usuário";
  return name.trim().split(" ")[0] || name;
}

export default function AreaPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [request, setRequest] = useState<MembershipRequest | null>(null);
  const [associate, setAssociate] = useState<Associate | null>(null);

  const isActiveAssociate = useMemo(() => {
    return Boolean(associate && (!request || request.status === "aprovada"));
  }, [associate, request]);

  const nextStep = useMemo(() => {
    if (!request) {
      return {
        title: "Envie sua solicitação de associação",
        text: "Preencha a ficha para que a Diretoria/Secretaria possa analisar seu pedido.",
        href: "/area/solicitacao",
        action: "Preencher solicitação",
        tone: "primary",
      };
    }

    if (request.status === "com_pendencia") {
      return {
        title: "Sua solicitação precisa de correção",
        text: "Verifique a observação da Associação e ajuste as informações solicitadas.",
        href: "/area/solicitacao",
        action: "Corrigir solicitação",
        tone: "warning",
      };
    }

    if (request.status === "pendente") {
      return {
        title: "Sua solicitação está em análise",
        text: "Aguarde a conferência da Diretoria/Secretaria. Você pode acompanhar o andamento por aqui.",
        href: "/area/solicitacao",
        action: "Ver solicitação",
        tone: "neutral",
      };
    }

    if (request.status === "rejeitada") {
      return {
        title: "Sua solicitação foi analisada",
        text: "Confira a observação registrada e, se necessário, procure a Diretoria/Secretaria.",
        href: "/area/solicitacao",
        action: "Ver detalhes",
        tone: "danger",
      };
    }

    if (isActiveAssociate) {
      return {
        title: "Sua área de associado está liberada",
        text: "Acompanhe mensalidades, pagamentos, contribuições extras, documentos e avisos da Associação.",
        href: "/area/financeiro",
        action: "Ver financeiro",
        tone: "success",
      };
    }

    return {
      title: "Cadastro em atualização",
      text: "Sua solicitação foi aprovada. Aguarde a liberação completa do cadastro de associado.",
      href: "/area/solicitacao",
      action: "Ver solicitação",
      tone: "neutral",
    };
  }, [request, isActiveAssociate]);

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
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl bg-[#13233a] text-white shadow-xl shadow-slate-900/10">
          <div className="grid gap-6 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Minha área
              </p>

              <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] md:text-4xl">
                Olá, {getFirstName(profile?.full_name)}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                Este é seu espaço para acompanhar sua participação na AAD Direito
                2028, consultar documentos, avisos e, quando liberado, sua situação financeira.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={nextStep.href}
                  className="rounded-full bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
                >
                  {nextStep.action}
                </Link>

                <Link
                  href="/area/avisos"
                  className="rounded-full border border-white/20 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white hover:bg-white/10"
                >
                  Ver avisos
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#c7a56b]">
                Próxima ação
              </p>

              <h2 className="mt-2 text-xl font-black tracking-[-0.04em]">
                {nextStep.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/75">
                {nextStep.text}
              </p>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando informações...</p>
          </section>
        ) : (
          <>
            <section className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
                  Solicitação
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {formatStatus(request?.status)}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
                  Associado
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {isActiveAssociate
                    ? formatStatus(associate?.status)
                    : "Ainda não associado"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#596579]">
                  Financeiro
                </p>

                <p className="mt-2 text-xl font-black tracking-[-0.04em] text-[#13233a]">
                  {isActiveAssociate
                    ? formatStatus(associate?.financial_status)
                    : "Não disponível"}
                </p>
              </div>
            </section>

            {request?.review_notes && (
              <section className="rounded-2xl border border-[#e8dccb] bg-[#fffaf1] p-4 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#b28743]">
                  Análise da Associação
                </p>

                <p className="mt-2 text-sm font-bold leading-6 text-[#596579]">
                  {request.review_notes}
                </p>
              </section>
            )}

            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                    Sua jornada na Associação
                  </h2>

                  <p className="text-xs font-bold text-[#596579]">
                    Etapas principais da sua participação na AAD Direito 2028.
                  </p>
                </div>

                <Link
                  href="/area/solicitacao"
                  className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
                >
                  Ver cadastro
                </Link>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] p-3">
                  <p className="text-sm font-black text-[#13233a]">
                    1. Cadastro
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                    Conta criada e dados básicos registrados.
                  </p>
                </div>

                <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] p-3">
                  <p className="text-sm font-black text-[#13233a]">
                    2. Solicitação
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                    Pedido enviado para análise da Associação.
                  </p>
                </div>

                <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] p-3">
                  <p className="text-sm font-black text-[#13233a]">
                    3. Aprovação
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                    Liberação do vínculo como associado.
                  </p>
                </div>

                <div className="rounded-xl border border-[#e8dccb] bg-[#fcfcfd] p-3">
                  <p className="text-sm font-black text-[#13233a]">
                    4. Acompanhamento
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                    Financeiro, avisos, documentos e participação.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Acesso rápido
                </h2>

                <div className="mt-4 grid gap-2">
                  <Link
                    href="/area/documentos"
                    className="flex items-center justify-between rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-black text-[#13233a] hover:bg-[#f7f8fa]"
                  >
                    Documentos da Associação
                    <span className="text-xs text-[#596579]">Abrir</span>
                  </Link>

                  <Link
                    href="/area/avisos"
                    className="flex items-center justify-between rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-black text-[#13233a] hover:bg-[#f7f8fa]"
                  >
                    Avisos publicados
                    <span className="text-xs text-[#596579]">Abrir</span>
                  </Link>

                  <Link
                    href="/area/suporte"
                    className="flex items-center justify-between rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-black text-[#13233a] hover:bg-[#f7f8fa]"
                  >
                    Falar com a Associação
                    <span className="text-xs text-[#596579]">Abrir</span>
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Área financeira
                </h2>

                {isActiveAssociate ? (
                  <div className="mt-4 grid gap-2">
                    <Link
                      href="/area/financeiro"
                      className="flex items-center justify-between rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-black text-[#13233a] hover:bg-[#f7f8fa]"
                    >
                      Ver situação financeira
                      <span className="text-xs text-[#596579]">Abrir</span>
                    </Link>

                    <Link
                      href="/area/pagamentos"
                      className="flex items-center justify-between rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-black text-[#13233a] hover:bg-[#f7f8fa]"
                    >
                      Histórico de pagamentos
                      <span className="text-xs text-[#596579]">Abrir</span>
                    </Link>

                    <Link
                      href="/area/contribuicoes-extras"
                      className="flex items-center justify-between rounded-xl border border-[#e8dccb] px-3 py-2.5 text-sm font-black text-[#13233a] hover:bg-[#f7f8fa]"
                    >
                      Contribuições extras
                      <span className="text-xs text-[#596579]">Abrir</span>
                    </Link>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4">
                    <p className="text-sm font-bold leading-6 text-[#596579]">
                      As informações financeiras serão liberadas após a aprovação
                      e ativação do cadastro como associado.
                    </p>
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
