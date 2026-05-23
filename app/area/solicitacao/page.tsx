"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatCPF,
  formatPhone,
  isValidCPF,
  normalizeEmail,
  normalizeName,
  normalizeUF,
} from "@/lib/utils/formatters";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type MembershipRequest = {
  id: string;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  full_name: string;
  cpf: string | null;
  rg: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  semester: string | null;
  message: string | null;
  accepted_statute: boolean | null;
  accepted_financial_rules: boolean | null;
};

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    com_pendencia: "Com pendência",
    aprovada: "Aprovada",
    rejeitada: "Rejeitada",
  };

  return labels[value] || value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatValue(value: string | null | undefined) {
  return value && value.trim() ? value : "Não informado";
}

function formatBoolean(value: boolean | null | undefined) {
  return value ? "Sim" : "Não";
}

function escapeHtml(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printMembershipRequest(request: MembershipRequest) {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador bloqueou pop-ups.");
    return;
  }

  const cityState =
    [request.city, request.state].filter(Boolean).join(" / ") || "Não informado";

  const html = `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Termo de Adesão - ${escapeHtml(request.full_name)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 32px;
            color: #13233a;
            line-height: 1.45;
          }

          h1 {
            font-size: 22px;
            margin: 0 0 4px;
            text-align: center;
          }

          h2 {
            font-size: 15px;
            margin: 24px 0 10px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 6px;
          }

          .subtitle {
            text-align: center;
            font-size: 13px;
            margin-bottom: 28px;
          }

          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 24px;
          }

          .item {
            font-size: 13px;
          }

          .label {
            font-weight: bold;
          }

          .box {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 12px;
            margin-top: 8px;
            font-size: 13px;
          }

          .declaration {
            text-align: justify;
          }

          .signature {
            margin-top: 56px;
            text-align: center;
          }

          .signature-line {
            width: 320px;
            border-top: 1px solid #13233a;
            margin: 0 auto 8px;
          }

          @media print {
            button {
              display: none;
            }

            body {
              margin: 24px;
            }
          }
        </style>
      </head>

      <body>
        <h1>Termo de Adesão à Associação</h1>
        <p class="subtitle">
          Associação dos Acadêmicos do Curso de Direito – Turma de Formatura 2028 – AAD Direito 2028
        </p>

        <h2>Dados do associado/interessado</h2>
        <div class="grid">
          <div class="item"><span class="label">Nome completo:</span> ${escapeHtml(formatValue(request.full_name))}</div>
          <div class="item"><span class="label">CPF:</span> ${escapeHtml(formatValue(request.cpf))}</div>
          <div class="item"><span class="label">RG:</span> ${escapeHtml(formatValue(request.rg))}</div>
          <div class="item"><span class="label">Data de nascimento:</span> ${escapeHtml(request.birth_date ? formatDate(request.birth_date) : "Não informado")}</div>
          <div class="item"><span class="label">Telefone/WhatsApp:</span> ${escapeHtml(formatValue(request.phone))}</div>
          <div class="item"><span class="label">E-mail:</span> ${escapeHtml(formatValue(request.email))}</div>
          <div class="item"><span class="label">Semestre:</span> ${escapeHtml(formatValue(request.semester))}</div>
          <div class="item"><span class="label">Cidade/UF:</span> ${escapeHtml(cityState)}</div>
          <div class="item"><span class="label">Endereço:</span> ${escapeHtml(formatValue(request.address))}</div>
          <div class="item"><span class="label">CEP:</span> ${escapeHtml(formatValue(request.zip_code))}</div>
        </div>

        <h2>Manifestação de adesão</h2>
        <div class="box declaration">
          Declaro que este formulário constitui meu Termo de Adesão à Associação dos Acadêmicos do Curso de Direito –
          Turma de Formatura 2028 – AAD Direito 2028. Declaro, sob minha responsabilidade, que as informações
          prestadas são verdadeiras e correspondem à minha situação atual, bem como afirmo que li, compreendi e aceito
          o Estatuto Social da Associação.
        </div>

        <div class="box declaration">
          Declaro ciência e concordância com as regras financeiras aplicáveis aos associados, incluindo contribuições
          mensais, taxas, contribuições extras e demais obrigações regularmente aprovadas pela Associação.
        </div>

        <h2>Situação do termo</h2>
        <div class="grid">
          <div class="item"><span class="label">Situação:</span> ${escapeHtml(formatStatus(request.status))}</div>
          <div class="item"><span class="label">Enviado em:</span> ${escapeHtml(formatDate(request.created_at))}</div>
          <div class="item"><span class="label">Analisado em:</span> ${escapeHtml(request.reviewed_at ? formatDate(request.reviewed_at) : "Não analisado")}</div>
          <div class="item"><span class="label">Aceitou Estatuto:</span> ${escapeHtml(formatBoolean(request.accepted_statute))}</div>
          <div class="item"><span class="label">Aceitou regras financeiras:</span> ${escapeHtml(formatBoolean(request.accepted_financial_rules))}</div>
        </div>

        <h2>Observações</h2>
        <div class="box">
          <span class="label">Observação informada:</span>
          ${escapeHtml(request.message || "Nenhuma observação informada.")}
        </div>

        <div class="box">
          <span class="label">Análise da Associação:</span>
          ${escapeHtml(request.review_notes || "Nenhuma observação registrada.")}
        </div>

        <div class="signature">
          <div class="signature-line"></div>
          <div>${escapeHtml(request.full_name)}</div>
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function AreaSolicitacaoPage() {
  const router = useRouter();

  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [existingRequest, setExistingRequest] = useState<MembershipRequest | null>(null);
  const [showTermModal, setShowTermModal] = useState(false);

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
    semester: "",
    message: "",
    accepted_statute: false,
    accepted_financial_rules: false,
  });

  function updateField(field: string, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profileData) {
        setStatusMessage("Não foi possível carregar seu perfil.");
        setLoadingPage(false);
        return;
      }

      setProfile(profileData);

      const { data: requestData } = await supabase
        .from("membership_requests")
        .select(
        "id, status, review_notes, reviewed_at, created_at, full_name, cpf, rg, birth_date, phone, email, address, city, state, zip_code, semester, message, accepted_statute, accepted_financial_rules"
        )
        .or(`profile_id.eq.${profileData.id},email.eq.${profileData.email}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestData) {
        setExistingRequest(requestData);

        setForm({
          full_name: requestData.full_name || profileData.full_name || "",
          cpf: requestData.cpf || "",
          rg: requestData.rg || "",
          birth_date: requestData.birth_date || "",
          phone: requestData.phone || "",
          email: requestData.email || profileData.email || "",
          address: requestData.address || "",
          city: requestData.city || "Araputanga",
          state: requestData.state || "MT",
          zip_code: requestData.zip_code || "",
          semester: requestData.semester || "",
          message: requestData.message || "",
          accepted_statute: true,
          accepted_financial_rules: true,
        });
      } else {
        const metadata = user.user_metadata || {};

        setForm((current) => ({
          ...current,
          full_name: profileData.full_name || "",
          email: profileData.email || user.email || "",
          cpf: typeof metadata.cpf === "string" ? metadata.cpf : "",
          phone: typeof metadata.phone === "string" ? metadata.phone : "",
        }));
      }

      setLoadingPage(false);
    }

    loadData();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      setStatusMessage("Perfil não carregado. Atualize a página e tente novamente.");
      return;
    }

    if (existingRequest?.status === "aprovada") {
      setStatusMessage("Sua solicitação já foi aprovada.");
      return;
    }

    if (existingRequest?.status === "rejeitada") {
      setStatusMessage("Sua solicitação foi rejeitada. Procure a Diretoria/Secretaria para orientações.");
      return;
    }

    const fullName = normalizeName(form.full_name);
    const email = normalizeEmail(form.email);
    const cpf = formatCPF(form.cpf);
    const phone = formatPhone(form.phone);
    const state = normalizeUF(form.state);

    if (!fullName || fullName.split(" ").length < 2) {
      setStatusMessage("Informe o nome completo.");
      return;
    }

    if (!isValidCPF(cpf)) {
      setStatusMessage("Informe um CPF válido.");
      return;
    }

    if (!email) {
      setStatusMessage("Informe um e-mail válido.");
      return;
    }

    if (!form.accepted_statute || !form.accepted_financial_rules) {
      setStatusMessage("Para enviar o Termo de Adesão, é necessário aceitar o Estatuto Social e as regras financeiras da Associação.");
      return;
    }

    setSaving(true);
    setStatusMessage("Salvando solicitação...");

    const supabase = createClient();

    const payload = {
      profile_id: profile.id,
      full_name: fullName,
      cpf,
      rg: form.rg.trim() || null,
      birth_date: form.birth_date || null,
      phone: phone || null,
      email,
      address: form.address.trim() || null,
      city: normalizeName(form.city) || null,
      state: state || "MT",
      zip_code: form.zip_code.trim() || null,
      semester: form.semester.trim() || null,
      message: form.message.trim() || null,
      accepted_statute: form.accepted_statute,
      accepted_financial_rules: form.accepted_financial_rules,
      status: "pendente",
      review_notes: null,
      reviewed_at: null,
    };

    if (existingRequest) {
      const { error } = await supabase
        .from("membership_requests")
        .update(payload)
        .eq("id", existingRequest.id);

      if (error) {
        console.error(error);
        setStatusMessage("Não foi possível atualizar a solicitação.");
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("membership_requests").insert(payload);

      if (error) {
        console.error(error);
        setStatusMessage("Não foi possível enviar a solicitação.");
        setSaving(false);
        return;
      }
    }

    setStatusMessage("Termo de Adesão enviado com sucesso.");
    router.push("/area");
    router.refresh();
  }

  if (loadingPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-[#13233a]">
        <div className="rounded-3xl border border-[#e8dccb] bg-white p-8 shadow-sm">
          <p className="font-bold">Carregando solicitação...</p>
        </div>
      </main>
    );
  }

  const blocked =
    existingRequest?.status === "aprovada" || existingRequest?.status === "rejeitada";

  return (
    <ProtectedArea>
        <div className="space-y-4">
          <section className="rounded-2xl bg-[#13233a] px-5 py-5 text-white shadow-xl shadow-slate-900/10 md:px-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                  Minha área
                </p>

                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">
                  Termo de Adesão à Associação
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                  Preencha este Termo de Adesão para solicitar seu ingresso como associado
                  da AAD Direito 2028. O envio deste formulário representa sua manifestação
                  de interesse em aderir à Associação, sujeita à análise e aprovação da
                  Diretoria/Secretaria.
                </p>
              </div>
            </div>
          </section>

          {existingRequest && (
            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a7834d]">
                    Situação atual
                    <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTermModal(true)}
                      className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a] transition hover:bg-[#f7f8fa]"
                    >
                      Ver termo
                    </button>

                    <button
                      type="button"
                      onClick={() => printMembershipRequest(existingRequest)}
                      className="rounded-full bg-[#13233a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0c1728]"
                    >
                      Imprimir termo
                    </button>
                  </div>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-xl font-black tracking-[-0.03em] text-[#13233a]">
                      {formatStatus(existingRequest.status)}
                    </p>

                    {existingRequest.status === "aprovada" && (
                      <span className="rounded-full bg-[#13233a] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                        associado ativo
                      </span>
                    )}

                    {existingRequest.status === "pendente" && (
                      <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                        em análise
                      </span>
                    )}

                    {existingRequest.status === "com_pendencia" && (
                      <span className="rounded-full bg-[#fff7ed] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-800">
                        ajuste necessário
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-6 text-[#596579]">
                    {existingRequest.status === "aprovada" &&
                      "Sua solicitação foi aprovada e seu cadastro já consta como associado no sistema."}

                    {existingRequest.status === "pendente" &&
                      "Sua solicitação foi enviada e está aguardando análise da Diretoria/Secretaria."}

                    {existingRequest.status === "com_pendencia" &&
                      "Sua solicitação precisa de ajuste. Confira a observação da Associação e atualize os dados necessários."}

                    {existingRequest.status === "rejeitada" &&
                      "Sua solicitação foi analisada e não foi aprovada neste momento."}
                  </p>
                </div>

                <div className="rounded-xl bg-[#f7f8fa] px-4 py-3">
                  {existingRequest.review_notes ? (
                    <p className="text-sm leading-6 text-[#596579]">
                      <strong className="text-[#13233a]">Análise da Associação:</strong>{" "}
                      {existingRequest.review_notes}
                    </p>
                  ) : (
                    <p className="text-sm leading-6 text-[#596579]">
                      Acompanhe esta página para verificar o andamento da sua solicitação.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {blocked ? (
            <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
              {existingRequest?.status === "aprovada" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a7834d]">
                      Próximos passos
                    </p>

                    <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                      Acompanhe sua vida associativa
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-[#596579]">
                      Use sua área para acompanhar pendências, pagamentos, contribuições extras,
                      avisos e seus dados cadastrais.
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <Link
                      href="/area/financeiro"
                      className="rounded-xl border border-[#e8dccb] bg-[#f7f8fa] px-4 py-3 transition hover:bg-white"
                    >
                      <p className="text-sm font-black text-[#13233a]">Financeiro</p>
                      <p className="mt-1 text-xs font-bold text-[#596579]">
                        Mensalidades e saldos
                      </p>
                    </Link>

                    <Link
                      href="/area/pagamentos"
                      className="rounded-xl border border-[#e8dccb] bg-[#f7f8fa] px-4 py-3 transition hover:bg-white"
                    >
                      <p className="text-sm font-black text-[#13233a]">Pagamentos</p>
                      <p className="mt-1 text-xs font-bold text-[#596579]">
                        Histórico e comprovantes
                      </p>
                    </Link>

                    <Link
                      href="/area/contribuicoes-extras"
                      className="rounded-xl border border-[#e8dccb] bg-[#f7f8fa] px-4 py-3 transition hover:bg-white"
                    >
                      <p className="text-sm font-black text-[#13233a]">Contribuições</p>
                      <p className="mt-1 text-xs font-bold text-[#596579]">
                        Extras da Associação
                      </p>
                    </Link>

                    <Link
                      href="/area/dados"
                      className="rounded-xl border border-[#e8dccb] bg-[#f7f8fa] px-4 py-3 transition hover:bg-white"
                    >
                      <p className="text-sm font-black text-[#13233a]">Meus dados</p>
                      <p className="mt-1 text-xs font-bold text-[#596579]">
                        Conferir cadastro
                      </p>
                    </Link>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a7834d]">
                    Orientação
                  </p>

                  <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                    Solicitação encerrada
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#596579]">
                    Esta solicitação já foi analisada. Para nova orientação ou ajuste,
                    procure a Diretoria/Secretaria da Associação.
                  </p>

                  <Link
                    href="/area/suporte"
                    className="mt-4 inline-flex rounded-full bg-[#13233a] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#0c1728]"
                  >
                    Solicitar orientação
                  </Link>
                </div>
              )}
            </section>
          ) : (
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
                  placeholder="Digite seu nome completo"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">CPF *</span>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(event) => updateField("cpf", formatCPF(event.target.value))}
                  required
                  inputMode="numeric"
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
                <span className="text-sm font-bold text-[#596579]">Semestre atual</span>
                <input
                  type="text"
                  value={form.semester}
                  onChange={(event) => updateField("semester", event.target.value)}
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Ex.: 5º semestre"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Telefone/WhatsApp</span>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) => updateField("phone", formatPhone(event.target.value))}
                  inputMode="numeric"
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="(00) 00000-0000"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">E-mail *</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  required
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
                  onChange={(event) => updateField("state", normalizeUF(event.target.value))}
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="MT"
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-bold text-[#596579]">Mensagem ou observação</span>
                <textarea
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  rows={4}
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Escreva alguma informação complementar, se necessário"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl bg-[#f7f8fa] p-5">
            <label className="flex gap-3 text-sm font-bold leading-6 text-[#596579]">
              <input
                type="checkbox"
                checked={form.accepted_statute}
                onChange={(event) => updateField("accepted_statute", event.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                Declaro que este formulário constitui meu Termo de Adesão à Associação
                dos Acadêmicos do Curso de Direito – Turma de Formatura 2028 – AAD Direito
                2028. Declaro, sob minha responsabilidade, que as informações prestadas
                são verdadeiras e correspondem à minha situação atual, bem como afirmo
                que li, compreendi e aceito o Estatuto Social da Associação.
              </span>
            </label>

            <label className="flex gap-3 text-sm font-bold leading-6 text-[#596579]">
              <input
                type="checkbox"
                checked={form.accepted_financial_rules}
                onChange={(event) =>
                  updateField("accepted_financial_rules", event.target.checked)
                }
                className="mt-1 h-4 w-4"
              />
              <span>
                Declaro ciência e concordância com as regras financeiras aplicáveis aos
                associados, incluindo contribuições mensais, taxas, contribuições extras
                e demais obrigações regularmente aprovadas pela Associação. Estou ciente
                de que meu ingresso depende de análise e aprovação da Diretoria/Secretaria
                e de que a Associação poderá solicitar documentos ou informações
                complementares para conferência cadastral quando necessário.
              </span>
            </label>
          </div>

            {statusMessage && (
              <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
                {statusMessage}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Link
                href="/area"
                className="rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.1em] text-[#13233a]"
              >
                Voltar
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? "Salvando..." : "Enviar Termo de Adesão"}
              </button>
            </div>
          </form>
        )}
                  {existingRequest && showTermModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
              <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
                <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-[#e8dccb] bg-white px-5 py-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                      Meu Termo de Adesão
                    </p>

                    <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                      {existingRequest.full_name}
                    </h2>

                    <p className="mt-1 text-sm font-bold text-[#596579]">
                      Enviado em {formatDate(existingRequest.created_at)} •{" "}
                      {formatStatus(existingRequest.status)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => printMembershipRequest(existingRequest)}
                      className="rounded-full bg-[#13233a] px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-white"
                    >
                      Imprimir termo
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTermModal(false)}
                      className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#13233a]"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <section className="rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                      Dados informados
                    </h3>

                    <div className="mt-4 grid gap-3 text-sm text-[#596579] md:grid-cols-2">
                      <p>
                        <strong className="text-[#13233a]">Nome completo:</strong>{" "}
                        {existingRequest.full_name}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">CPF:</strong>{" "}
                        {existingRequest.cpf || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">RG:</strong>{" "}
                        {existingRequest.rg || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Data de nascimento:</strong>{" "}
                        {existingRequest.birth_date
                          ? formatDate(existingRequest.birth_date)
                          : "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Telefone/WhatsApp:</strong>{" "}
                        {existingRequest.phone || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">E-mail:</strong>{" "}
                        {existingRequest.email}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Semestre:</strong>{" "}
                        {existingRequest.semester || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">Cidade/UF:</strong>{" "}
                        {[existingRequest.city, existingRequest.state].filter(Boolean).join(" / ") ||
                          "Não informado"}
                      </p>

                      <p className="md:col-span-2">
                        <strong className="text-[#13233a]">Endereço:</strong>{" "}
                        {existingRequest.address || "Não informado"}
                      </p>

                      <p>
                        <strong className="text-[#13233a]">CEP:</strong>{" "}
                        {existingRequest.zip_code || "Não informado"}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#e8dccb] bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                      Declarações
                    </h3>

                    <div className="mt-4 space-y-3 text-sm leading-6 text-[#596579]">
                      <p className="rounded-xl bg-[#f7f8fa] p-3">
                        Declaro que este formulário constitui meu Termo de Adesão à
                        Associação dos Acadêmicos do Curso de Direito – Turma de
                        Formatura 2028 – AAD Direito 2028. Declaro, sob minha
                        responsabilidade, que as informações prestadas são verdadeiras
                        e correspondem à minha situação atual, bem como afirmo que li,
                        compreendi e aceito o Estatuto Social da Associação.
                      </p>

                      <p className="rounded-xl bg-[#f7f8fa] p-3">
                        Declaro ciência e concordância com as regras financeiras
                        aplicáveis aos associados, incluindo contribuições mensais,
                        taxas, contribuições extras e demais obrigações regularmente
                        aprovadas pela Associação.
                      </p>

                      <div className="grid gap-3 md:grid-cols-2">
                        <p>
                          <strong className="text-[#13233a]">Aceitou Estatuto:</strong>{" "}
                          {formatBoolean(existingRequest.accepted_statute)}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">
                            Aceitou regras financeiras:
                          </strong>{" "}
                          {formatBoolean(existingRequest.accepted_financial_rules)}
                        </p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#e8dccb] bg-white p-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#13233a]">
                      Situação e análise
                    </h3>

                    <div className="mt-4 space-y-3 text-sm leading-6 text-[#596579]">
                      <div className="grid gap-3 md:grid-cols-3">
                        <p>
                          <strong className="text-[#13233a]">Situação:</strong>{" "}
                          {formatStatus(existingRequest.status)}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">Enviado em:</strong>{" "}
                          {formatDate(existingRequest.created_at)}
                        </p>

                        <p>
                          <strong className="text-[#13233a]">Analisado em:</strong>{" "}
                          {existingRequest.reviewed_at
                            ? formatDate(existingRequest.reviewed_at)
                            : "Não analisado"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#f7f8fa] p-3">
                        <strong className="text-[#13233a]">Observação informada:</strong>{" "}
                        {existingRequest.message || "Nenhuma observação informada."}
                      </div>

                      <div className="rounded-xl border border-[#e8dccb] bg-[#fffaf1] p-3">
                        <strong className="text-[#13233a]">Análise da Associação:</strong>{" "}
                        {existingRequest.review_notes || "Nenhuma observação registrada."}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
    </ProtectedArea>
  );
}
