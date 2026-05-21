"use client";

import { useEffect, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Notice = {
  id: string;
  title: string;
  content: string;
  category: string;
  target_audience: string;
  status: string;
  published_at: string | null;
  created_at: string;
};

type RoleRow = {
  roles:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

const categoryLabels: Record<string, string> = {
  geral: "Geral",
  financeiro: "Financeiro",
  assembleia: "Assembleia",
  evento: "Evento",
  documentos: "Documentos",
};

function formatDate(value: string | null) {
  if (!value) return "Sem data";

  return new Date(value).toLocaleDateString("pt-BR");
}

export default function AreaAvisosPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadNotices() {
      setLoading(true);
      setMessage("");

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: associate } = await supabase
        .from("associates")
        .select("id, status")
        .eq("email", user.email)
        .maybeSingle();

      const { data: approvedRequest } = await supabase
        .from("membership_requests")
        .select("id, status")
        .or(
          `email.eq.${user.email}${profile?.id ? `,profile_id.eq.${profile.id}` : ""}`
        )
        .eq("status", "aprovada")
        .maybeSingle();

      const { data: roleData } = profile?.id
        ? await supabase
            .from("user_roles")
            .select("roles(name)")
            .eq("profile_id", profile.id)
        : { data: null };

      const roleNames =
        ((roleData as unknown as RoleRow[] | null) ?? [])
          .map((item) => {
            if (Array.isArray(item.roles)) {
              return item.roles[0]?.name;
            }

            return item.roles?.name;
          })
          .filter((name): name is string => Boolean(name)) ?? [];

      const isAssociate =
        associate?.status === "ativo" ||
        approvedRequest?.status === "aprovada" ||
        roleNames.includes("associado");

      const allowedAudiences = isAssociate
        ? ["todos", "associados"]
        : ["todos", "interessados"];

      const { data, error } = await supabase
        .from("notices")
        .select(
          "id, title, content, category, target_audience, status, published_at, created_at"
        )
        .eq("status", "publicado")
        .in("target_audience", allowedAudiences)
        .order("published_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar avisos:", error);
        setMessage("Não foi possível carregar os avisos.");
        setLoading(false);
        return;
      }

      setNotices(data ?? []);
      setLoading(false);
    }

    loadNotices();
  }, []);

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] px-5 py-5 text-white shadow-xl shadow-slate-900/10 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Comunicados
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">
                Avisos
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Acompanhe os comunicados publicados pela Diretoria/Secretaria da
                AAD Direito 2028.
              </p>
            </div>

            <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
              {notices.length} aviso(s)
            </span>
          </div>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white px-4 py-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Carregando avisos...</p>
          </section>
        ) : message ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="text-sm font-bold text-red-700">{message}</p>
          </section>
        ) : notices.length === 0 ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white px-5 py-4 shadow-sm">
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Nenhum aviso publicado no momento.
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#596579]">
              Quando houver comunicados da Diretoria/Secretaria, eles aparecerão
              nesta página.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
            <div className="border-b border-[#e8dccb] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                Publicados
              </p>

              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                Comunicados recentes
              </h2>
            </div>

            <div className="divide-y divide-[#e8dccb]">
              {notices.map((notice) => (
                <article key={notice.id} className="px-5 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#13233a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                          {categoryLabels[notice.category] ?? notice.category}
                        </span>

                        <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                          {formatDate(notice.published_at)}
                        </span>
                      </div>

                      <h3 className="mt-2 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                        {notice.title}
                      </h3>
                    </div>
                  </div>

                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#596579]">
                    {notice.content}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </ProtectedArea>
  );
}
