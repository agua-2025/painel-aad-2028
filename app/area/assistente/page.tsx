"use client";

import { useState } from "react";
import { ProtectedArea } from "@/components/ProtectedArea";

const quickQuestions = [
  "Como informo um pagamento?",
  "Onde vejo minhas mensalidades?",
  "Onde consulto minhas contribuições extras?",
  "Como acompanho minha solicitação?",
  "Onde vejo meu termo de adesão?",
  "Como recupero minha senha?",
  "Onde consulto o Estatuto Social?",
  "Quais são meus deveres como associado?",
  "Quem é a presidente da Associação?",
];

export default function AreaAssistentePage() {
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
          userProfile: "associado",
          allowedModules: [
            "area",
            "solicitacao",
            "dados",
            "documentos",
            "avisos",
            "suporte",
            "pagamentos",
            "financeiro",
            "contribuicoes_extras",
          ],
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
      console.error("Erro ao consultar assistente do associado:", error);
      setMessage("Não foi possível conectar ao assistente no momento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedArea>
      <div className="space-y-4">
      <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#a98246]">
              Inteligência Artificial
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
              Assistente do Associado
            </h1>

            <p className="mt-1 text-sm font-medium leading-6 text-[#596579]">
              Tire dúvidas sobre sua área, pagamentos, documentos, Estatuto, Ata e solicitação.
            </p>
          </div>

          <img
            src="/brand/aad-login-logo.png"
            alt="AAD Direito 2028"
            className="hidden h-auto max-h-[38px] w-auto max-w-[220px] object-contain md:block"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
            Faça uma pergunta
          </h2>

          <p className="mt-1 text-xs font-medium leading-5 text-[#596579]">
            Pergunte sobre sua solicitação, financeiro, documentos ou regras da Associação.
          </p>

          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            rows={2}
            placeholder=""
            className="mt-3 w-full resize-none rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-semibold leading-5 text-[#13233a] outline-none transition focus:border-[#c7a56b]"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold leading-5 text-red-700">
              {message}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#a98246]">
              Resposta do assistente
            </p>

            {answer ? (
              <div className="mt-2 max-h-[420px] overflow-y-auto pr-2 text-sm font-medium leading-6 text-[#13233a]">
                <div className="whitespace-pre-line">{answer}</div>
              </div>
            ) : (
              <div className="mt-2 flex min-h-[180px] items-center justify-center rounded-xl bg-white px-4 py-4 text-center text-sm font-medium leading-6 text-[#596579]">
                A resposta aparecerá aqui.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
            Perguntas rápidas
          </h2>

          <p className="mt-1 text-xs font-medium leading-5 text-[#596579]">
            Clique em uma pergunta para testar.
          </p>

          <div className="mt-3 grid gap-2">
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

          <div className="mt-3 rounded-xl bg-[#13233a] px-3 py-2 text-xs font-medium leading-5 text-white/80">
            <p className="font-black text-white">Dica</p>
            <p className="mt-0.5">
              Pergunte de forma simples. Exemplo: “Como informo o pagamento de uma mensalidade?”.
            </p>
          </div>
        </div>
      </section>
      </div>
    </ProtectedArea>
  );
}
