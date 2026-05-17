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
  .or(`email.eq.${user.email}${profile?.id ? `,profile_id.eq.${profile.id}` : ""}`)
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
        .select("id, title, content, category, target_audience, status, published_at, created_at")
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
      <div className="space-y-6">
        <section className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Comunicados
          </p>

          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] md:text-4xl">
            Avisos
          </h1>

          <p className="mt-3 max-w-3xl leading-7 text-white/75">
            Acompanhe os comunicados publicados pela Diretoria/Secretaria da AAD Direito 2028.
          </p>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando avisos...</p>
          </div>
        ) : message ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="font-bold text-red-700">{message}</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#13233a]">
              Nenhum aviso publicado no momento.
            </h2>

            <p className="mt-3 leading-7 text-[#596579]">
              Quando houver comunicados da Diretoria/Secretaria, eles aparecerão nesta página.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notices.map((notice) => (
              <article
                key={notice.id}
                className="rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#c7a56b]">
                      {categoryLabels[notice.category] ?? notice.category}
                    </p>

                    <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#13233a]">
                      {notice.title}
                    </h2>
                  </div>

                  {notice.published_at && (
                    <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-xs font-bold text-[#596579]">
                      {new Date(notice.published_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>

                <p className="mt-4 whitespace-pre-line leading-7 text-[#596579]">
                  {notice.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </ProtectedArea>
  );
}