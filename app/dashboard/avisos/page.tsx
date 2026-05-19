"use client";

import { useEffect, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
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

const categoryLabels: Record<string, string> = {
  geral: "Geral",
  financeiro: "Financeiro",
  assembleia: "Assembleia",
  evento: "Evento",
  documentos: "Documentos",
};

const audienceLabels: Record<string, string> = {
  todos: "Todos",
  associados: "Associados",
  interessados: "Interessados",
};

const statusLabels: Record<string, string> = {
  publicado: "Publicado",
  rascunho: "Rascunho",
  arquivado: "Arquivado",
};

export default function DashboardAvisosPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "geral",
    target_audience: "todos",
    status: "publicado",
  });

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function loadNotices() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("notices")
      .select("id, title, content, category, target_audience, status, published_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar avisos:", error);
      setMessage("Não foi possível carregar os avisos.");
      setLoading(false);
      return;
    }

    setNotices(data ?? []);
    setLoading(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim()) {
      setMessage("Informe o título do aviso.");
      return;
    }

    if (!form.content.trim()) {
      setMessage("Informe o conteúdo do aviso.");
      return;
    }

    setSaving(true);
    setMessage("Salvando aviso...");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let profileId: string | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      profileId = profile?.id ?? null;
    }

    const { error } = await supabase.from("notices").insert({
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category,
      target_audience: form.target_audience,
      status: form.status,
      published_at: form.status === "publicado" ? new Date().toISOString() : null,
      created_by: profileId,
    });

    if (error) {
      console.error("Erro ao salvar aviso:", error);
      setMessage(error.message || "Não foi possível salvar o aviso.");
      setSaving(false);
      return;
    }

    setForm({
      title: "",
      content: "",
      category: "geral",
      target_audience: "todos",
      status: "publicado",
    });

    setMessage("Aviso salvo com sucesso.");
    setSaving(false);
    await loadNotices();
  }

  async function updateNoticeStatus(id: string, status: string) {
    setMessage("Atualizando aviso...");

    const supabase = createClient();

    const { error } = await supabase
      .from("notices")
      .update({
        status,
        published_at: status === "publicado" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Erro ao atualizar aviso:", error);
      setMessage(error.message || "Não foi possível atualizar o aviso.");
      return;
    }

    setMessage("Aviso atualizado com sucesso.");
    await loadNotices();
  }

  useEffect(() => {
    loadNotices();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Comunicação
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Avisos
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Cadastre comunicados para os interessados e associados acompanharem pela área pessoal.
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm"
          >
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">Novo aviso</h2>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Título *</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Ex.: Reunião da Associação"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Conteúdo *</span>
                <textarea
                  value={form.content}
                  onChange={(event) => updateField("content", event.target.value)}
                  rows={6}
                  className="resize-none rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Digite o comunicado que será exibido na área do usuário."
                />
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#596579]">Categoria</span>
                  <select
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                    className="rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="geral">Geral</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="assembleia">Assembleia</option>
                    <option value="evento">Evento</option>
                    <option value="documentos">Documentos</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#596579]">Público</span>
                  <select
                    value={form.target_audience}
                    onChange={(event) => updateField("target_audience", event.target.value)}
                    className="rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="todos">Todos</option>
                    <option value="associados">Associados</option>
                    <option value="interessados">Interessados</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-bold text-[#596579]">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value)}
                    className="rounded-xl border border-[#e8dccb] px-3 py-2.5 outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="publicado">Publicado</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </label>
              </div>
            </div>

            {message && (
              <div className="mt-5 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="mt-4 rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Salvando..." : "Publicar aviso"}
            </button>
          </form>

          <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Avisos cadastrados
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Gerencie os comunicados exibidos na área dos interessados e associados.
                </p>
              </div>

              <button
                type="button"
                onClick={loadNotices}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
              >
                Atualizar
              </button>
            </div>

            {loading ? (
              <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
                Carregando avisos...
              </div>
            ) : notices.length === 0 ? (
              <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4 text-sm font-bold text-[#596579]">
                Nenhum aviso cadastrado ainda.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
                <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] xl:grid">
                  <div className="col-span-4">Aviso</div>
                  <div className="col-span-2">Categoria</div>
                  <div className="col-span-2">Público</div>
                  <div className="col-span-2 text-center">Status</div>
                  <div className="col-span-2 text-right">Ação</div>
                </div>

                <div className="divide-y divide-[#eee7db]">
                  {notices.map((notice) => (
                    <article
                      key={notice.id}
                      className="grid gap-3 px-3 py-3 text-sm xl:grid-cols-12 xl:items-start"
                    >
                      <div className="xl:col-span-4">
                        <p className="font-black text-[#13233a]">
                          {notice.title}
                        </p>

                        <p className="mt-1 whitespace-pre-line text-xs font-bold leading-5 text-[#596579]">
                          {notice.content}
                        </p>
                      </div>

                      <div className="font-bold text-[#596579] xl:col-span-2">
                        {categoryLabels[notice.category] ?? notice.category}
                      </div>

                      <div className="font-bold text-[#596579] xl:col-span-2">
                        {audienceLabels[notice.target_audience] ?? notice.target_audience}
                      </div>

                      <div className="xl:col-span-2 xl:text-center">
                        <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                          {statusLabels[notice.status] ?? notice.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:col-span-2 xl:justify-end">
                        {notice.status !== "publicado" && (
                          <button
                            type="button"
                            onClick={() => updateNoticeStatus(notice.id, "publicado")}
                            className="rounded-full border border-green-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-green-700 hover:bg-green-50"
                          >
                            Publicar
                          </button>
                        )}

                        {notice.status !== "arquivado" && (
                          <button
                            type="button"
                            onClick={() => updateNoticeStatus(notice.id, "arquivado")}
                            className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
                          >
                            Arquivar
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </ProtectedDashboard>
  );
}