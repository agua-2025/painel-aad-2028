"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  associateId: string;
  associateName: string;
  onCancel: () => void;
  onSuccess: () => Promise<void> | void;
};

export function RegistrarDesligamento({
  associateId,
  associateName,
  onCancel,
  onSuccess,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState("");
  const [documento, setDocumento] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const valido =
    motivo !== "" &&
    data !== "" &&
    data <= new Date().toLocaleDateString("en-CA") &&
    documento.trim().length > 0 &&
    justificativa.trim().length >= 10 &&
    confirmado;

  async function registrar() {
    if (!valido || salvando) return;

    const autorizado = window.confirm(
      `Confirma o desligamento de ${associateName}?\n\n` +
      "A situação cadastral será alterada e o histórico será registrado. " +
      "As obrigações financeiras anteriores serão preservadas."
    );

    if (!autorizado) return;

    setSalvando(true);
    setErro("");

    try {
      const supabase = createClient();

      const { error } = await supabase.rpc(
        "registrar_desligamento_associado",
        {
          p_associate_id: associateId,
          p_motivo: motivo,
          p_data: data,
          p_documento: documento.trim(),
          p_observacoes: justificativa.trim(),
        }
      );

      if (error) throw error;

      await onSuccess();
    } catch (error) {
      console.error("Erro ao registrar desligamento:", error);
      setErro(
        "Não foi possível concluir ou atualizar o registro. " +
        "Confira o histórico antes de tentar novamente."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black text-[#13233a]">
        Registrar desligamento
      </h2>

      <p className="mt-2 text-sm text-[#596579]">
        Associado: <strong>{associateName}</strong>
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm font-bold">Motivo do desligamento</span>
          <select
            value={motivo}
            disabled={salvando}
            onChange={(event) => setMotivo(event.target.value)}
            className="rounded-lg border p-3"
          >
            <option value="">Selecione o motivo</option>
            <option value="voluntario">Desligamento voluntário</option>
            <option value="exclusao_inadimplencia">Exclusão por inadimplência</option>
            <option value="exclusao_outras_causas">
              Exclusão por outras causas estatutárias
            </option>
          </select>
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-bold">Data do desligamento</span>
          <input
            type="date"
            value={data}
            disabled={salvando}
            onChange={(event) => setData(event.target.value)}
            className="rounded-lg border p-3"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-bold">Documento de referência</span>
          <input
            value={documento}
            disabled={salvando}
            onChange={(event) => setDocumento(event.target.value)}
            placeholder="Ex.: Ata da Assembleia Geral"
            className="rounded-lg border p-3"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-bold">Justificativa</span>
          <textarea
            value={justificativa}
            disabled={salvando}
            onChange={(event) => setJustificativa(event.target.value)}
            rows={4}
            className="rounded-lg border p-3"
          />
        </label>

        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          O desligamento não apaga dívidas anteriores nem cancela
          automaticamente mensalidades existentes.
        </p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmado}
            disabled={salvando}
            onChange={(event) => setConfirmado(event.target.checked)}
          />
          <span>
            Confirmo que os dados estão corretos e que existe documento
            que fundamenta o desligamento.
          </span>
        </label>

        {erro && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={registrar}
            disabled={!valido || salvando}
            className="rounded-full bg-[#13233a] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {salvando ? "Registrando..." : "Confirmar desligamento"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={salvando}
            className="rounded-full border px-5 py-2.5 text-sm font-bold"
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
