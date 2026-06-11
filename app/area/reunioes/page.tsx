"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { createClient } from "@/lib/supabase/client";

type Associate = {
  id: string;
  full_name: string;
  email: string | null;
  status: string;
};

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
};

type AgendaItem = {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  item_order: number;
  requires_vote: boolean;
  voting_status: string;
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
  associate_id: string | null;
  full_name: string;
  email: string | null;
  confirmed_at: string;
};

type Vote = {
  id: string;
  meeting_id: string;
  agenda_item_id: string;
  associate_id: string | null;
  option_id: string | null;
  vote_value: string | null;
  voted_at: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data inválida";
  }

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
    reuniao_geral: "Reunião geral",
    diretoria: "Diretoria",
    assembleia: "Assembleia",
    comissao: "Comissão",
    presencial: "Presencial",
    online: "Online",
    hibrida: "Híbrida",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function isVotingOpen(item: AgendaItem) {
  if (item.voting_status !== "aberta") {
    return false;
  }

  if (!item.voting_closes_at) {
    return true;
  }

  return new Date(item.voting_closes_at).getTime() >= Date.now();
}

function isVotingExpired(item: AgendaItem) {
  if (item.voting_status !== "aberta" || !item.voting_closes_at) {
    return false;
  }

  return new Date(item.voting_closes_at).getTime() < Date.now();
}

function isToday(value?: string | null) {
  if (!value) return false;
  return value.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function getMeetingStartDate(meeting: Meeting) {
  const time = meeting.start_time ? meeting.start_time.slice(0, 5) : "00:00";
  return new Date(`${meeting.meeting_date}T${time}:00`);
}

function getPresenceAvailability(meeting: Meeting) {
  const startDate = getMeetingStartDate(meeting);
  const now = new Date();

  return {
    canConfirm: now.getTime() >= startDate.getTime(),
    startDate,
  };
}

function buildMeetingOptionLabel(meeting: Meeting) {
  const title =
    meeting.title.length > 72 ? `${meeting.title.slice(0, 72)}...` : meeting.title;

  const time = meeting.start_time ? ` às ${meeting.start_time.slice(0, 5)}` : "";

  return `${title} — ${formatDate(meeting.meeting_date)}${time} — ${formatStatus(
    meeting.status
  )}`;
}


export default function AreaReunioesPage() {
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPresence, setSavingPresence] = useState(false);
  const [savingVote, setSavingVote] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

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
    () =>
      associate
        ? attendance.find(
            (item) =>
              item.meeting_id === selectedMeetingId &&
              item.associate_id === associate.id
          ) ?? null
        : null,
    [attendance, associate, selectedMeetingId]
  );

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      setMessage("Não foi possível identificar o usuário logado.");
      setLoading(false);
      return;
    }

    const { data: associateData, error: associateError } = await supabase
      .from("associates")
      .select("id, full_name, email, status")
      .eq("email", user.email)
      .eq("status", "ativo")
      .maybeSingle();

    if (associateError) {
      console.error(associateError);
      setMessage("Não foi possível carregar seu cadastro de associado.");
      setLoading(false);
      return;
    }

    if (!associateData) {
      setMessage(
        "Seu cadastro de associado ativo não foi localizado. Procure a Diretoria/Secretaria."
      );
      setLoading(false);
      return;
    }

    setAssociate(associateData as Associate);

    const [
      meetingsResult,
      agendaResult,
      optionsResult,
      attendanceResult,
      votesResult,
    ] = await Promise.all([
      supabase
        .from("meetings")
        .select(
          "id, title, description, meeting_type, meeting_date, start_time, location, mode, status"
        )
        .order("meeting_date", { ascending: true }),
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
        .eq("associate_id", associateData.id),
      supabase
        .from("meeting_votes")
        .select(
          "id, meeting_id, agenda_item_id, associate_id, option_id, vote_value, voted_at"
        )
        .eq("associate_id", associateData.id),
    ]);

    if (meetingsResult.error) {
      console.error(meetingsResult.error);
      setMessage("Não foi possível carregar as reuniões.");
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
      setMessage("Não foi possível carregar sua presença.");
      setLoading(false);
      return;
    }

    if (votesResult.error) {
      console.error(votesResult.error);
      setMessage("Não foi possível carregar seus votos.");
      setLoading(false);
      return;
    }

    const loadedMeetings = ((meetingsResult.data as Meeting[]) ?? []).filter(
      (meeting) => {
        const status = String(meeting.status || "").trim().toLowerCase();
        return status === "convocada" || status === "em_andamento";
      }
    );

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

  function getVoteForAgenda(agendaItemId: string) {
    if (!associate) return null;

    return (
      votes.find(
        (vote) =>
          vote.agenda_item_id === agendaItemId &&
          vote.associate_id === associate.id
      ) ?? null
    );
  }

  async function confirmPresence() {
    if (!associate || !selectedMeeting) {
      setMessage("Selecione uma reunião válida.");
      return;
    }

    const presenceAvailability = getPresenceAvailability(selectedMeeting);

    if (!presenceAvailability.canConfirm) {
      setMessage(
        `A presença poderá ser confirmada a partir de ${formatDateTime(
          presenceAvailability.startDate.toISOString()
        )}.`
      );
      return;
    }

    setSavingPresence(true);
    setMessage("");

    const supabase = createClient();

    const payload = {
      meeting_id: selectedMeeting.id,
      associate_id: associate.id,
      full_name: associate.full_name,
      email: associate.email,
      attendance_type: "presente",
      confirmed_by: "associado",
    };

    const { data, error } = await supabase
      .from("meeting_attendance")
      .insert(payload)
      .select("id, meeting_id, associate_id, full_name, email, confirmed_at")
      .single();

    if (error) {
      console.error(error);

      if (String(error.message || "").toLowerCase().includes("duplicate")) {
        setMessage("Sua presença já estava confirmada para esta reunião.");
        await loadData();
        setSavingPresence(false);
        return;
      }

      setMessage("Não foi possível confirmar sua presença.");
      setSavingPresence(false);
      return;
    }

    setAttendance((current) => [...current, data as Attendance]);
    setMessage("Presença confirmada. Você poderá votar nas pautas quando a votação estiver aberta.");
    setSavingPresence(false);
  }

  async function registerVote(agendaItem: AgendaItem, option: VoteOption) {
    if (!associate || !selectedMeeting) {
      setMessage("Não foi possível identificar o associado ou a reunião.");
      return;
    }

    if (!selectedMeetingAttendance) {
      setMessage("Confirme sua presença nesta reunião antes de votar.");
      return;
    }

    if (!isVotingOpen(agendaItem)) {
      setMessage("A votação desta pauta não está aberta no momento.");
      return;
    }

    const existingVote = getVoteForAgenda(agendaItem.id);

    if (existingVote) {
      setMessage("Seu voto nesta pauta já foi registrado.");
      return;
    }

    const confirmed = window.confirm(
      `Confirma seu voto na opção: "${option.option_text}"?\n\nApós confirmar, não será possível alterar o voto nesta pauta.`
    );

    if (!confirmed) {
      return;
    }

    setSavingVote(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      agenda_item_id: agendaItem.id,
      meeting_id: selectedMeeting.id,
      associate_id: associate.id,
      profile_id: user?.id ?? null,
      option_id: option.id,
      vote_value: option.option_text,
    };

    const { data, error } = await supabase
      .from("meeting_votes")
      .insert(payload)
      .select(
        "id, meeting_id, agenda_item_id, associate_id, option_id, vote_value, voted_at"
      )
      .single();

    if (error) {
      console.error(error);

      if (String(error.message || "").toLowerCase().includes("duplicate")) {
        setMessage("Seu voto nesta pauta já foi registrado.");
        await loadData();
        setSavingVote(false);
        return;
      }

      setMessage("Não foi possível registrar seu voto.");
      setSavingVote(false);
      return;
    }

    setVotes((current) => [...current, data as Vote]);
    setSelectedOptions((current) => {
      const next = { ...current };
      delete next[agendaItem.id];
      return next;
    });
    setMessage("Voto registrado com sucesso.");
    setSavingVote(false);
  }

  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-xl bg-[#13233a] p-4 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
            Participação
          </p>

          <h1 className="mt-1 text-xl font-black tracking-[-0.03em]">
            Reuniões
          </h1>

          <p className="mt-1 text-sm leading-5 text-white/70">
            Confirme presença e vote nas pautas abertas.
          </p>
        </section>

        {message && (
          <section className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#596579] shadow-sm">
            {message}
          </section>
        )}

        {loading ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#596579]">Carregando reuniões...</p>
          </section>
        ) : meetings.length === 0 ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
            <h2 className="font-black text-[#13233a]">
              Nenhuma reunião disponível
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#596579]">
              No momento não há reuniões convocadas ou em andamento.
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm">
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

                <button
                  type="button"
                  onClick={loadData}
                  className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a]"
                >
                  Atualizar
                </button>
              </div>
            </section>

            {selectedMeeting && (
              <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                      Reunião selecionada
                    </p>

                    <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                      {selectedMeeting.title}
                    </h2>

                    <p className="mt-1 text-sm font-semibold leading-5 text-[#596579]">
                      {formatDate(selectedMeeting.meeting_date)}
                      {selectedMeeting.start_time
                        ? ` às ${selectedMeeting.start_time.slice(0, 5)}`
                        : ""}
                      {" • "}
                      {selectedMeeting.location || "Local não informado"}
                    </p>

                    <p className="mt-1 text-xs font-bold text-[#596579]">
                      Status: {formatStatus(selectedMeeting.status)}
                    </p>
                  </div>

                  {selectedMeetingAttendance ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                      <p className="text-sm font-black text-green-800">
                        Presença confirmada
                      </p>
                      <p className="mt-0.5 text-[11px] font-bold text-green-700">
                        {formatDateTime(selectedMeetingAttendance.confirmed_at)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-2">
                      <button
                        type="button"
                        onClick={confirmPresence}
                        disabled={savingPresence || !getPresenceAvailability(selectedMeeting).canConfirm}
                        className="w-fit rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingPresence ? "Confirmando..." : "Confirmar presença"}
                      </button>

                      {!getPresenceAvailability(selectedMeeting).canConfirm && (
                        <p className="max-w-xs text-xs font-bold leading-5 text-[#596579]">
                          Presença liberada a partir de {formatDateTime(
                            getPresenceAvailability(selectedMeeting).startDate.toISOString()
                          )}.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3">
                  {selectedMeetingAgenda.length === 0 ? (
                    <div className="rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
                      Esta reunião ainda não possui pautas.
                    </div>
                  ) : (
                    selectedMeetingAgenda.map((item) => {
                      const options = getOptionsForAgenda(item.id);
                      const existingVote = getVoteForAgenda(item.id);
                      const votingOpen = isVotingOpen(item);
                      const expired = isVotingExpired(item);

                      return (
                        <article
                          key={item.id}
                          className="rounded-2xl border border-[#e8dccb] bg-[#fdfcf9] p-4"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#b28743]">
                                Pauta {item.item_order}
                              </p>

                              <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
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
                              {item.voting_opens_at && (
                                <p className="text-xs font-bold leading-5 text-[#596579]">
                                  Aberta em {formatDateTime(item.voting_opens_at)}
                                  {item.voting_closes_at
                                    ? ` • Encerra em ${formatDateTime(
                                        item.voting_closes_at
                                      )}`
                                    : ""}
                                </p>
                              )}

                              {!selectedMeetingAttendance && (
                                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                                  Confirme sua presença para votar nesta reunião.
                                </p>
                              )}

                              {expired && (
                                <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
                                  O prazo desta votação foi encerrado.
                                </p>
                              )}

                              {existingVote && (
                                <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold leading-5 text-green-800">
                                  Seu voto foi registrado: {existingVote.vote_value}
                                </p>
                              )}

                              <div className="mt-3 grid gap-2">
                                {options.length === 0 ? (
                                  <p className="rounded-xl bg-[#f7f8fa] px-3 py-2 text-sm font-bold text-[#596579]">
                                    Nenhuma alternativa cadastrada para esta pauta.
                                  </p>
                                ) : (
                                  <>
                                    {options.map((option) => {
                                      const disabled =
                                        savingVote ||
                                        !selectedMeetingAttendance ||
                                        !votingOpen ||
                                        Boolean(existingVote);

                                      const selectedOptionId =
                                        existingVote?.option_id ||
                                        selectedOptions[item.id] ||
                                        "";

                                      const isSelected = selectedOptionId === option.id;

                                      return (
                                        <label
                                          key={option.id}
                                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-black transition ${
                                            existingVote?.option_id === option.id
                                              ? "border-green-300 bg-green-50 text-green-800"
                                              : isSelected
                                                ? "border-[#c7a56b] bg-[#fff9ef] text-[#13233a]"
                                                : disabled
                                                  ? "border-[#e8dccb] bg-[#f7f8fa] text-[#8a94a6]"
                                                  : "border-[#e8dccb] bg-white text-[#13233a] hover:bg-[#fff9ef]"
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`agenda-${item.id}`}
                                            value={option.id}
                                            checked={isSelected}
                                            disabled={disabled}
                                            onChange={() =>
                                              setSelectedOptions((current) => ({
                                                ...current,
                                                [item.id]: option.id,
                                              }))
                                            }
                                            className="h-4 w-4"
                                          />

                                          <span>{option.option_text}</span>
                                        </label>
                                      );
                                    })}

                                    {!existingVote && votingOpen && selectedMeetingAttendance && (
                                      <button
                                        type="button"
                                        disabled={savingVote || !selectedOptions[item.id]}
                                        onClick={() => {
                                          const selectedOption = options.find(
                                            (option) => option.id === selectedOptions[item.id]
                                          );

                                          if (selectedOption) {
                                            registerVote(item, selectedOption);
                                          }
                                        }}
                                        className="mt-2 rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {savingVote ? "Registrando..." : "Confirmar voto"}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-xl bg-white px-3 py-2 text-sm font-bold text-[#596579]">
                              Esta pauta não exige votação.
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </ProtectedArea>
  );
}
