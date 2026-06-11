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
  ended_by: string | null;
  closing_summary: string | null;
};

type AgendaItem = {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  item_order: number;
  status: string;
  requires_vote: boolean;
  vote_type: string;
  voting_status: string;
  voting_opens_at: string | null;
  voting_closes_at: string | null;
  voting_duration_seconds: number;
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

const VOTING_DURATION_SECONDS = 240;
const SECOND_CALL_WAIT_MINUTES = 15;

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

function getMeetingStartDate(meeting: Meeting) {
  const time = meeting.start_time ? meeting.start_time.slice(0, 5) : "00:00";
  return new Date(`${meeting.meeting_date}T${time}:00`);
}

function isVotingExpired(agendaItem: AgendaItem) {
  if (agendaItem.voting_status !== "aberta" || !agendaItem.voting_closes_at) {
    return false;
  }

  return new Date(agendaItem.voting_closes_at).getTime() < Date.now();
}

export default function RealizarReuniaoPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [activeAssociatesCount, setActiveAssociatesCount] = useState(0);

  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [closingSummary, setClosingSummary] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
  );

  const selectedMeetingAgenda = useMemo(
    () =>
      agendaItems
        .filter((item) => item.meeting_id === selectedMeetingId)
        .sort((a, b) => a.item_order - b.item_order),
    [agendaItems, selectedMeetingId]
  );

  const selectedMeetingAttendance = useMemo(
    () => attendance.filter((item) => item.meeting_id === selectedMeetingId),
    [attendance, selectedMeetingId]
  );

  async function loadData() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const [
      meetingsResult,
      agendaResult,
      optionsResult,
      attendanceResult,
      votesResult,
      activeCountResult,
    ] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, description, meeting_type, meeting_date, start_time, location, mode, status, ended_at, ended_by, closing_summary"
        )
        .neq("status", "encerrada")
        .order("meeting_date", { ascending: true }),
      supabase
        .from("meeting_agenda_items")
        .select(
          "id, meeting_id, title, description, item_order, status, requires_vote, vote_type, voting_status, voting_opens_at, voting_closes_at, voting_duration_seconds"
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
        .select("id, agenda_item_id, meeting_id, associate_id, option_id, vote_value"),
      supabase
        .from("associates")
        .select("id", { count: "exact", head: true })
        .eq("status", "ativo"),
    ]);

    if (meetingsResult.error) {
      console.error(meetingsResult.error);
      setErrorMessage("Não foi possível carregar as reuniões.");
      setLoading(false);
      return;
    }

    if (agendaResult.error) {
      console.error(agendaResult.error);
      setErrorMessage("Não foi possível carregar as pautas.");
      setLoading(false);
      return;
    }

    if (optionsResult.error) {
      console.error(optionsResult.error);
      setErrorMessage("Não foi possível carregar as alternativas.");
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

    const loadedMeetings = (meetingsResult.data as Meeting[]) ?? [];

    setMeetings(loadedMeetings);
    setAgendaItems((agendaResult.data as AgendaItem[]) ?? []);
    setVoteOptions((optionsResult.data as VoteOption[]) ?? []);
    setAttendance((attendanceResult.data as Attendance[]) ?? []);
    setVotes((votesResult.data as Vote[]) ?? []);
    setActiveAssociatesCount(activeCountResult.count ?? 0);

    if (!selectedMeetingId && loadedMeetings.length > 0) {
      const todayMeeting =
        loadedMeetings.find((meeting) => meeting.meeting_date === todayISO()) ??
        loadedMeetings[0];

      setSelectedMeetingId(todayMeeting.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function getAttendanceCountForMeeting(meetingId: string) {
    return attendance.filter((item) => item.meeting_id === meetingId).length;
  }

  function getQuorumInfo(meeting: Meeting) {
    const totalAssociates = activeAssociatesCount;
    const presentCount = getAttendanceCountForMeeting(meeting.id);
    const requiredFirstCall = Math.floor(totalAssociates / 2) + 1;

    const startDate = getMeetingStartDate(meeting);
    const secondCallDate = new Date(
      startDate.getTime() + SECOND_CALL_WAIT_MINUTES * 60 * 1000
    );

    const now = new Date();
    const beforeStart = now.getTime() < startDate.getTime();
    const secondCallAvailable = now.getTime() >= secondCallDate.getTime();

    const hasFirstCallQuorum =
      totalAssociates > 0 && presentCount >= requiredFirstCall;

    const canStart =
      !beforeStart &&
      (hasFirstCallQuorum || (secondCallAvailable && presentCount > 0));

    let statusText = "Aguardando";
    let detail = "";

    if (beforeStart) {
      statusText = "Aguardando horário";
      detail = `A reunião ainda não pode ser iniciada. A presença e a operação serão liberadas a partir de ${formatDateTime(
        startDate.toISOString()
      )}.`;
    } else if (hasFirstCallQuorum) {
      statusText = "Apta para início";
      detail = `Quórum de primeira chamada atingido: ${presentCount} presença(s) registrada(s), de ${requiredFirstCall} necessária(s).`;
    } else if (secondCallAvailable && presentCount > 0) {
      statusText = "Apta em segunda chamada";
      detail = `Decorridos ${SECOND_CALL_WAIT_MINUTES} minutos do horário previsto, a reunião pode ser iniciada em segunda chamada com os presentes.`;
    } else if (secondCallAvailable && presentCount === 0) {
      statusText = "Aguardando presença";
      detail = "A segunda chamada já está disponível, mas ainda não há presença registrada. Registre ao menos uma presença para iniciar.";
    } else {
      statusText = "Aguardando quórum";
      detail = `Ainda não há quórum de primeira chamada. A reunião ficará liberada em segunda chamada às ${formatDateTime(
        secondCallDate.toISOString()
      )}, com os presentes.`;
    }

    return {
      totalAssociates,
      presentCount,
      requiredFirstCall,
      startDate,
      secondCallDate,
      hasFirstCallQuorum,
      secondCallAvailable,
      canStart,
      statusText,
      detail,
    };
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

  async function startMeeting() {
    if (!selectedMeeting) return;

    if (selectedMeeting.status === "encerrada") {
      setErrorMessage("Esta reunião já foi encerrada.");
      return;
    }

    const quorum = getQuorumInfo(selectedMeeting);

    if (!quorum.canStart) {
      setErrorMessage(quorum.detail);
      return;
    }

    setWorking(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const { error } = await supabase
      .from("meetings")
      .update({ status: "em_andamento" })
      .eq("id", selectedMeeting.id);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível iniciar a reunião.");
      setWorking(false);
      return;
    }

    await registerAuditLog({
      supabase,
      action: "start_meeting",
      module: "reunioes",
      tableName: "meetings",
      recordId: selectedMeeting.id,
      description: `Iniciou a reunião ${selectedMeeting.title}.`,
      oldData: { status: selectedMeeting.status },
      newData: { status: "em_andamento" },
    });

    setMeetings((current) =>
      current.map((meeting) =>
        meeting.id === selectedMeeting.id
          ? { ...meeting, status: "em_andamento" }
          : meeting
      )
    );

    setMessage("Reunião iniciada.");
    setWorking(false);
  }

  async function openVoting(agendaItem: AgendaItem) {
    if (!selectedMeeting) return;

    const quorum = getQuorumInfo(selectedMeeting);

    if (!quorum.canStart || selectedMeeting.status !== "em_andamento") {
      setErrorMessage(
        "A reunião precisa estar em andamento e apta por quórum para abrir votação."
      );
      return;
    }

    setWorking(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const now = new Date();
    const closesAt = new Date(now.getTime() + VOTING_DURATION_SECONDS * 1000);

    const payload = {
      voting_status: "aberta",
      voting_opens_at: now.toISOString(),
      voting_closes_at: closesAt.toISOString(),
      voting_duration_seconds: VOTING_DURATION_SECONDS,
    };

    const { error } = await supabase
      .from("meeting_agenda_items")
      .update(payload)
      .eq("id", agendaItem.id);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível abrir a votação.");
      setWorking(false);
      return;
    }

    await registerAuditLog({
      supabase,
      action: "open_agenda_voting",
      module: "reunioes",
      tableName: "meeting_agenda_items",
      recordId: agendaItem.id,
      description: `Abriu votação da pauta ${agendaItem.title}.`,
      oldData: {
        voting_status: agendaItem.voting_status,
        voting_opens_at: agendaItem.voting_opens_at,
        voting_closes_at: agendaItem.voting_closes_at,
      },
      newData: payload,
    });

    setAgendaItems((current) =>
      current.map((item) =>
        item.id === agendaItem.id ? { ...item, ...payload } : item
      )
    );

    setMessage("Votação aberta por 4 minutos.");
    setWorking(false);
  }

  async function closeVoting(agendaItem: AgendaItem) {
    setWorking(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const payload = {
      voting_status: "finalizada",
      voting_closes_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("meeting_agenda_items")
      .update(payload)
      .eq("id", agendaItem.id);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível encerrar a votação.");
      setWorking(false);
      return;
    }

    await registerAuditLog({
      supabase,
      action: "close_agenda_voting",
      module: "reunioes",
      tableName: "meeting_agenda_items",
      recordId: agendaItem.id,
      description: `Encerrou votação da pauta ${agendaItem.title}.`,
      oldData: {
        voting_status: agendaItem.voting_status,
        voting_closes_at: agendaItem.voting_closes_at,
      },
      newData: payload,
    });

    setAgendaItems((current) =>
      current.map((item) =>
        item.id === agendaItem.id ? { ...item, ...payload } : item
      )
    );

    setMessage("Votação encerrada.");
    setWorking(false);
  }

  async function closeMeeting() {
    if (!selectedMeeting) return;

    const openVotingItems = selectedMeetingAgenda.filter(
      (item) => item.voting_status === "aberta"
    );

    if (openVotingItems.length > 0) {
      setErrorMessage("Antes de encerrar, finalize todas as votações abertas.");
      return;
    }

    const confirmed = window.confirm(
      "Deseja encerrar definitivamente esta reunião?\n\nApós o encerramento, ela irá para o histórico e não poderá ser reaberta."
    );

    if (!confirmed) return;

    setWorking(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      status: "encerrada",
      ended_at: new Date().toISOString(),
      ended_by: user?.id ?? null,
      closing_summary: closingSummary.trim() || null,
    };

    const { error } = await supabase
      .from("meetings")
      .update(payload)
      .eq("id", selectedMeeting.id);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível encerrar a reunião.");
      setWorking(false);
      return;
    }

    await registerAuditLog({
      supabase,
      action: "close_meeting",
      module: "reunioes",
      tableName: "meetings",
      recordId: selectedMeeting.id,
      description: `Encerrou definitivamente a reunião ${selectedMeeting.title}.`,
      oldData: {
        status: selectedMeeting.status,
        ended_at: selectedMeeting.ended_at,
        closing_summary: selectedMeeting.closing_summary,
      },
      newData: payload,
    });

    setMeetings((current) =>
      current.filter((meeting) => meeting.id !== selectedMeeting.id)
    );

    setSelectedMeetingId("");
    setClosingSummary("");
    setMessage("Reunião encerrada e enviada para o histórico.");
    setWorking(false);
  }

  const quorum = selectedMeeting ? getQuorumInfo(selectedMeeting) : null;

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Operação da reunião
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Realizar reunião
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/75">
                Use esta tela no dia da reunião para acompanhar presença, quórum,
                votação e encerramento.
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
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="font-bold text-[#596579]">Carregando reuniões...</p>
          </section>
        ) : meetings.length === 0 ? (
          <section className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#13233a]">
              Nenhuma reunião pendente ou em andamento
            </h2>

            <p className="mt-2 text-sm font-semibold leading-6 text-[#596579]">
              Reuniões encerradas ficam no histórico. Para operar uma reunião,
              ela precisa estar convocada ou em andamento.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-base font-black text-[#13233a]">
                    Reunião para operar
                  </h2>
                  <p className="text-xs font-bold text-[#596579]">
                    Selecione a reunião convocada ou em andamento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadData}
                  className="w-fit rounded-full border border-[#e8dccb] px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]"
                >
                  Atualizar
                </button>
              </div>

              <select
                value={selectedMeetingId}
                onChange={(event) => setSelectedMeetingId(event.target.value)}
                className="mt-3 w-full rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.title} — {formatDate(meeting.meeting_date)}
                    {meeting.start_time ? ` às ${meeting.start_time.slice(0, 5)}` : ""}
                    {" — "}
                    {formatStatus(meeting.status)}
                  </option>
                ))}
              </select>
            </section>

            {selectedMeeting && quorum && (
              <section className="space-y-4">
                <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                        • {selectedMeeting.location || "Local não informado"}
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-[#f7f8fa] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                      {formatStatus(selectedMeeting.status)}
                    </span>
                  </div>

                  <div
                    className={`mt-3 rounded-xl border px-3 py-2 ${
                      quorum.canStart
                        ? "border-green-200 bg-green-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-black text-[#13233a]">
                      <span>Associados ativos: {quorum.totalAssociates}</span>
                      <span>Presentes: {quorum.presentCount}</span>
                      <span>Quórum inicial: {quorum.requiredFirstCall}</span>
                      <span
                        className={
                          quorum.canStart ? "text-green-800" : "text-amber-900"
                        }
                      >
                        Situação: {quorum.statusText}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] font-semibold leading-4 text-[#596579]">
                      {quorum.detail}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startMeeting}
                      disabled={
                        working ||
                        !quorum.canStart ||
                        selectedMeeting.status === "em_andamento"
                      }
                      className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Iniciar reunião
                    </button>

                    <button
                      type="button"
                      onClick={loadData}
                      disabled={working}
                      className="rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] disabled:opacity-50"
                    >
                      Atualizar presença
                    </button>
                  </div>
                </section>

                <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-black text-[#13233a]">
                    Pautas e votações
                  </h2>

                  <div className="mt-4 grid gap-3">
                    {selectedMeetingAgenda.length === 0 ? (
                      <p className="rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
                        Esta reunião não possui pautas cadastradas.
                      </p>
                    ) : (
                      selectedMeetingAgenda.map((item) => {
                        const options = getOptionsForAgenda(item.id);
                        const agendaVotes = getVotesForAgenda(item.id);
                        const expired = isVotingExpired(item);

                        return (
                          <article
                            key={item.id}
                            className="rounded-xl border border-[#e8dccb] bg-[#fdfcf9] p-3"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                                  Pauta {item.item_order}
                                </p>

                                <h3 className="mt-1 text-base font-black tracking-[-0.02em] text-[#13233a]">
                                  {item.title}
                                </h3>

                                {item.description && (
                                  <p className="mt-2 text-sm leading-6 text-[#596579]">
                                    {item.description}
                                  </p>
                                )}
                              </div>

                              <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                                Votação: {formatStatus(item.voting_status)}
                              </span>
                            </div>

                            {item.requires_vote ? (
                              <div className="mt-4 rounded-2xl border border-[#e8dccb] bg-white p-3">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <p className="text-xs font-bold leading-5 text-[#596579]">
                                    Votos registrados: {agendaVotes.length}
                                    {item.voting_opens_at
                                      ? ` • Aberta em ${formatDateTime(
                                          item.voting_opens_at
                                        )}`
                                      : ""}
                                    {item.voting_closes_at
                                      ? ` • Encerra em ${formatDateTime(
                                          item.voting_closes_at
                                        )}`
                                      : ""}
                                    {expired ? " • Prazo expirado" : ""}
                                  </p>

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        working ||
                                        selectedMeeting.status !== "em_andamento" ||
                                        !quorum.canStart
                                      }
                                      onClick={() => openVoting(item)}
                                      className="rounded-full bg-[#13233a] px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Abrir 4 min
                                    </button>

                                    <button
                                      type="button"
                                      disabled={working}
                                      onClick={() => closeVoting(item)}
                                      className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] disabled:opacity-50"
                                    >
                                      Encerrar
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-3 grid gap-2">
                                  {options.map((option) => (
                                    <div
                                      key={option.id}
                                      className="flex items-center justify-between gap-3 rounded-xl border border-[#e8dccb] bg-[#fdfcf9] px-3 py-2"
                                    >
                                      <p className="text-sm font-bold text-[#13233a]">
                                        {option.option_text}
                                      </p>

                                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                                        {getOptionVoteCount(option.id)} voto(s)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#596579]">
                                Esta pauta não exige votação.
                              </p>
                            )}
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-black text-red-800">
                    Encerrar reunião
                  </h2>

                  <p className="mt-1 text-sm font-semibold leading-6 text-[#596579]">
                    Após encerrada, a reunião irá para o histórico e não poderá
                    ser reaberta. A geração de ata ficará disponível somente
                    depois do encerramento.
                  </p>

                  <textarea
                    value={closingSummary}
                    onChange={(event) => setClosingSummary(event.target.value)}
                    rows={3}
                    placeholder="Resumo final ou observações para auxiliar a futura ata..."
                    className="mt-3 w-full resize-none rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm font-medium text-[#13233a] outline-none focus:border-red-300"
                  />

                  <button
                    type="button"
                    onClick={closeMeeting}
                    disabled={working}
                    className="mt-3 rounded-full bg-red-700 px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Encerrar definitivamente
                  </button>
                </section>
              </section>
            )}
          </div>
        )}
      </div>
    </ProtectedDashboard>
  );
}
