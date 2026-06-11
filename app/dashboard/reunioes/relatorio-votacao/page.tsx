"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

type Meeting = {
  id: string;
  title: string;
  meeting_date: string;
  start_time: string | null;
  location: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

type AgendaItem = {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  item_order: number;
  requires_vote: boolean;
  voting_status: string | null;
  voting_opens_at: string | null;
  voting_closes_at: string | null;
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
  associate_id: string;
  full_name: string;
  email: string | null;
  confirmed_at: string;
};

type Vote = {
  id: string;
  meeting_id: string;
  agenda_item_id: string;
  associate_id: string;
  option_id: string | null;
  vote_value: string | null;
  voted_at: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toLowerCase();

  const map: Record<string, string> = {
    rascunho: "Rascunho",
    convocada: "Convocada",
    em_andamento: "Em andamento",
    encerrada: "Encerrada",
    cancelada: "Cancelada",
  };

  return map[normalized] ?? status ?? "Não informado";
}

function buildMeetingOptionLabel(meeting: Meeting) {
  const title =
    meeting.title.length > 72 ? `${meeting.title.slice(0, 72)}...` : meeting.title;

  const time = meeting.start_time ? ` às ${meeting.start_time.slice(0, 5)}` : "";

  return `${title} — ${formatDate(meeting.meeting_date)}${time} — ${formatStatus(
    meeting.status
  )}`;
}

export default function VotingReportPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
  );

  const selectedAttendance = useMemo(() => {
    if (!selectedMeeting) return [];

    return attendance
      .filter((item) => item.meeting_id === selectedMeeting.id)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  }, [attendance, selectedMeeting]);

  const selectedAgendaItems = useMemo(() => {
    if (!selectedMeeting) return [];

    return agendaItems
      .filter((item) => item.meeting_id === selectedMeeting.id)
      .sort((a, b) => a.item_order - b.item_order);
  }, [agendaItems, selectedMeeting]);

  const selectedVotes = useMemo(() => {
    if (!selectedMeeting) return [];

    return votes.filter((vote) => vote.meeting_id === selectedMeeting.id);
  }, [votes, selectedMeeting]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const [meetingsResult, agendaResult, optionsResult, attendanceResult, votesResult] =
      await Promise.all([
        supabase
          .from("meetings")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("meeting_agenda_items")
          .select(
            "id, meeting_id, title, description, item_order, requires_vote, voting_status, voting_opens_at, voting_closes_at"
          )
          .order("item_order", { ascending: true }),
        supabase
          .from("meeting_vote_options")
          .select("id, agenda_item_id, option_text, option_order")
          .order("option_order", { ascending: true }),
        supabase
          .from("meeting_attendance")
          .select("id, meeting_id, associate_id, full_name, email, confirmed_at")
          .order("confirmed_at", { ascending: true }),
        supabase
          .from("meeting_votes")
          .select(
            "id, meeting_id, agenda_item_id, associate_id, option_id, vote_value, voted_at"
          )
          .order("voted_at", { ascending: true }),
      ]);

    if (meetingsResult.error) {
      console.error("Erro ao carregar reuniões:", meetingsResult.error);
      setMessage(
        meetingsResult.error.message ||
          "Não foi possível carregar as reuniões."
      );
      setLoading(false);
      return;
    }

    if (agendaResult.error) {
      console.error(agendaResult.error);
      setMessage("Não foi possível carregar as pautas.");
      setLoading(false);
      return;
    }

    if (optionsResult.error) {
      console.error(optionsResult.error);
      setMessage("Não foi possível carregar as alternativas.");
      setLoading(false);
      return;
    }

    if (attendanceResult.error) {
      console.error(attendanceResult.error);
      setMessage("Não foi possível carregar as presenças.");
      setLoading(false);
      return;
    }

    if (votesResult.error) {
      console.error(votesResult.error);
      setMessage("Não foi possível carregar os votos.");
      setLoading(false);
      return;
    }

    const loadedMeetings = (meetingsResult.data as Meeting[]) ?? [];

    setMeetings(loadedMeetings);
    setAgendaItems((agendaResult.data as AgendaItem[]) ?? []);
    setVoteOptions((optionsResult.data as VoteOption[]) ?? []);
    setAttendance((attendanceResult.data as Attendance[]) ?? []);
    setVotes((votesResult.data as Vote[]) ?? []);

    if (!selectedMeetingId && loadedMeetings.length > 0) {
      setSelectedMeetingId(loadedMeetings[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function getOptionsForAgenda(agendaItemId: string) {
    return voteOptions
      .filter((option) => option.agenda_item_id === agendaItemId)
      .sort((a, b) => a.option_order - b.option_order);
  }

  function getVoteForAssociate(agendaItemId: string, associateId: string) {
    return (
      selectedVotes.find(
        (vote) =>
          vote.agenda_item_id === agendaItemId && vote.associate_id === associateId
      ) ?? null
    );
  }

  function getVotesForAgenda(agendaItemId: string) {
    return selectedVotes.filter((vote) => vote.agenda_item_id === agendaItemId);
  }

  function getResultRows(agendaItem: AgendaItem) {
    const options = getOptionsForAgenda(agendaItem.id);
    const agendaVotes = getVotesForAgenda(agendaItem.id);

    return options.map((option) => ({
      option,
      total: agendaVotes.filter((vote) => vote.option_id === option.id).length,
    }));
  }

  function getNoVoteCount(agendaItem: AgendaItem) {
    return selectedAttendance.filter(
      (person) => !getVoteForAssociate(agendaItem.id, person.associate_id)
    ).length;
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-xl bg-[#13233a] p-3 text-white shadow-sm print:bg-white print:p-0 print:text-black print:shadow-none">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-32 shrink-0 overflow-hidden rounded-lg bg-white/95 p-1.5 print:h-10 print:w-28 print:bg-white print:p-0">
              <Image
                src="/brand/aad-login-logo.png"
                alt="AAD Direito 2028"
                fill
                className="object-contain"
                sizes="128px"
                priority
              />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b] print:text-black">
                Relatório interno
              </p>

              <h1 className="mt-1 text-lg font-black tracking-[-0.03em]">
                Relatório de Participação e Votação
              </h1>

              <p className="mt-1 text-xs leading-4 text-white/70 print:text-black">
                Registro administrativo de presenças, votos e horários lançados no sistema.
              </p>
            </div>
          </div>
        </section>

        {message && (
          <section className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#596579] shadow-sm print:hidden">
            {message}
          </section>
        )}

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:hidden">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="grid min-w-0 flex-1 gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Reunião
              </span>

              <select
                value={selectedMeetingId}
                onChange={(event) => setSelectedMeetingId(event.target.value)}
                className="w-full min-w-0 truncate rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {buildMeetingOptionLabel(meeting)}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]"
              >
                Atualizar
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                disabled={!selectedMeeting}
                className="rounded-full bg-[#13233a] px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Imprimir
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">
              Carregando relatório...
            </p>
          </section>
        ) : !selectedMeeting ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="font-black text-[#13233a]">Nenhuma reunião encontrada</h2>
            <p className="mt-1 text-sm text-[#596579]">
              Cadastre ou selecione uma reunião para emitir o relatório.
            </p>
          </section>
        ) : (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:border-0 print:p-0 print:shadow-none">
            <div className="border-b border-[#e8dccb] pb-2 print:border-black">
              <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a] print:text-black">
                {selectedMeeting.title}
              </h2>

              <div className="mt-2 grid gap-1 text-xs text-[#596579] sm:grid-cols-2 print:grid-cols-2 print:text-black">
                <p>
                  <strong>Data:</strong> {formatDate(selectedMeeting.meeting_date)}
                </p>
                <p>
                  <strong>Horário previsto:</strong>{" "}
                  {selectedMeeting.start_time
                    ? selectedMeeting.start_time.slice(0, 5)
                    : "Não informado"}
                </p>
                <p>
                  <strong>Modalidade/local:</strong>{" "}
                  {selectedMeeting.location || "Não informado"}
                </p>
                <p>
                  <strong>Status:</strong> {formatStatus(selectedMeeting.status)}
                </p>
                <p>
                  <strong>Início registrado:</strong>{" "}
                  {formatDateTime(selectedMeeting.started_at)}
                </p>
                <p>
                  <strong>Encerramento registrado:</strong>{" "}
                  {formatDateTime(selectedMeeting.ended_at)}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a] print:text-black">
                Associados presentes
              </h3>

              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8dccb] text-xs uppercase tracking-[0.08em] text-[#596579] print:border-black print:text-black">
                      <th className="py-2 pr-3">Associado</th>
                      <th className="py-2 pr-3">E-mail</th>
                      <th className="py-2 pr-3">Presença confirmada em</th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedAttendance.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-3 text-sm font-semibold text-[#596579]"
                        >
                          Nenhuma presença registrada.
                        </td>
                      </tr>
                    ) : (
                      selectedAttendance.map((person) => (
                        <tr
                          key={person.id}
                          className="border-b border-[#f0e6d8] print:border-black"
                        >
                          <td className="py-1 pr-3 font-bold text-[#13233a] print:text-black">
                            {person.full_name}
                          </td>
                          <td className="py-1 pr-3 text-[#596579] print:text-black">
                            {person.email || "Não informado"}
                          </td>
                          <td className="py-1 pr-3 text-[#596579] print:text-black">
                            {formatDateTime(person.confirmed_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a] print:text-black">
                Votações
              </h3>

              {selectedAgendaItems.filter((item) => item.requires_vote).length ===
              0 ? (
                <p className="text-sm font-semibold text-[#596579]">
                  Nenhuma pauta com votação registrada.
                </p>
              ) : (
                selectedAgendaItems
                  .filter((item) => item.requires_vote)
                  .map((agendaItem) => {
                    const resultRows = getResultRows(agendaItem);
                    const agendaVotes = getVotesForAgenda(agendaItem.id);
                    const noVoteCount = getNoVoteCount(agendaItem);

                    return (
                      <article
                        key={agendaItem.id}
                        className="rounded-lg border border-[#e8dccb] p-2 print:border-black"
                      >
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#b28743] print:text-black">
                            Pauta {agendaItem.item_order}
                          </p>

                          <h4 className="mt-0.5 text-sm font-black text-[#13233a] print:text-black">
                            {agendaItem.title}
                          </h4>

                          {agendaItem.description && (
                            <p className="mt-0.5 text-xs leading-4 text-[#596579] print:text-black">
                              {agendaItem.description}
                            </p>
                          )}

                          <p className="mt-1 text-xs font-bold text-[#596579] print:text-black">
                            Total de votos registrados: {agendaVotes.length} ·
                            Presentes sem voto registrado: {noVoteCount}
                          </p>
                        </div>

                        <div className="mt-2 space-y-3">
                          <div>
                            <h5 className="text-xs font-black uppercase tracking-[0.08em] text-[#13233a] print:text-black">
                              Resultado por opção
                            </h5>

                            <div className="mt-2 overflow-x-auto">
                              <table className="min-w-full border-collapse text-left text-xs">
                                <thead>
                                  <tr className="border-b border-[#e8dccb] text-xs uppercase tracking-[0.08em] text-[#596579] print:border-black print:text-black">
                                    <th className="py-2 pr-3">Opção</th>
                                    <th className="py-2 pr-3">Votos</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {resultRows.map((row) => (
                                    <tr
                                      key={row.option.id}
                                      className="border-b border-[#f0e6d8] print:border-black"
                                    >
                                      <td className="py-1 pr-3 font-semibold text-[#13233a] print:text-black">
                                        {row.option.option_text}
                                      </td>
                                      <td className="py-1 pr-3 text-[#596579] print:text-black">
                                        {row.total}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div>
                            <h5 className="text-xs font-black uppercase tracking-[0.08em] text-[#13233a] print:text-black">
                              Voto por associado presente
                            </h5>

                            <div className="mt-2 overflow-x-auto">
                              <table className="min-w-full border-collapse text-left text-xs">
                                <thead>
                                  <tr className="border-b border-[#e8dccb] text-xs uppercase tracking-[0.08em] text-[#596579] print:border-black print:text-black">
                                    <th className="py-2 pr-3">Associado</th>
                                    <th className="py-2 pr-3">Voto</th>
                                    <th className="py-2 pr-3">Registrado em</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {selectedAttendance.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={3}
                                        className="py-3 text-sm font-semibold text-[#596579]"
                                      >
                                        Nenhuma presença registrada.
                                      </td>
                                    </tr>
                                  ) : (
                                    selectedAttendance.map((person) => {
                                      const vote = getVoteForAssociate(
                                        agendaItem.id,
                                        person.associate_id
                                      );

                                      return (
                                        <tr
                                          key={`${agendaItem.id}-${person.associate_id}`}
                                          className="border-b border-[#f0e6d8] print:border-black"
                                        >
                                          <td className="py-1 pr-3 font-semibold text-[#13233a] print:text-black">
                                            {person.full_name}
                                          </td>
                                          <td className="py-1 pr-3 text-[#596579] print:text-black">
                                            {vote?.vote_value || "Não registrado"}
                                          </td>
                                          <td className="py-1 pr-3 text-[#596579] print:text-black">
                                            {vote
                                              ? formatDateTime(vote.voted_at)
                                              : "-"}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
              )}
            </div>

            <p className="mt-4 border-t border-[#e8dccb] pt-2 text-[11px] font-semibold leading-4 text-[#596579] print:border-black print:text-black">
              Relatório emitido com base nos registros eletrônicos de presença e votação existentes no sistema da Associação dos Acadêmicos do Curso de Direito – AAD Direito 2028.
            </p>
          </section>
        )}
      </div>
    </ProtectedDashboard>
  );
}
