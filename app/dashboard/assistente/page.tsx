"use client";

import { useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";

const quickQuestions = [
  "Como aprovar um informe de pagamento?",
  "Como gerar mensalidades?",
  "Como criar uma contribuição extra?",
  "Como conferir a prestação de contas?",
  "Como usar a análise fiscal com IA?",
  "Como fazer backup do sistema?",
  "O que a Comissão Fiscal pode consultar?",
  "Quem é a presidente da Associação?",
  "Quem são os membros da Comissão Fiscal?",
  "Quais são os deveres dos associados?",
];

export default function AssistenteSistemaPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAssistant(selectedQuestion?: string) {
    const finalQuestion = (selectedQuestion || question).trim();

    if (!finalQuestion) {
      setMessage("Digite uma pergunta para o assistente.");
      return;
    }

    setLoading(true);
    setMessage("");
    setAnswer("");

    try {
      const response = await fetch("/api/ia/assistente-sistema", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: finalQuestion,
          userProfile: "perfil administrativo logado",
          allowedModules: [],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Não foi possível consultar o assistente.");
        return;
      }

      setAnswer(data.answer || "");
      setQuestion(finalQuestion);
    } catch (error) {
      console.error("Erro ao consultar assistente:", error);
      setMessage("Não foi possível conectar ao assistente no momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedDashboard>
      <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-3 overflow-visible lg:h-[calc(100vh-5rem)] lg:min-h-[620px] lg:overflow-hidden">
        <section className="flex shrink-0 items-center justify-between gap-4 rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a98246]">
              Inteligência Artificial
            </p>

            <h1 className="mt-0.5 text-xl font-black tracking-[-0.04em] text-[#13233a]">
              Assistente de Uso do Sistema
            </h1>

            <p className="mt-0.5 text-xs font-semibold text-[#596579]">
              Dúvidas sobre módulos, rotinas, Estatuto, Ata e área do associado.
            </p>
          </div>

          <img
            src="/brand/aad-login-logo.png"
            alt="AAD Direito 2028"
            className="hidden h-auto max-h-[34px] w-auto max-w-[210px] object-contain md:block"
          />
        </section>

        <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[1fr_0.72fr]">
          <div className="flex min-h-0 flex-col rounded-2xl border border-[#e8dccb] bg-white p-3 shadow-sm">
            <div className="shrink-0">
              <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Faça uma pergunta
              </h2>

              <p className="mt-0.5 text-xs font-medium text-[#596579]">
                Pergunte como usar o sistema ou consulte informações institucionais.
              </p>

              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={2}
                placeholder="Ex.: Qual a função do Pedro Fatini?"
                className="mt-2 w-full resize-none rounded-xl border border-[#e8dccb] bg-[#f8fafc] px-3 py-2 text-sm font-semibold leading-5 text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white"
              />

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => askAssistant()}
                  disabled={loading}
                  className="rounded-full bg-[#13233a] px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-white transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Consultando..." : "Perguntar à IA"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQuestion("");
                    setAnswer("");
                    setMessage("");
                  }}
                  className="rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] transition hover:bg-[#f7f8fa]"
                >
                  Limpar
                </button>
              </div>

              {message && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold leading-5 text-red-700">
                  {message}
                </div>
              )}
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-3">
              <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-[#a98246]">
                Resposta do assistente
              </p>

              {answer ? (
                <div className="mt-2 max-h-[45vh] min-h-[220px] overflow-y-auto pr-2 text-sm font-medium leading-6 text-[#13233a] lg:min-h-0 lg:flex-1">
                  <div className="whitespace-pre-line">{answer}</div>
                </div>
              ) : (
                <div className="mt-2 flex min-h-[220px] items-center justify-center rounded-xl bg-white px-4 py-4 text-center text-sm font-medium leading-6 text-[#596579] lg:min-h-0 lg:flex-1">
                  A resposta aparecerá aqui. Se o texto for maior, apenas esta área terá rolagem.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-2xl border border-[#e8dccb] bg-white p-3 shadow-sm">
            <div className="shrink-0">
              <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                Perguntas rápidas
              </h2>

              <p className="mt-0.5 text-xs font-medium text-[#596579]">
                Clique em uma pergunta para testar.
              </p>
            </div>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-1.5">
                {quickQuestions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => askAssistant(item)}
                    disabled={loading}
                    className="rounded-xl border border-[#e8dccb] bg-[#f8fafc] px-3 py-2 text-left text-sm font-bold leading-5 text-[#13233a] transition hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 shrink-0 rounded-xl bg-[#13233a] px-3 py-2 text-xs font-medium leading-5 text-white/80">
              <p className="font-black text-white">Dica</p>
              <p className="mt-0.5">
                Informe o contexto. Exemplo: “Sou da Tesouraria, como aprovo um informe?”.
              </p>
            </div>
          </div>
        </section>
      </div>
    </ProtectedDashboard>
  );
}
