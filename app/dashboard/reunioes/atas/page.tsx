"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { registerAuditLog } from "@/lib/audit";

type Meeting = {
  id: string;
  title: string;
  description: string | null;
  meeting_type: string;
  meeting_date: string;
  start_time: string | null;
  location: string | null;
  mode: string;
  status: string;
  ended_at: string | null;
  closing_summary: string | null;
};

type AgendaItem = {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  item_order: number;
  requires_vote: boolean;
  voting_status: string;
};

type VoteOption = {
  id: string;
  agenda_item_id: string;
  option_text: string;
  option_order: number;
};

type Attendance = {
  id: string;
  meeting_id: string;
  associate_id: string | null;
  full_name: string;
  email: string | null;
  confirmed_at: string;
};

type Vote = {
  id: string;
  agenda_item_id: string;
  meeting_id: string;
  associate_id: string | null;
  option_id: string | null;
  vote_value: string | null;
};

type Minute = {
  id: string;
  meeting_id: string;
  draft_text: string | null;
  final_text: string | null;
  ai_generated: boolean;
  status: string;
  generated_at: string | null;
  approved_at: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR");
}

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    encerrada: "Encerrada",
    rascunho: "Rascunho",
    minuta: "Minuta",
    final: "Final",
    presencial: "Presencial",
    online: "Online",
    hibrida: "Híbrida",
    reuniao_geral: "Reunião geral",
    diretoria: "Diretoria",
    assembleia: "Assembleia",
    comissao: "Comissão",
    finalizada: "Finalizada",
    fechada: "Fechada",
    aberta: "Aberta",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function normalizeNullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function AtasReunioesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [minutes, setMinutes] = useState<Minute[]>([]);

  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [draftText, setDraftText] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
  );

  const selectedMinute = useMemo(
    () => minutes.find((minute) => minute.meeting_id === selectedMeetingId) ?? null,
    [minutes, selectedMeetingId]
  );

  const selectedAgenda = useMemo(
    () =>
      agendaItems
        .filter((item) => item.meeting_id === selectedMeetingId)
        .sort((a, b) => a.item_order - b.item_order),
    [agendaItems, selectedMeetingId]
  );

  const selectedAttendance = useMemo(
    () => attendance.filter((item) => item.meeting_id === selectedMeetingId),
    [attendance, selectedMeetingId]
  );

  useEffect(() => {
    if (selectedMinute?.final_text) {
      setDraftText(selectedMinute.final_text);
      return;
    }

    if (selectedMinute?.draft_text) {
      setDraftText(selectedMinute.draft_text);
      return;
    }

    setDraftText("");
    setAdditionalInfo("");
  }, [selectedMinute, selectedMeetingId]);

  async function loadData() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const meetingsResult = await supabase
      .from("meetings")
      .select(
        "id, title, description, meeting_type, meeting_date, start_time, location, mode, status, ended_at, closing_summary"
      )
      .eq("status", "encerrada")
      .order("meeting_date", { ascending: false });

    if (meetingsResult.error) {
      console.error(meetingsResult.error);
      setErrorMessage("Não foi possível carregar as reuniões encerradas.");
      setLoading(false);
      return;
    }

    const loadedMeetings = (meetingsResult.data as Meeting[]) ?? [];
    const meetingIds = loadedMeetings.map((meeting) => meeting.id);

    setMeetings(loadedMeetings);

    if (meetingIds.length === 0) {
      setAgendaItems([]);
      setVoteOptions([]);
      setAttendance([]);
      setVotes([]);
      setMinutes([]);
      setSelectedMeetingId("");
      setLoading(false);
      return;
    }

    const [agendaResult, attendanceResult, votesResult, minutesResult] =
      await Promise.all([
        supabase
          .from("meeting_agenda_items")
          .select(
            "id, meeting_id, title, description, item_order, requires_vote, voting_status"
          )
          .in("meeting_id", meetingIds)
          .order("item_order", { ascending: true }),
        supabase
          .from("meeting_attendance")
          .select("id, meeting_id, associate_id, full_name, email, confirmed_at")
          .in("meeting_id", meetingIds)
          .order("confirmed_at", { ascending: true }),
        supabase
          .from("meeting_votes")
          .select("id, agenda_item_id, meeting_id, associate_id, option_id, vote_value")
          .in("meeting_id", meetingIds),
        supabase
          .from("meeting_minutes")
          .select(
            "id, meeting_id, draft_text, final_text, ai_generated, status, generated_at, approved_at"
          )
          .in("meeting_id", meetingIds),
      ]);

    if (agendaResult.error) {
      console.error(agendaResult.error);
      setErrorMessage("Não foi possível carregar as pautas.");
      setLoading(false);
      return;
    }

    if (attendanceResult.error) {
      console.error(attendanceResult.error);
      setErrorMessage("Não foi possível carregar as presenças.");
      setLoading(false);
      return;
    }

    if (votesResult.error) {
      console.error(votesResult.error);
      setErrorMessage("Não foi possível carregar os votos.");
      setLoading(false);
      return;
    }

    if (minutesResult.error) {
      console.error(minutesResult.error);
      setErrorMessage("Não foi possível carregar as atas.");
      setLoading(false);
      return;
    }

    const loadedAgenda = (agendaResult.data as AgendaItem[]) ?? [];
    const agendaIds = loadedAgenda.map((item) => item.id);

    let loadedOptions: VoteOption[] = [];

    if (agendaIds.length > 0) {
      const optionsResult = await supabase
        .from("meeting_vote_options")
        .select("id, agenda_item_id, option_text, option_order")
        .in("agenda_item_id", agendaIds)
        .order("option_order", { ascending: true });

      if (optionsResult.error) {
        console.error(optionsResult.error);
        setErrorMessage("Não foi possível carregar as alternativas.");
        setLoading(false);
        return;
      }

      loadedOptions = (optionsResult.data as VoteOption[]) ?? [];
    }

    setAgendaItems(loadedAgenda);
    setVoteOptions(loadedOptions);
    setAttendance((attendanceResult.data as Attendance[]) ?? []);
    setVotes((votesResult.data as Vote[]) ?? []);
    setMinutes((minutesResult.data as Minute[]) ?? []);

    if (!selectedMeetingId && loadedMeetings.length > 0) {
      setSelectedMeetingId(loadedMeetings[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getOptionsForAgenda(agendaItemId: string) {
    return voteOptions
      .filter((option) => option.agenda_item_id === agendaItemId)
      .sort((a, b) => a.option_order - b.option_order);
  }

  function getVotesForAgenda(agendaItemId: string) {
    return votes.filter((vote) => vote.agenda_item_id === agendaItemId);
  }

  function getOptionVoteCount(optionId: string) {
    return votes.filter((vote) => vote.option_id === optionId).length;
  }

  function getWinningOptionText(agendaItemId: string) {
    const options = getOptionsForAgenda(agendaItemId);

    if (options.length === 0) {
      return "sem alternativas registradas";
    }

    const ranked = options
      .map((option) => ({
        option,
        total: getOptionVoteCount(option.id),
      }))
      .sort((a, b) => b.total - a.total);

    const winner = ranked[0];

    if (!winner || winner.total === 0) {
      return "sem votos registrados";
    }

    return `${winner.option.option_text}, com ${winner.total} voto(s)`;
  }

  async function generateMinuteText() {
    if (!selectedMeeting) {
      setErrorMessage("Selecione uma reunião encerrada.");
      return;
    }

    if (selectedMeeting.status !== "encerrada") {
      setErrorMessage("A minuta de ata só pode ser gerada para reunião encerrada.");
      return;
    }

    setWorking(true);
    setErrorMessage("");
    setMessage("Gerando minuta com IA...");

    const agendaPayload = selectedAgenda.map((item) => {
      const options = getOptionsForAgenda(item.id);
      const optionResults = options.map((option) => ({
        option_text: option.option_text,
        votes: getOptionVoteCount(option.id),
      }));

      const sortedResults = [...optionResults].sort((a, b) => b.votes - a.votes);
      const winner =
        sortedResults.length > 0 && sortedResults[0].votes > 0
          ? sortedResults[0]
          : null;

      return {
        item_order: item.item_order,
        title: item.title,
        description: item.description,
        requires_vote: item.requires_vote,
        voting_status: item.voting_status,
        total_votes: getVotesForAgenda(item.id).length,
        winning_option: winner
          ? `${winner.option_text}, com ${winner.votes} voto(s)`
          : "sem voto registrado",
        options: optionResults,
      };
    });

    const response = await fetch("/api/ia/gerar-ata-reuniao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meeting: selectedMeeting,
        attendance: selectedAttendance,
        agendaItems: agendaPayload,
        additionalInfo,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setErrorMessage(result.error || "Não foi possível gerar a ata com IA.");
      setMessage("");
      setWorking(false);
      return;
    }

    setDraftText(result.minuteText || "");
    setMessage("Minuta gerada com IA. Revise o texto antes de salvar.");
    setWorking(false);
  }

  async function saveMinute(status: "minuta" | "final") {
    if (!selectedMeeting) {
      setErrorMessage("Selecione uma reunião.");
      return;
    }

    if (!draftText.trim()) {
      setErrorMessage("A ata/minuta não pode ser salva vazia.");
      return;
    }

    setWorking(true);
    setErrorMessage("");
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const existing = selectedMinute;

    const payload =
      status === "final"
        ? {
            final_text: draftText.trim(),
            status: "final",
            approved_at: new Date().toISOString(),
            approved_by: user?.id ?? null,
          }
        : {
            draft_text: draftText.trim(),
            ai_generated: true,
            status: "minuta",
            generated_at: existing?.generated_at ?? new Date().toISOString(),
          };

    let savedMinute: Minute | null = null;

    if (existing) {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .update(payload)
        .eq("id", existing.id)
        .select(
          "id, meeting_id, draft_text, final_text, ai_generated, status, generated_at, approved_at"
        )
        .single();

      if (error) {
        console.error(error);
        setErrorMessage("Não foi possível salvar a ata.");
        setWorking(false);
        return;
      }

      savedMinute = data as Minute;
    } else {
      const insertPayload = {
        meeting_id: selectedMeeting.id,
        draft_text: status === "minuta" ? draftText.trim() : null,
        final_text: status === "final" ? draftText.trim() : null,
        ai_generated: status === "minuta",
        status,
        generated_at: status === "minuta" ? new Date().toISOString() : null,
        approved_at: status === "final" ? new Date().toISOString() : null,
        approved_by: status === "final" ? user?.id ?? null : null,
      };

      const { data, error } = await supabase
        .from("meeting_minutes")
        .insert(insertPayload)
        .select(
          "id, meeting_id, draft_text, final_text, ai_generated, status, generated_at, approved_at"
        )
        .single();

      if (error) {
        console.error(error);
        setErrorMessage("Não foi possível salvar a ata.");
        setWorking(false);
        return;
      }

      savedMinute = data as Minute;
    }

    if (savedMinute) {
      setMinutes((current) => {
        const exists = current.some((item) => item.id === savedMinute?.id);

        if (exists) {
          return current.map((item) =>
            item.id === savedMinute?.id ? savedMinute : item
          );
        }

        return [...current, savedMinute as Minute];
      });
    }

    await registerAuditLog({
      supabase,
      action: status === "final" ? "save_final_meeting_minutes" : "save_draft_meeting_minutes",
      module: "reunioes",
      tableName: "meeting_minutes",
      recordId: savedMinute?.id ?? selectedMeeting.id,
      description:
        status === "final"
          ? `Salvou ata final da reunião ${selectedMeeting.title}.`
          : `Salvou minuta da reunião ${selectedMeeting.title}.`,
      newData: {
        meeting_id: selectedMeeting.id,
        status,
      },
    });

    setMessage(status === "final" ? "Ata final salva." : "Minuta salva.");
    setWorking(false);
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Atas
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Atas das reuniões
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/75">
                Gere minuta somente após o encerramento da reunião, complemente,
                revise e salve a versão final.
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

        {loading ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">
              Carregando reuniões encerradas...
            </p>
          </section>
        ) : meetings.length === 0 ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#13233a]">
              Nenhuma reunião encerrada
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-[#596579]">
              A geração de ata só fica disponível depois que uma reunião é
              encerrada definitivamente.
            </p>
          </section>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[340px_1fr]">
            <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[#13233a]">
                    Reuniões encerradas
                  </h2>
                  <p className="text-xs font-bold text-[#596579]">
                    Selecione uma reunião.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadData}
                  className="rounded-full border border-[#e8dccb] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]"
                >
                  Atualizar
                </button>
              </div>

              <div className="mt-3 grid gap-1.5">
                {meetings.map((meeting) => {
                  const minute = minutes.find(
                    (item) => item.meeting_id === meeting.id
                  );

                  return (
                    <button
                      key={meeting.id}
                      type="button"
                      onClick={() => setSelectedMeetingId(meeting.id)}
                      className={`rounded-lg border px-3 py-2 text-left ${
                        selectedMeetingId === meeting.id
                          ? "border-[#c7a56b] bg-[#fff9ef]"
                          : "border-[#e8dccb] bg-white hover:bg-[#f7f8fa]"
                      }`}
                    >
                      <p className="text-sm font-black leading-5 text-[#13233a]">
                        {meeting.title}
                      </p>

                      <p className="mt-1 text-[11px] font-bold leading-4 text-[#596579]">
                        {formatDate(meeting.meeting_date)}
                        {meeting.start_time
                          ? ` às ${meeting.start_time.slice(0, 5)}`
                          : ""}{" "}
                        • Ata: {minute ? formatStatus(minute.status) : "Pendente"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedMeeting && (
              <section className="space-y-4">
                <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                        Reunião selecionada
                      </p>

                      <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                        {selectedMeeting.title}
                      </h2>

                      <p className="mt-1 text-sm font-semibold leading-6 text-[#596579]">
                        {formatDate(selectedMeeting.meeting_date)}
                        {selectedMeeting.start_time
                          ? ` às ${selectedMeeting.start_time.slice(0, 5)}`
                          : ""}{" "}
                        • {selectedMeeting.location || "Local não informado"} •{" "}
                        Encerrada em {formatDateTime(selectedMeeting.ended_at)}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                      Ata: {selectedMinute ? formatStatus(selectedMinute.status) : "Pendente"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-xl border border-[#e8dccb] bg-[#fdfcf9] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                        Presenças
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#13233a]">
                        {selectedAttendance.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#e8dccb] bg-[#fdfcf9] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                        Pautas
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#13233a]">
                        {selectedAgenda.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#e8dccb] bg-[#fdfcf9] p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#596579]">
                        Votos
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#13233a]">
                        {votes.filter((vote) => vote.meeting_id === selectedMeeting.id).length}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <h2 className="text-base font-black text-[#13233a]">
                    Informações complementares para a ata
                  </h2>

                  <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                    Use este campo para incluir detalhes que o sistema não captou,
                    como debates, observações, justificativas, encaminhamentos ou
                    falas relevantes.
                  </p>

                  <textarea
                    value={additionalInfo}
                    onChange={(event) => setAdditionalInfo(event.target.value)}
                    rows={4}
                    placeholder="Ex.: A Diretoria destacou que os valores deverão ser confirmados antes da campanha..."
                    className="mt-3 w-full resize-none rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />

                  <button
                    type="button"
                    onClick={generateMinuteText}
                    disabled={working}
                    className="mt-3 rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Gerando..." : "Gerar minuta com IA"}
                  </button>
                </section>

                <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-base font-black text-[#13233a]">
                        Minuta / Ata
                      </h2>

                      <p className="text-xs font-bold text-[#596579]">
                        Revise o texto antes de salvar. A ata final deve ser
                        conferida pela Diretoria/Secretaria.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveMinute("minuta")}
                        disabled={working || !draftText.trim()}
                        className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Salvar minuta
                      </button>

                      <button
                        type="button"
                        onClick={() => saveMinute("final")}
                        disabled={working || !draftText.trim()}
                        className="rounded-full bg-[#13233a] px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Salvar ata final
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={draftText}
                    onChange={(event) => setDraftText(event.target.value)}
                    rows={22}
                    placeholder="A minuta gerada aparecerá aqui..."
                    className="mt-4 w-full resize-y rounded-lg border border-[#e8dccb] bg-[#fdfcf9] px-4 py-3 font-mono text-sm leading-6 text-[#13233a] outline-none focus:border-[#c7a56b]"
                  />
                </section>
              </section>
            )}
          </div>
        )}
      </div>
    </ProtectedDashboard>
  );
}
