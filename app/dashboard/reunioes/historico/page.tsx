"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";

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

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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
    rascunho: "Rascunho",
    convocada: "Convocada",
    em_andamento: "Em andamento",
    encerrada: "Encerrada",
    aberta: "Aberta",
    fechada: "Fechada",
    finalizada: "Finalizada",
    presencial: "Presencial",
    online: "Online",
    hibrida: "Híbrida",
    reuniao_geral: "Reunião geral",
    diretoria: "Diretoria",
    assembleia: "Assembleia",
    comissao: "Comissão",
  };

  return labels[value] || value.replaceAll("_", " ");
}

export default function HistoricoReunioesPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [filters, setFilters] = useState({
    date_from: "",
    date_to: todayISO(),
    status: "encerrada",
    search: "",
  });

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
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

  function updateFilter(field: string, value: string) {
    setFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

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

  async function searchMeetings(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    setLoading(true);
    setMessage("");
    setSelectedMeetingId("");

    const supabase = createClient();

    let query = supabase
      .from("meetings")
      .select(
        "id, title, description, meeting_type, meeting_date, start_time, location, mode, status, ended_at, closing_summary"
      )
      .order("meeting_date", { ascending: false });

    if (filters.status !== "todos") {
      query = query.eq("status", filters.status);
    }

    if (filters.date_from) {
      query = query.gte("meeting_date", filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte("meeting_date", filters.date_to);
    }

    if (filters.search.trim()) {
      query = query.ilike("title", `%${filters.search.trim()}%`);
    }

    const { data: meetingsData, error: meetingsError } = await query;

    if (meetingsError) {
      console.error(meetingsError);
      setMessage("Não foi possível pesquisar as reuniões.");
      setLoading(false);
      return;
    }

    const loadedMeetings = (meetingsData as Meeting[]) ?? [];
    const meetingIds = loadedMeetings.map((meeting) => meeting.id);

    if (meetingIds.length === 0) {
      setMeetings([]);
      setAgendaItems([]);
      setVoteOptions([]);
      setAttendance([]);
      setVotes([]);
      setMessage("Nenhuma reunião encontrada para os filtros informados.");
      setLoading(false);
      return;
    }

    const [agendaResult, attendanceResult, votesResult] = await Promise.all([
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
    ]);

    if (agendaResult.error) {
      console.error(agendaResult.error);
      setMessage("Não foi possível carregar as pautas.");
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
        setMessage("Não foi possível carregar as alternativas.");
        setLoading(false);
        return;
      }

      loadedOptions = (optionsResult.data as VoteOption[]) ?? [];
    }

    let finalMeetings = loadedMeetings;

    if (filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();

      const meetingIdsByAgenda = new Set(
        loadedAgenda
          .filter(
            (item) =>
              item.title.toLowerCase().includes(term) ||
              String(item.description || "").toLowerCase().includes(term)
          )
          .map((item) => item.meeting_id)
      );

      finalMeetings = loadedMeetings.filter(
        (meeting) =>
          meeting.title.toLowerCase().includes(term) ||
          String(meeting.description || "").toLowerCase().includes(term) ||
          meetingIdsByAgenda.has(meeting.id)
      );
    }

    setMeetings(finalMeetings);
    setAgendaItems(loadedAgenda);
    setVoteOptions(loadedOptions);
    setAttendance((attendanceResult.data as Attendance[]) ?? []);
    setVotes((votesResult.data as Vote[]) ?? []);

    if (finalMeetings.length > 0) {
      setSelectedMeetingId(finalMeetings[0].id);
    } else {
      setMessage("Nenhuma reunião encontrada para os filtros informados.");
    }

    setLoading(false);
  }

  useEffect(() => {
    searchMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Consulta
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Histórico e pesquisa
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/75">
                Pesquise reuniões por data, título, pauta, status e consulte os
                registros de presença e votação.
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

        {message && (
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 text-sm font-bold text-[#596579] shadow-sm">
            {message}
          </section>
        )}

        <form
          onSubmit={searchMeetings}
          className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_2fr_auto]">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Data inicial
              </span>
              <input
                type="date"
                value={filters.date_from}
                onChange={(event) => updateFilter("date_from", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Data final
              </span>
              <input
                type="date"
                value={filters.date_to}
                onChange={(event) => updateFilter("date_to", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Status
              </span>
              <select
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                <option value="encerrada">Encerradas</option>
                <option value="convocada">Convocadas</option>
                <option value="em_andamento">Em andamento</option>
                <option value="rascunho">Rascunhos</option>
                <option value="todos">Todos</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Buscar por título ou pauta
              </span>
              <input
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Ex.: mensalidade, campanha, ata..."
                className="rounded-lg border border-[#e8dccb] px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-[#c7a56b]"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Buscando..." : "Pesquisar"}
              </button>
            </div>
          </div>
        </form>

        <div className="grid items-start gap-4 xl:grid-cols-[360px_1fr]">
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-[#13233a]">
              Resultado da pesquisa
            </h2>

            <p className="text-xs font-bold text-[#596579]">
              {meetings.length} reunião(ões) encontrada(s).
            </p>

            <div className="mt-3 grid gap-1.5">
              {meetings.length === 0 ? (
                <p className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm font-bold text-[#596579]">
                  Nenhum registro.
                </p>
              ) : (
                meetings.map((meeting) => (
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
                      • {formatStatus(meeting.status)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          {selectedMeeting ? (
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
                      {formatStatus(selectedMeeting.mode)}
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                    {formatStatus(selectedMeeting.status)}
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
                      Encerramento
                    </p>
                    <p className="mt-1 text-sm font-black leading-5 text-[#13233a]">
                      {selectedMeeting.ended_at
                        ? formatDateTime(selectedMeeting.ended_at)
                        : "Não encerrada"}
                    </p>
                  </div>
                </div>

                {selectedMeeting.closing_summary && (
                  <div className="mt-3 rounded-xl bg-[#f7f8fa] px-3 py-2">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#596579]">
                      Resumo de encerramento
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#13233a]">
                      {selectedMeeting.closing_summary}
                    </p>
                  </div>
                )}

                {selectedMeeting.status === "encerrada" && (
                  <div className="mt-3">
                    <Link
                      href="/dashboard/reunioes/atas"
                      className="inline-flex rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white"
                    >
                      Ver / gerar ata
                    </Link>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <h2 className="text-base font-black text-[#13233a]">
                  Pautas e resultados
                </h2>

                <div className="mt-3 grid gap-3">
                  {selectedAgenda.length === 0 ? (
                    <p className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm font-bold text-[#596579]">
                      Nenhuma pauta cadastrada.
                    </p>
                  ) : (
                    selectedAgenda.map((item) => {
                      const options = getOptionsForAgenda(item.id);
                      const agendaVotes = getVotesForAgenda(item.id);

                      return (
                        <article
                          key={item.id}
                          className="rounded-xl border border-[#e8dccb] bg-[#fdfcf9] p-3"
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b28743]">
                            Pauta {item.item_order}
                          </p>

                          <h3 className="mt-1 text-base font-black text-[#13233a]">
                            {item.title}
                          </h3>

                          {item.description && (
                            <p className="mt-1 text-sm leading-6 text-[#596579]">
                              {item.description}
                            </p>
                          )}

                          {item.requires_vote ? (
                            <div className="mt-3 rounded-xl border border-[#e8dccb] bg-white p-3">
                              <p className="text-xs font-bold text-[#596579]">
                                Votos registrados: {agendaVotes.length} • Votação:{" "}
                                {formatStatus(item.voting_status)}
                              </p>

                              <div className="mt-2 grid gap-2">
                                {options.map((option) => (
                                  <div
                                    key={option.id}
                                    className="flex items-center justify-between rounded-lg bg-[#f7f8fa] px-3 py-2"
                                  >
                                    <span className="text-sm font-bold text-[#13233a]">
                                      {option.option_text}
                                    </span>

                                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                                      {getOptionVoteCount(option.id)} voto(s)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-[#596579]">
                              Pauta sem votação.
                            </p>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <h2 className="text-base font-black text-[#13233a]">
                  Presenças registradas
                </h2>

                <div className="mt-3 grid gap-1.5">
                  {selectedAttendance.length === 0 ? (
                    <p className="rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm font-bold text-[#596579]">
                      Nenhuma presença registrada.
                    </p>
                  ) : (
                    selectedAttendance.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-[#e8dccb] bg-[#fdfcf9] px-3 py-2"
                      >
                        <p className="text-sm font-black text-[#13233a]">
                          {item.full_name}
                        </p>
                        <p className="text-[11px] font-bold text-[#596579]">
                          {item.email || "E-mail não informado"} •{" "}
                          {formatDateTime(item.confirmed_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </section>
          ) : (
            <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-[#596579]">
                Selecione uma reunião para consultar os detalhes.
              </p>
            </section>
          )}
        </div>
      </div>
    </ProtectedDashboard>
  );
}
