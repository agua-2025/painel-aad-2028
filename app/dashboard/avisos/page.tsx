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
  convocacao: "Convocação",
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

function getExcerpt(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 95) {
    return normalized;
  }

  return `${normalized.slice(0, 95)}...`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function DashboardAvisosPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
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
      .select(
        "id, title, content, category, target_audience, status, published_at, created_at"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar avisos:", error);
      setMessage("Não foi possível carregar os avisos.");
      setLoading(false);
      return;
    }

    setNotices((data as Notice[]) ?? []);
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
        <section className="rounded-xl bg-[#13233a] p-4 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
            Comunicação
          </p>

          <h1 className="mt-1 text-xl font-black tracking-[-0.03em]">
            Avisos
          </h1>

          <p className="mt-1 text-sm leading-5 text-white/70">
            Cadastre e gerencie comunicados exibidos na área dos usuários.
          </p>
        </section>

        {message && (
          <section className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#596579] shadow-sm">
            {message}
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm"
          >
            <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
              Novo aviso
            </h2>

            <div className="mt-2 grid gap-2.5">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-[#596579]">
                  Título *
                </span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="rounded-lg border border-[#e8dccb] px-3 py-1.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  placeholder="Ex.: Reunião da Associação"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-[#596579]">
                  Conteúdo *
                </span>
                <textarea
                  value={form.content}
                  onChange={(event) =>
                    updateField("content", event.target.value)
                  }
                  rows={4}
                  className="resize-none rounded-lg border border-[#e8dccb] px-3 py-1.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  placeholder="Digite o comunicado que será exibido na área do usuário."
                />
              </label>

              <div className="grid gap-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-[#596579]">
                    Categoria
                  </span>
                  <select
                    value={form.category}
                    onChange={(event) =>
                      updateField("category", event.target.value)
                    }
                    className="rounded-lg border border-[#e8dccb] px-3 py-1.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="geral">Geral</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="assembleia">Assembleia</option>
                    <option value="convocacao">Convocação</option>
                    <option value="evento">Evento</option>
                    <option value="documentos">Documentos</option>
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-[#596579]">
                    Público
                  </span>
                  <select
                    value={form.target_audience}
                    onChange={(event) =>
                      updateField("target_audience", event.target.value)
                    }
                    className="rounded-lg border border-[#e8dccb] px-3 py-1.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="todos">Todos</option>
                    <option value="associados">Associados</option>
                    <option value="interessados">Interessados</option>
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-[#596579]">
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) => updateField("status", event.target.value)}
                    className="rounded-lg border border-[#e8dccb] px-3 py-1.5 text-sm outline-none transition focus:border-[#c7a56b]"
                  >
                    <option value="publicado">Publicado</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-3 rounded-full bg-[#13233a] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Salvando..." : "Publicar aviso"}
            </button>
          </form>

          <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                  Avisos cadastrados
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Conteúdo completo disponível no botão Ver.
                </p>
              </div>

              <button
                type="button"
                onClick={loadNotices}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
              >
                Atualizar
              </button>
            </div>

            {loading ? (
              <div className="mt-3 rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm font-bold text-[#596579]">
                Carregando avisos...
              </div>
            ) : notices.length === 0 ? (
              <div className="mt-3 rounded-lg bg-[#f7f8fa] px-3 py-3 text-sm font-bold text-[#596579]">
                Nenhum aviso cadastrado ainda.
              </div>
            ) : (
              <div className="mt-3 overflow-hidden rounded-lg border border-[#e8dccb]">
                <div className="hidden border-b border-[#eee7db] bg-[#fafafa] px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#596579] xl:grid xl:grid-cols-[minmax(0,1fr)_105px_90px_95px_120px] xl:items-center">
                  <div>Aviso</div>
                  <div>Categoria</div>
                  <div>Público</div>
                  <div className="text-center">Status</div>
                  <div className="text-right">Ações</div>
                </div>

                <div className="divide-y divide-[#eee7db]">
                  {notices.map((notice) => (
                    <article
                      key={notice.id}
                      className="grid gap-2 px-3 py-2 text-sm xl:grid-cols-[minmax(0,1fr)_105px_90px_95px_120px] xl:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black text-[#13233a]">
                          {notice.title}
                        </p>

                        <p className="mt-0.5 truncate text-xs font-semibold leading-4 text-[#596579]">
                          {getExcerpt(notice.content)}
                        </p>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8a94a6]">
                          Criado em {formatDateTime(notice.created_at)}
                        </p>
                      </div>

                      <div className="truncate text-xs font-bold text-[#596579]">
                        {categoryLabels[notice.category] ?? notice.category}
                      </div>

                      <div className="truncate text-xs font-bold text-[#596579]">
                        {audienceLabels[notice.target_audience] ??
                          notice.target_audience}
                      </div>

                      <div className="xl:text-center">
                        <span className="inline-flex rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.06em] text-[#596579]">
                          {statusLabels[notice.status] ?? notice.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 xl:justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedNotice(notice)}
                          className="rounded-full border border-[#e8dccb] bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
                        >
                          Ver
                        </button>

                        {notice.status !== "publicado" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateNoticeStatus(notice.id, "publicado")
                            }
                            className="rounded-full border border-green-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-green-700 hover:bg-green-50"
                          >
                            Publicar
                          </button>
                        )}

                        {notice.status !== "arquivado" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateNoticeStatus(notice.id, "arquivado")
                            }
                            className="rounded-full border border-[#e8dccb] bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa]"
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
          </section>
        </section>

        {selectedNotice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
            <section className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="border-b border-[#e8dccb] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#b28743]">
                      Aviso cadastrado
                    </p>

                    <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                      {selectedNotice.title}
                    </h2>

                    <p className="mt-1 text-xs font-bold text-[#596579]">
                      {categoryLabels[selectedNotice.category] ??
                        selectedNotice.category}{" "}
                      ·{" "}
                      {audienceLabels[selectedNotice.target_audience] ??
                        selectedNotice.target_audience}{" "}
                      ·{" "}
                      {statusLabels[selectedNotice.status] ??
                        selectedNotice.status}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedNotice(null)}
                    className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
                <div className="whitespace-pre-line rounded-xl bg-[#f7f8fa] p-4 text-sm font-semibold leading-6 text-[#13233a]">
                  {selectedNotice.content}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </ProtectedDashboard>
  );
}
