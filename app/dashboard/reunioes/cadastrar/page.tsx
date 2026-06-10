"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { registerAuditLog } from "@/lib/audit";

type AgendaDraft = {
  title: string;
  description: string;
  requires_vote: boolean;
  options: string[];
};

const MIN_NOTICE_DAYS = 3;
const VOTING_DURATION_SECONDS = 240;

const meetingTypeOptions = [
  { value: "reuniao_geral", label: "Reunião geral" },
  { value: "diretoria", label: "Diretoria" },
  { value: "assembleia", label: "Assembleia" },
  { value: "comissao", label: "Comissão" },
];

const modeOptions = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "hibrida", label: "Híbrida" },
];

const statusOptions = [
  { value: "rascunho", label: "Rascunho" },
  { value: "convocada", label: "Convocada" },
];

function addDaysISO(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleDateString("pt-BR");
}

function normalizeNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function createEmptyAgendaDraft(): AgendaDraft {
  return {
    title: "",
    description: "",
    requires_vote: true,
    options: ["Sim", "Não", "Abstenção"],
  };
}

export default function CadastrarReuniaoPage() {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [meetingForm, setMeetingForm] = useState({
    title: "",
    description: "",
    meeting_type: "reuniao_geral",
    meeting_date: addDaysISO(MIN_NOTICE_DAYS),
    start_time: "",
    location: "",
    mode: "presencial",
    status: "convocada",
    notes: "",
  });

  const [agendaDrafts, setAgendaDrafts] = useState<AgendaDraft[]>([
    createEmptyAgendaDraft(),
  ]);

  function updateMeetingForm(field: string, value: string) {
    setMeetingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addAgendaDraft() {
    setAgendaDrafts((current) => [...current, createEmptyAgendaDraft()]);
  }

  function removeAgendaDraft(index: number) {
    setAgendaDrafts((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  function updateAgendaDraft(
    agendaIndex: number,
    field: keyof AgendaDraft,
    value: string | boolean | string[]
  ) {
    setAgendaDrafts((current) =>
      current.map((item, index) =>
        index === agendaIndex ? { ...item, [field]: value } : item
      )
    );
  }

  function addOptionDraft(agendaIndex: number) {
    setAgendaDrafts((current) =>
      current.map((agenda, index) =>
        index === agendaIndex
          ? { ...agenda, options: [...agenda.options, ""] }
          : agenda
      )
    );
  }

  function removeOptionDraft(agendaIndex: number, optionIndex: number) {
    setAgendaDrafts((current) =>
      current.map((agenda, index) => {
        if (index !== agendaIndex) return agenda;

        const newOptions = agenda.options.filter(
          (_, currentOptionIndex) => currentOptionIndex !== optionIndex
        );

        return {
          ...agenda,
          options: newOptions.length > 0 ? newOptions : [""],
        };
      })
    );
  }

  function updateOptionDraft(
    agendaIndex: number,
    optionIndex: number,
    value: string
  ) {
    setAgendaDrafts((current) =>
      current.map((agenda, index) => {
        if (index !== agendaIndex) return agenda;

        return {
          ...agenda,
          options: agenda.options.map((option, currentOptionIndex) =>
            currentOptionIndex === optionIndex ? value : option
          ),
        };
      })
    );
  }

  async function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setMessage("");

    if (!meetingForm.title.trim()) {
      setErrorMessage("Informe o título da reunião.");
      return;
    }

    if (!meetingForm.meeting_date) {
      setErrorMessage("Informe a data da reunião.");
      return;
    }

    if (!meetingForm.start_time) {
      setErrorMessage("Informe o horário de início da reunião.");
      return;
    }

    const validAgendas = agendaDrafts
      .map((agenda) => ({
        ...agenda,
        title: agenda.title.trim(),
        description: agenda.description.trim(),
        options: agenda.options.map((option) => option.trim()).filter(Boolean),
      }))
      .filter((agenda) => agenda.title);

    if (validAgendas.length === 0) {
      setErrorMessage("Informe pelo menos uma pauta para a reunião.");
      return;
    }

    const hasVotingAgenda = validAgendas.some((agenda) => agenda.requires_vote);
    const minimumMeetingDate = addDaysISO(MIN_NOTICE_DAYS);

    if (
      (meetingForm.meeting_type === "assembleia" || hasVotingAgenda) &&
      meetingForm.meeting_date < minimumMeetingDate
    ) {
      setErrorMessage(
        `Assembleias e reuniões com votação devem observar antecedência mínima de ${MIN_NOTICE_DAYS} dias. A primeira data permitida é ${formatDate(minimumMeetingDate)}.`
      );
      return;
    }

    const invalidAgenda = validAgendas.find(
      (agenda) => agenda.requires_vote && agenda.options.length < 2
    );

    if (invalidAgenda) {
      setErrorMessage(
        `A pauta "${invalidAgenda.title}" precisa ter pelo menos duas alternativas.`
      );
      return;
    }

    setSaving(true);

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const meetingPayload = {
      title: meetingForm.title.trim(),
      description: normalizeNullableText(meetingForm.description),
      meeting_type: meetingForm.meeting_type,
      meeting_date: meetingForm.meeting_date,
      start_time: meetingForm.start_time,
      location: normalizeNullableText(meetingForm.location),
      mode: meetingForm.mode,
      status: meetingForm.status,
      notes: normalizeNullableText(meetingForm.notes),
      created_by: user?.id ?? null,
    };

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert(meetingPayload)
      .select("id, title")
      .single();

    if (meetingError || !meeting) {
      console.error(meetingError);
      setErrorMessage("Não foi possível criar a reunião.");
      setSaving(false);
      return;
    }

    for (let index = 0; index < validAgendas.length; index += 1) {
      const agenda = validAgendas[index];

      const agendaPayload = {
        meeting_id: meeting.id,
        title: agenda.title,
        description: agenda.description || null,
        item_order: index + 1,
        status: "aberta",
        requires_vote: agenda.requires_vote,
        vote_type: agenda.requires_vote ? "alternativas" : "sem_votacao",
        voting_status: "fechada",
        voting_duration_seconds: VOTING_DURATION_SECONDS,
      };

      const { data: agendaItem, error: agendaError } = await supabase
        .from("meeting_agenda_items")
        .insert(agendaPayload)
        .select("id")
        .single();

      if (agendaError || !agendaItem) {
        console.error(agendaError);
        setErrorMessage(
          "A reunião foi criada, mas ocorreu erro ao cadastrar uma pauta."
        );
        setSaving(false);
        return;
      }

      if (agenda.requires_vote) {
        const optionPayloads = agenda.options.map((option, optionIndex) => ({
          agenda_item_id: agendaItem.id,
          option_text: option,
          option_order: optionIndex + 1,
        }));

        const { error: optionsError } = await supabase
          .from("meeting_vote_options")
          .insert(optionPayloads);

        if (optionsError) {
          console.error(optionsError);
          setErrorMessage(
            "A reunião e a pauta foram criadas, mas ocorreu erro ao cadastrar as alternativas."
          );
          setSaving(false);
          return;
        }
      }
    }

    await registerAuditLog({
      supabase,
      action: "create_meeting_with_agenda",
      module: "reunioes",
      tableName: "meetings",
      recordId: meeting.id,
      description: `Criou a reunião ${meeting.title} com ${validAgendas.length} pauta(s).`,
      newData: {
        meeting: meetingPayload,
        agendaItems: validAgendas,
      },
    });

    setMeetingForm({
      title: "",
      description: "",
      meeting_type: "reuniao_geral",
      meeting_date: addDaysISO(MIN_NOTICE_DAYS),
      start_time: "",
      location: "",
      mode: "presencial",
      status: "convocada",
      notes: "",
    });

    setAgendaDrafts([createEmptyAgendaDraft()]);
    setMessage("Reunião criada com pautas e alternativas.");
    setSaving(false);
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Cadastro
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Cadastrar reunião
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/75">
                Crie a reunião, suas pautas e as alternativas de votação em uma
                única etapa.
              </p>
            </div>

            <Link
              href="/dashboard/reunioes"
              className="w-fit rounded-full border border-white/20 px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white"
            >
              Voltar
            </Link>
          </div>
        </section>

        {errorMessage && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {errorMessage}
          </section>
        )}

        {message && (
          <section className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-bold text-green-800">
            {message}
          </section>
        )}

        <form
          onSubmit={createMeeting}
          className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
            Dados da reunião
          </h2>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1.5 lg:col-span-2">
              <span className="text-xs font-semibold text-[#13233a]">
                Título da reunião *
              </span>
              <input
                value={meetingForm.title}
                disabled={saving}
                onChange={(event) => updateMeetingForm("title", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <label className="grid gap-1.5 lg:col-span-2">
              <span className="text-xs font-semibold text-[#13233a]">
                Descrição
              </span>
              <textarea
                value={meetingForm.description}
                disabled={saving}
                onChange={(event) =>
                  updateMeetingForm("description", event.target.value)
                }
                rows={2}
                className="resize-none rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Tipo
              </span>
              <select
                value={meetingForm.meeting_type}
                disabled={saving}
                onChange={(event) =>
                  updateMeetingForm("meeting_type", event.target.value)
                }
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                {meetingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Formato
              </span>
              <select
                value={meetingForm.mode}
                disabled={saving}
                onChange={(event) => updateMeetingForm("mode", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                {modeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Data *
              </span>
              <input
                type="date"
                value={meetingForm.meeting_date}
                min={addDaysISO(MIN_NOTICE_DAYS)}
                disabled={saving}
                onChange={(event) =>
                  updateMeetingForm("meeting_date", event.target.value)
                }
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
              <span className="text-[11px] font-semibold text-[#596579]">
                Mínimo de {MIN_NOTICE_DAYS} dias para reuniões com votação.
              </span>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Horário de início *
              </span>
              <input
                type="time"
                value={meetingForm.start_time}
                disabled={saving}
                onChange={(event) =>
                  updateMeetingForm("start_time", event.target.value)
                }
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Local ou link
              </span>
              <input
                value={meetingForm.location}
                disabled={saving}
                onChange={(event) => updateMeetingForm("location", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Status inicial
              </span>
              <select
                value={meetingForm.status}
                disabled={saving}
                onChange={(event) => updateMeetingForm("status", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-6 border-t border-[#e8dccb] pt-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                  Pautas e alternativas
                </h2>

                <p className="text-xs font-bold text-[#596579]">
                  Cada reunião pode ter várias pautas, e cada pauta pode ter
                  alternativas próprias.
                </p>
              </div>

              <button
                type="button"
                onClick={addAgendaDraft}
                disabled={saving}
                className="w-fit rounded-full border border-[#c7a56b] px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                + Adicionar pauta
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {agendaDrafts.map((agenda, agendaIndex) => (
                <div
                  key={`agenda-${agendaIndex}`}
                  className="rounded-2xl border border-[#e8dccb] bg-[#fdfcf9] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#b28743]">
                      Pauta {agendaIndex + 1}
                    </p>

                    {agendaDrafts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAgendaDraft(agendaIndex)}
                        disabled={saving}
                        className="text-[10px] font-black uppercase tracking-[0.06em] text-red-600"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-[#13233a]">
                        Título da pauta *
                      </span>
                      <input
                        value={agenda.title}
                        disabled={saving}
                        onChange={(event) =>
                          updateAgendaDraft(agendaIndex, "title", event.target.value)
                        }
                        className="rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                      />
                    </label>

                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-[#13233a]">
                        Descrição da pauta
                      </span>
                      <textarea
                        value={agenda.description}
                        disabled={saving}
                        onChange={(event) =>
                          updateAgendaDraft(
                            agendaIndex,
                            "description",
                            event.target.value
                          )
                        }
                        rows={2}
                        className="resize-none rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                      />
                    </label>

                    <label className="flex items-start gap-2 rounded-xl border border-[#e8dccb] bg-white p-3">
                      <input
                        type="checkbox"
                        checked={agenda.requires_vote}
                        disabled={saving}
                        onChange={(event) =>
                          updateAgendaDraft(
                            agendaIndex,
                            "requires_vote",
                            event.target.checked
                          )
                        }
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-xs font-black text-[#13233a]">
                          Esta pauta terá votação
                        </span>
                        <span className="block text-xs font-semibold leading-5 text-[#596579]">
                          Se marcado, cadastre as alternativas abaixo.
                        </span>
                      </span>
                    </label>

                    {agenda.requires_vote && (
                      <div className="rounded-xl border border-[#e8dccb] bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black text-[#13233a]">
                            Alternativas
                          </p>

                          <button
                            type="button"
                            onClick={() => addOptionDraft(agendaIndex)}
                            disabled={saving}
                            className="rounded-full border border-[#e8dccb] bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a]"
                          >
                            + Alternativa
                          </button>
                        </div>

                        <div className="mt-3 grid gap-2">
                          {agenda.options.map((option, optionIndex) => (
                            <div
                              key={`agenda-${agendaIndex}-option-${optionIndex}`}
                              className="flex gap-2"
                            >
                              <input
                                value={option}
                                disabled={saving}
                                onChange={(event) =>
                                  updateOptionDraft(
                                    agendaIndex,
                                    optionIndex,
                                    event.target.value
                                  )
                                }
                                placeholder={`Alternativa ${optionIndex + 1}`}
                                className="min-w-0 flex-1 rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                              />

                              <button
                                type="button"
                                onClick={() =>
                                  removeOptionDraft(agendaIndex, optionIndex)
                                }
                                disabled={saving}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-600"
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="mt-5 grid gap-1.5">
            <span className="text-xs font-semibold text-[#13233a]">
              Observações internas
            </span>
            <textarea
              value={meetingForm.notes}
              disabled={saving}
              onChange={(event) => updateMeetingForm("notes", event.target.value)}
              rows={2}
              className="resize-none rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
            />
          </label>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/dashboard/reunioes"
              className="rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a]"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Criar reunião"}
            </button>
          </div>
        </form>
      </div>
    </ProtectedDashboard>
  );
}
