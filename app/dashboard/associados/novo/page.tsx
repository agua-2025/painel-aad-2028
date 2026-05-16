"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

export default function NovoAssociadoPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    rg: "",
    birth_date: "",
    phone: "",
    email: "",
    address: "",
    city: "Araputanga",
    state: "MT",
    zip_code: "",
    joined_at: "",
    status: "ativo",
    financial_status: "em_dia",
    notes: "",
  });

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setStatusMessage("Salvando associado...");

    const supabase = createClient();

    const payload = {
      full_name: form.full_name.trim(),
      cpf: form.cpf.trim() || null,
      rg: form.rg.trim() || null,
      birth_date: form.birth_date || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || "MT",
      zip_code: form.zip_code.trim() || null,
      joined_at: form.joined_at || null,
      status: form.status,
      financial_status: form.financial_status,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase.from("associates").insert(payload);

    if (error) {
      console.error(error);
      setStatusMessage("Erro ao salvar associado. Verifique os dados e tente novamente.");
      setLoading(false);
      return;
    }

    setStatusMessage("Associado cadastrado com sucesso.");
    router.push("/dashboard/associados");
    router.refresh();
  }

  return (
    <ProtectedDashboard>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Associados
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Novo associado
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Cadastre os dados básicos do associado. Depois poderemos vincular login,
          funções administrativas, mensalidades e histórico financeiro.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:p-6"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold text-[#596579]">Nome completo *</span>
            <input
              type="text"
              value={form.full_name}
              onChange={(event) => updateField("full_name", event.target.value)}
              required
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="Nome completo do associado"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">CPF</span>
            <input
              type="text"
              value={form.cpf}
              onChange={(event) => updateField("cpf", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="000.000.000-00"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">RG</span>
            <input
              type="text"
              value={form.rg}
              onChange={(event) => updateField("rg", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="RG"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Data de nascimento</span>
            <input
              type="date"
              value={form.birth_date}
              onChange={(event) => updateField("birth_date", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Data de ingresso</span>
            <input
              type="date"
              value={form.joined_at}
              onChange={(event) => updateField("joined_at", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Telefone</span>
            <input
              type="text"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="(00) 00000-0000"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="email@exemplo.com"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold text-[#596579]">Endereço</span>
            <input
              type="text"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="Rua, número, bairro"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Cidade</span>
            <input
              type="text"
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="Cidade"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Estado</span>
            <input
              type="text"
              value={form.state}
              onChange={(event) => updateField("state", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="MT"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">CEP</span>
            <input
              type="text"
              value={form.zip_code}
              onChange={(event) => updateField("zip_code", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="00000-000"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Situação do associado</span>
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
            >
              <option value="ativo">Ativo</option>
              <option value="pendente">Pendente</option>
              <option value="suspenso">Suspenso</option>
              <option value="desligado">Desligado</option>
              <option value="reativado">Reativado</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-bold text-[#596579]">Situação financeira</span>
            <select
              value={form.financial_status}
              onChange={(event) => updateField("financial_status", event.target.value)}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
            >
              <option value="em_dia">Em dia</option>
              <option value="pendente">Pendente</option>
              <option value="em_atraso">Em atraso</option>
              <option value="inadimplente_grave">Inadimplente grave</option>
              <option value="em_procedimento_de_desligamento">
                Em procedimento de desligamento
              </option>
              <option value="desligado_por_inadimplencia">
                Desligado por inadimplência
              </option>
              <option value="regularizado">Regularizado</option>
            </select>
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold text-[#596579]">Observações</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
              placeholder="Observações internas, se necessário"
            />
          </label>
        </div>

        {statusMessage && (
          <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
            {statusMessage}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.push("/dashboard/associados")}
            className="rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#13233a]"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Salvando..." : "Salvar associado"}
          </button>
        </div>
      </form>
    </ProtectedDashboard>
  );
}
