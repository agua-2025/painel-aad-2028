"use client";

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
  created_at: string;
};

type AgendaItem = {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  item_order: number;
  requires_vote: boolean;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function formatDateWithMonthName(date: Date) {
  const months = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
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

function getMeetingDateTime(meeting: Meeting) {
  const time = meeting.start_time ? meeting.start_time.slice(0, 5) : "23:59";
  const date = new Date(`${meeting.meeting_date}T${time}:00`);

  return date;
}

function isUpcomingMeeting(meeting: Meeting) {
  const status = String(meeting.status || "").trim().toLowerCase();

  if (status === "encerrada" || status === "cancelada") {
    return false;
  }

  const meetingDate = getMeetingDateTime(meeting);

  if (Number.isNaN(meetingDate.getTime())) {
    return true;
  }

  return meetingDate.getTime() >= new Date().getTime();
}

function buildMeetingOptionLabel(meeting: Meeting) {
  const title =
    meeting.title.length > 72 ? `${meeting.title.slice(0, 72)}...` : meeting.title;

  const time = meeting.start_time ? ` às ${meeting.start_time.slice(0, 5)}` : "";

  return `${title} — ${formatDate(meeting.meeting_date)}${time} — ${formatStatus(
    meeting.status
  )}`;
}

function buildConvocationText(meeting: Meeting, agendaItems: AgendaItem[]) {
  const presidentName = "Aline Novakc Locate";
  const issueDate = formatDateWithMonthName(new Date());

  const time = meeting.start_time
    ? meeting.start_time.slice(0, 5)
    : "horário não informado";

  const location = meeting.location?.trim() || "local/link a ser informado";

  const agendaText =
    agendaItems.length > 0
      ? agendaItems
          .map((item) => {
            const voteText = item.requires_vote ? " — pauta sujeita à votação" : "";
            return `${item.item_order}. ${item.title}${voteText}`;
          })
          .join("\n")
      : "As pautas serão informadas oportunamente.";

  return `CONVOCAÇÃO PARA REUNIÃO

A Presidente da Associação dos Acadêmicos do Curso de Direito – AAD Direito 2028, Sra. ${presidentName}, no uso de suas atribuições, CONVOCA os associados para reunião a ser realizada no dia ${formatDate(
    meeting.meeting_date
  )}, às ${time}, em ${location}.

Reunião: ${meeting.title}

PAUTAS PREVISTAS:

${agendaText}

ORIENTAÇÕES SOBRE PRESENÇA, QUÓRUM E VOTAÇÃO:

1. A reunião será aberta no horário acima indicado, observadas as regras de quórum aplicáveis à Associação.

2. A confirmação de presença deverá ser realizada exclusivamente pelo sistema da Associação, na área do associado, a partir do horário previsto para a reunião.

3. No horário da primeira chamada, o sistema verificará a quantidade de associados presentes para fins de apuração de quórum.

4. Não havendo quórum suficiente no horário da primeira chamada, o início da reunião permanecerá bloqueado, sendo liberado em segunda chamada após 15 minutos, com os associados presentes.

5. O associado que não confirmar presença no sistema poderá não ser computado para fins de quórum e não poderá participar das votações abertas durante a reunião.

6. As votações serão abertas durante a reunião, por pauta, e permanecerão disponíveis apenas pelo prazo definido no sistema.

7. O associado que não acessar o sistema ou não registrar seu voto dentro do prazo da votação ficará sem voto registrado na respectiva pauta.

8. As presenças, votos e respectivos horários ficarão registrados eletronicamente no sistema da Associação, para fins de controle interno, elaboração da ata e emissão de relatório de votação.

Ficam os associados cientificados de que a participação na reunião dependerá do acesso ao sistema, da confirmação de presença e da observância dos prazos de votação.

Araputanga/MT, ${issueDate}.

${presidentName}
Presidente
AAD Direito 2028`;
}

function renderFormattedConvocation(content: string) {
  const lines = content.split("\n");

  return lines.map((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      return <div key={index} className="h-3" />;
    }

    if (trimmed === "CONVOCAÇÃO PARA REUNIÃO") {
      return (
        <h2
          key={index}
          className="mb-5 text-center text-lg font-black uppercase tracking-[0.08em] text-black"
        >
          {trimmed}
        </h2>
      );
    }

    if (
      trimmed === "PAUTAS PREVISTAS:" ||
      trimmed === "ORIENTAÇÕES SOBRE PRESENÇA, QUÓRUM E VOTAÇÃO:"
    ) {
      return (
        <h3
          key={index}
          className="mt-4 text-sm font-black uppercase tracking-[0.08em] text-black"
        >
          {trimmed}
        </h3>
      );
    }

    const parts = trimmed.split(/(CONVOCA)/g);

    return (
      <p key={index} className="text-justify text-[14px] leading-7 text-black">
        {parts.map((part, partIndex) =>
          part === "CONVOCA" ? (
            <strong key={partIndex}>{part}</strong>
          ) : (
            <span key={partIndex}>{part}</span>
          )
        )}
      </p>
    );
  });
}

export default function MeetingConvocationPage() {
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [noticeStatus, setNoticeStatus] = useState("publicado");
  const [targetAudience, setTargetAudience] = useState("associados");
  const [content, setContent] = useState("");

  const selectedMeeting = useMemo(
    () => meetings.find((meeting) => meeting.id === selectedMeetingId) ?? null,
    [meetings, selectedMeetingId]
  );

  const selectedAgendaItems = useMemo(() => {
    if (!selectedMeeting) return [];

    return agendaItems
      .filter((item) => item.meeting_id === selectedMeeting.id)
      .sort((a, b) => a.item_order - b.item_order);
  }, [agendaItems, selectedMeeting]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const [meetingsResult, agendaResult] = await Promise.all([
      supabase
        .from("meetings")
        .select("id, title, meeting_date, start_time, location, status, created_at")
        .order("meeting_date", { ascending: true })
        .order("start_time", { ascending: true }),
      supabase
        .from("meeting_agenda_items")
        .select("id, meeting_id, title, description, item_order, requires_vote")
        .order("item_order", { ascending: true }),
    ]);

    if (meetingsResult.error) {
      console.error("Erro ao carregar reuniões:", meetingsResult.error);
      setMessage(
        meetingsResult.error.message || "Não foi possível carregar as reuniões."
      );
      setLoading(false);
      return;
    }

    if (agendaResult.error) {
      console.error("Erro ao carregar pautas:", agendaResult.error);
      setMessage(agendaResult.error.message || "Não foi possível carregar as pautas.");
      setLoading(false);
      return;
    }

    const loadedMeetings = ((meetingsResult.data as Meeting[]) ?? []).filter(
      isUpcomingMeeting
    );

    setMeetings(loadedMeetings);
    setAgendaItems((agendaResult.data as AgendaItem[]) ?? []);

    const nextSelectedMeetingId =
      loadedMeetings.find((meeting) => meeting.id === selectedMeetingId)?.id ??
      loadedMeetings[0]?.id ??
      "";

    setSelectedMeetingId(nextSelectedMeetingId);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedMeeting) {
      setContent("");
      return;
    }

    setContent(buildConvocationText(selectedMeeting, selectedAgendaItems));
  }, [selectedMeeting, selectedAgendaItems]);

  async function publishConvocation() {
    if (!selectedMeeting) {
      setMessage("Selecione uma reunião válida.");
      return;
    }

    if (!content.trim()) {
      setMessage("O texto da convocação não pode ficar vazio.");
      return;
    }

    setPublishing(true);
    setMessage("Publicando convocação...");

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
      title: `Convocação — ${selectedMeeting.title}`,
      content: content.trim(),
      category: "convocacao",
      target_audience: targetAudience,
      status: noticeStatus,
      published_at: noticeStatus === "publicado" ? new Date().toISOString() : null,
      created_by: profileId,
      meeting_id: selectedMeeting.id,
    });

    if (error) {
      console.error("Erro ao publicar convocação:", error);
      setMessage(error.message || "Não foi possível publicar a convocação.");
      setPublishing(false);
      return;
    }

    setMessage(
      noticeStatus === "publicado"
        ? "Convocação publicada como aviso com sucesso."
        : "Convocação salva como rascunho no módulo Avisos."
    );
    setPublishing(false);
  }

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-xl bg-[#13233a] p-4 text-white shadow-sm print:hidden">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
            Reuniões e Atas
          </p>

          <h1 className="mt-1 text-xl font-black tracking-[-0.03em]">
            Convocação de reunião
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-5 text-white/70">
            Gere uma convocação formal aproveitando data, horário, local e pautas da
            reunião cadastrada.
          </p>
        </section>

        {message && (
          <section className="rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#596579] shadow-sm print:hidden">
            {message}
          </section>
        )}

        <section className="rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm print:hidden">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
            <label className="grid min-w-0 gap-1.5">
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

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Público
              </span>

              <select
                value={targetAudience}
                onChange={(event) => setTargetAudience(event.target.value)}
                className="rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                <option value="associados">Associados</option>
                <option value="todos">Todos</option>
                <option value="interessados">Interessados</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-[#13233a]">
                Status
              </span>

              <select
                value={noticeStatus}
                onChange={(event) => setNoticeStatus(event.target.value)}
                className="rounded-lg border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#13233a] outline-none focus:border-[#c7a56b]"
              >
                <option value="publicado">Publicado</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </label>

            <button
              type="button"
              onClick={loadData}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>
        </section>

        {loading ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm print:hidden">
            <p className="text-sm font-bold text-[#596579]">
              Carregando reuniões...
            </p>
          </section>
        ) : !selectedMeeting ? (
          <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm print:hidden">
            <h2 className="font-black text-[#13233a]">
              Nenhuma reunião futura encontrada
            </h2>
            <p className="mt-1 text-sm text-[#596579]">
              A convocação deve ser gerada apenas para reuniões futuras ou ainda não
              realizadas.
            </p>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-[#e8dccb] bg-white p-4 shadow-sm print:hidden">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                    Texto da convocação
                  </h2>

                  <p className="mt-1 text-xs font-bold text-[#596579]">
                    Revise o texto antes de publicar no módulo Avisos ou gerar o PDF.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setContent(
                      buildConvocationText(selectedMeeting, selectedAgendaItems)
                    )
                  }
                  className="w-fit rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
                >
                  Regerar texto
                </button>
              </div>

              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={24}
                className="mt-4 min-h-[620px] w-full resize-y rounded-xl border border-[#e8dccb] bg-[#fffdf8] px-8 py-6 font-serif text-[15px] leading-8 text-[#13233a] outline-none focus:border-[#c7a56b]"
              />

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={publishConvocation}
                  disabled={publishing}
                  className="rounded-full bg-[#13233a] px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {publishing
                    ? "Publicando..."
                    : noticeStatus === "publicado"
                      ? "Publicar como aviso"
                      : "Salvar como rascunho"}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full border border-[#e8dccb] bg-white px-5 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] text-[#13233a] hover:bg-[#f7f8fa]"
                >
                  Gerar PDF
                </button>
              </div>
            </section>

            <section className="hidden print:block">
              <div className="font-serif text-black">
                <header className="mb-6 border-b border-black pb-3">
                  <div className="flex items-center gap-4">
                    <img
                      src="/brand/aad-login-logo.png"
                      alt="AAD Direito 2028"
                      className="h-14 w-auto"
                    />

                    <div className="max-w-[620px] leading-tight">
                      <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-justify">
                        Associação dos Acadêmicos do Curso de Direito
                      </p>

                      <h1 className="mt-1 text-base font-black">
                        AAD Direito 2028
                      </h1>

                      <p className="mt-1 text-justify text-[11px] leading-4">
                        Sede administrativa e foro: Rua Casemiro de Abreu, nº 200, Sala 01, Centro, Araputanga/MT, CEP 78.260-000 | E-mail: contato@aaddireito2028.com.br | Site: www.aaddireito2028.com.br
                      </p>
                    </div>
                  </div>
                </header>

                <main>{renderFormattedConvocation(content)}</main>
              </div>
            </section>
          </>
        )}
      </div>
    </ProtectedDashboard>
  );
}
