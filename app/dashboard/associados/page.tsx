"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { useDashboardPermissions } from "@/lib/useDashboardPermissions";
import { registerAuditLog } from "@/lib/audit";

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
  semester: string | null;
  status: string;
  financial_status: string;
  joined_at: string | null;
  notes: string | null;
  created_at: string;
};

const associateStatusOptions = [
  { value: "ativo", label: "Ativo" },
  { value: "pendente", label: "Pendente" },
  { value: "inativo", label: "Inativo" },
  { value: "desligado", label: "Desligado" },
];

const financialStatusOptions = [
  { value: "em_dia", label: "Em dia" },
  { value: "pendente_financeiro", label: "Pendente financeiro" },
  { value: "em_atraso", label: "Em atraso" },
  { value: "inadimplente_grave", label: "Inadimplente grave" },
];

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

function normalizeNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function AssociadosPage() {
  const permissions = useDashboardPermissions("associados");
  const editSectionRef = useRef<HTMLDivElement | null>(null);

  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);
  const [editJustification, setEditJustification] = useState("");

  const [editForm, setEditForm] = useState({
    full_name: "",
    cpf: "",
    rg: "",
    birth_date: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    semester: "",
    status: "ativo",
    financial_status: "em_dia",
    joined_at: "",
    notes: "",
  });

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

  async function loadAssociates() {
    setLoading(true);
    setErrorMessage("");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("associates")
      .select(
        "id, full_name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, semester, status, financial_status, joined_at, notes, created_at"
      )
      .order("full_name", { ascending: true });

    if (error) {
      setErrorMessage("Não foi possível carregar os associados.");
      console.error(error);
      setLoading(false);
      return;
    }

    setAssociates((data as unknown as Associate[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAssociates();
  }, []);

  function updateEditField(field: string, value: string) {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openEditAssociate(associate: Associate) {
    if (!permissions.canUpdate) {
      setErrorMessage("Seu perfil não tem permissão para editar dados de associados.");
      return;
    }

    setEditingAssociate(associate);
    setEditJustification("");
    setErrorMessage("");
    setSuccessMessage("");

    setEditForm({
      full_name: associate.full_name || "",
      cpf: associate.cpf || "",
      rg: associate.rg || "",
      birth_date: associate.birth_date || "",
      phone: associate.phone || "",
      email: associate.email || "",
      address: associate.address || "",
      city: associate.city || "",
      state: associate.state || "",
      zip_code: associate.zip_code || "",
      semester: associate.semester || "",
      status: associate.status || "ativo",
      financial_status: associate.financial_status || "em_dia",
      joined_at: associate.joined_at || "",
      notes: associate.notes || "",
    });
  }

  setTimeout(() => {
  editSectionRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}, 100);

  function closeEditAssociate() {
    setEditingAssociate(null);
    setEditJustification("");
    setEditForm({
      full_name: "",
      cpf: "",
      rg: "",
      birth_date: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      semester: "",
      status: "ativo",
      financial_status: "em_dia",
      joined_at: "",
      notes: "",
    });
  }

  async function saveAssociateChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingAssociate) return;

    if (!permissions.canUpdate) {
      setErrorMessage("Seu perfil não tem permissão para editar dados de associados.");
      return;
    }

    if (!editForm.full_name.trim()) {
      setErrorMessage("Informe o nome completo do associado.");
      return;
    }

    if (editJustification.trim().length < 10) {
      setErrorMessage("Informe uma justificativa mais detalhada para a alteração.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const payload = {
      full_name: editForm.full_name.trim(),
      cpf: normalizeNullableText(editForm.cpf),
      rg: normalizeNullableText(editForm.rg),
      birth_date: editForm.birth_date || null,
      phone: normalizeNullableText(editForm.phone),
      email: normalizeNullableText(editForm.email),
      address: normalizeNullableText(editForm.address),
      city: normalizeNullableText(editForm.city),
      state: normalizeNullableText(editForm.state),
      zip_code: normalizeNullableText(editForm.zip_code),
      semester: normalizeNullableText(editForm.semester),
      status: editForm.status,
      financial_status: editForm.financial_status,
      joined_at: editForm.joined_at || null,
      notes: normalizeNullableText(editForm.notes),
    };

    const oldData = {
      full_name: editingAssociate.full_name,
      cpf: editingAssociate.cpf,
      rg: editingAssociate.rg,
      birth_date: editingAssociate.birth_date,
      phone: editingAssociate.phone,
      email: editingAssociate.email,
      address: editingAssociate.address,
      city: editingAssociate.city,
      state: editingAssociate.state,
      zip_code: editingAssociate.zip_code,
      semester: editingAssociate.semester,
      status: editingAssociate.status,
      financial_status: editingAssociate.financial_status,
      joined_at: editingAssociate.joined_at,
      notes: editingAssociate.notes,
    };

    const { error } = await supabase
      .from("associates")
      .update(payload)
      .eq("id", editingAssociate.id);

    if (error) {
      console.error("Erro ao atualizar associado:", error);
      setErrorMessage("Não foi possível atualizar os dados do associado.");
      setSaving(false);
      return;
    }

    await registerAuditLog({
      supabase,
      action: "update_associate_data",
      module: "associados",
      tableName: "associates",
      recordId: editingAssociate.id,
      description: `Atualizou dados do associado ${editingAssociate.full_name}.`,
      oldData,
      newData: {
        ...payload,
        justification: editJustification.trim(),
      },
    });

    setAssociates((current) =>
      current.map((item) =>
        item.id === editingAssociate.id
          ? {
              ...item,
              ...payload,
            }
          : item
      )
    );

    setSuccessMessage("Dados do associado atualizados com sucesso.");
    setSaving(false);
    closeEditAssociate();
  }

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

        {successMessage && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm">
            <p className="font-bold text-green-800">{successMessage}</p>
          </section>
        )}

        {permissions.isReadOnly && !permissions.loadingPermissions && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 shadow-sm">
            Seu perfil pode consultar associados, mas não pode editar dados cadastrais.
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

        {editingAssociate && (
          <section
            ref={editSectionRef}
            className="scroll-mt-6 rounded-2xl border border-[#e8dccb] bg-white p-3 shadow-sm"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                  Edição administrativa
                </p>

                <h2 className="mt-1 text-base font-black tracking-[-0.03em] text-[#13233a]">
                  Editando {editingAssociate.full_name}
                </h2>

                <p className="mt-1 max-w-4xl text-xs font-medium leading-5 text-[#596579]">
                  Use este formulário apenas para correções administrativas solicitadas pelo associado ou necessárias para manter o cadastro correto.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditAssociate}
                disabled={saving}
                className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={saveAssociateChanges} className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1.5 md:col-span-2">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Nome completo
                  </span>
                  <input
                    value={editForm.full_name}
                    disabled={saving}
                    onChange={(event) => updateEditField("full_name", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    CPF
                  </span>
                  <input
                    value={editForm.cpf}
                    disabled={saving}
                    onChange={(event) => updateEditField("cpf", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    RG
                  </span>
                  <input
                    value={editForm.rg}
                    disabled={saving}
                    onChange={(event) => updateEditField("rg", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Nascimento
                  </span>
                  <input
                    type="date"
                    value={editForm.birth_date}
                    disabled={saving}
                    onChange={(event) => updateEditField("birth_date", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Entrada
                  </span>
                  <input
                    type="date"
                    value={editForm.joined_at}
                    disabled={saving}
                    onChange={(event) => updateEditField("joined_at", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Semestre
                  </span>
                  <input
                    value={editForm.semester}
                    disabled={saving}
                    onChange={(event) => updateEditField("semester", event.target.value)}
                    placeholder="Ex.: 5º semestre"
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    E-mail
                  </span>
                  <input
                    value={editForm.email}
                    disabled={saving}
                    onChange={(event) => updateEditField("email", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Telefone/WhatsApp
                  </span>
                  <input
                    value={editForm.phone}
                    disabled={saving}
                    onChange={(event) => updateEditField("phone", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    CEP
                  </span>
                  <input
                    value={editForm.zip_code}
                    disabled={saving}
                    onChange={(event) => updateEditField("zip_code", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[2fr_1fr_110px]">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Endereço
                  </span>
                  <input
                    value={editForm.address}
                    disabled={saving}
                    onChange={(event) => updateEditField("address", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Cidade
                  </span>
                  <input
                    value={editForm.city}
                    disabled={saving}
                    onChange={(event) => updateEditField("city", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    UF
                  </span>
                  <input
                    value={editForm.state}
                    disabled={saving}
                    onChange={(event) => updateEditField("state", event.target.value.toUpperCase())}
                    maxLength={2}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Status do associado
                  </span>
                  <select
                    value={editForm.status}
                    disabled={saving}
                    onChange={(event) => updateEditField("status", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  >
                    {associateStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-xs font-semibold text-[#13233a]">
                    Situação financeira
                  </span>
                  <select
                    value={editForm.financial_status}
                    disabled={saving}
                    onChange={(event) => updateEditField("financial_status", event.target.value)}
                    className="w-full rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  >
                    {financialStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[#13233a]">
                  Observações internas
                </span>
                <textarea
                  value={editForm.notes}
                  disabled={saving}
                  onChange={(event) => updateEditField("notes", event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-[#13233a]">
                  Justificativa da alteração *
                </span>
                <textarea
                  value={editJustification}
                  disabled={saving}
                  onChange={(event) => setEditJustification(event.target.value)}
                  rows={2}
                  placeholder="Ex.: correção de endereço solicitada pelo associado por WhatsApp."
                  className="w-full resize-none rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 outline-none focus:border-amber-300"
                />
                <span className="text-xs font-bold text-[#596579]">
                  A justificativa será registrada na auditoria com os dados anteriores e novos.
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>

                <button
                  type="button"
                  onClick={closeEditAssociate}
                  disabled={saving}
                  className="rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}

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
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-center">Financeiro</div>
                <div className="col-span-1 text-right">Entrada</div>
                <div className="col-span-1 text-right">Ação</div>
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

                      <p className="mt-0.5 text-xs font-bold text-[#596579]">
                        Semestre: {associate.semester || "Não informado"}
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

                    <div className="lg:col-span-1 lg:text-center">
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

                    <div className="lg:col-span-1 lg:text-right">
                      <button
                        type="button"
                        onClick={() => openEditAssociate(associate)}
                        disabled={permissions.loadingPermissions || !permissions.canUpdate}
                        className="rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a] hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {permissions.canUpdate ? "Editar" : "Ver"}
                      </button>
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
