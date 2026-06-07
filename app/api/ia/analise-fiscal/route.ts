import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type FiscalAnalysisPayload = {
  monthLabel?: string;
  summary?: {
    openingBalance?: number;
    totalEntries?: number;
    totalExpenses?: number;
    periodResult?: number;
    finalBalance?: number;
    totalMonthly?: number;
    totalExtra?: number;
    entriesCount?: number;
    expensesCount?: number;
    movementsCount?: number;
    expensesWithoutReceiptCount?: number;
  };
  alerts?: string[];
};

function formatCurrency(value: number | undefined) {
  const safeValue = Number(value ?? 0);

  return safeValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function cleanAiText(value: string) {
  return value
    .replace(/^```[a-zA-Z]*\s*/g, "")
    .replace(/```$/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/^---+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave GEMINI_API_KEY não configurada no servidor." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as FiscalAnalysisPayload;

    const monthLabel = body.monthLabel || "período informado";
    const summary = body.summary || {};
    const alerts = body.alerts || [];

    const prompt = `
Você é um assistente de apoio à Comissão Fiscal de uma associação de acadêmicos de Direito.

Elabore uma análise financeira objetiva, técnica, cautelosa e em português do Brasil, com base exclusivamente nos dados abaixo.

Não invente dados.
Não diga que as contas foram aprovadas.
Não substitua a Comissão Fiscal.
Não faça acusação.
Não use linguagem alarmista.
Use tom institucional, claro e profissional.

Dados do período:
- Referência: ${monthLabel}
- Saldo inicial: ${formatCurrency(summary.openingBalance)}
- Total de entradas: ${formatCurrency(summary.totalEntries)}
- Total de saídas: ${formatCurrency(summary.totalExpenses)}
- Resultado do mês: ${formatCurrency(summary.periodResult)}
- Saldo final estimado: ${formatCurrency(summary.finalBalance)}
- Receitas de mensalidades: ${formatCurrency(summary.totalMonthly)}
- Receitas de contribuições extras: ${formatCurrency(summary.totalExtra)}
- Quantidade de entradas registradas: ${summary.entriesCount ?? 0}
- Quantidade de despesas pagas: ${summary.expensesCount ?? 0}
- Total de movimentações: ${summary.movementsCount ?? 0}
- Despesas pagas sem comprovante: ${summary.expensesWithoutReceiptCount ?? 0}

Alertas do sistema:
${alerts.length > 0 ? alerts.map((alert) => `- ${alert}`).join("\n") : "- Nenhum alerta adicional informado."}

Estruture a resposta exatamente com estes tópicos:

1. Síntese do período
2. Pontos de atenção
3. Recomendações de conferência
4. Conclusão preliminar

Regras obrigatórias de estilo:
- Não use Markdown.
- Não use asteriscos.
- Não use cerquilhas ou títulos com #.
- Não use linhas separadoras.
- Não use saudação inicial.
- Não use expressão como "Prezados(as)".
- Escreva de forma natural, institucional, objetiva e moderada.
- Use tópicos numerados simples, apenas com o número e o título.
- Evite linguagem excessivamente conclusiva.
- Evite expressões fortes como "aumento patrimonial", "irregularidade", "falha", "risco grave" ou "revisão aprofundada", salvo se os dados indicarem claramente necessidade.
- Prefira termos como "resultado positivo", "ponto de atenção", "recomenda-se conferir" e "sugere-se verificar".
- Evite texto longo.
- Cada tópico deve ter no máximo um parágrafo curto.
- Não ultrapasse aproximadamente 1.300 caracteres.

No final, inclua exatamente a frase:
"Esta análise tem caráter auxiliar e deve ser conferida pela Tesouraria, Presidência e Comissão Fiscal."
`;

    const ai = new GoogleGenAI({ apiKey });

    const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"];
    let analysis = "";
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        analysis = cleanAiText(response.text || "");

        if (analysis) {
          break;
        }
      } catch (error) {
        lastError = error;
        console.error(`Erro ao consultar o modelo ${model}:`, error);
      }
    }

    if (!analysis) {
      console.error("Falha em todos os modelos da análise fiscal:", lastError);

      return NextResponse.json(
        {
          error:
            "A análise com IA está temporariamente indisponível. Aguarde alguns instantes e tente novamente.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Erro ao gerar análise fiscal com IA:", error);

    return NextResponse.json(
      { error: "Não foi possível gerar a análise fiscal com IA." },
      { status: 500 }
    );
  }
}
