import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AgendaItemPayload = {
  item_order: number;
  title: string;
  description: string | null;
  requires_vote: boolean;
  voting_status: string;
  total_votes: number;
  options: {
    option_text: string;
    votes: number;
  }[];
};

type AttendancePayload = {
  full_name: string;
  email: string | null;
  confirmed_at: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Erro desconhecido.";
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Chave GEMINI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const meeting = body.meeting;
    const attendance = (body.attendance ?? []) as AttendancePayload[];
    const agendaItems = (body.agendaItems ?? []) as AgendaItemPayload[];
    const additionalInfo = String(body.additionalInfo ?? "").trim();

    if (!meeting?.title || !meeting?.meeting_date) {
      return NextResponse.json(
        { error: "Dados da reunião insuficientes para gerar a ata." },
        { status: 400 }
      );
    }

    const prompt = `
Você é responsável por redigir uma ata formal para a Associação dos Acadêmicos do Curso de Direito – Turma de Formatura 2028 – AAD Direito 2028.

Elabore uma ATA em texto corrido, formal, limpa e pronta para revisão, usando exclusivamente os dados fornecidos.

REGRAS DE FORMATAÇÃO:
- Não use markdown.
- Não use asteriscos.
- Não use títulos em negrito.
- Não use listas com bullet points, salvo se realmente necessário.
- Não use expressões como "informação não completa no sistema".
- Não escreva campos artificiais como "Reunião encerrada: sim".
- Não invente nomes de Presidente ou Secretário.
- No final, use apenas linhas de assinatura genéricas:
  Presidência
  Secretaria/Diretoria responsável

REGRAS DE CONTEÚDO:
- Não invente fatos, nomes, horários, quórum, deliberações ou resultados.
- Se algum dado estiver ausente, simplesmente omita ou registre de forma discreta.
- Se houver votos nas opções, informe o resultado com base nos votos enviados.
- Se todas as opções estiverem com zero votos, diga apenas que não houve voto registrado.
- Se houver apenas uma presença registrada, redija naturalmente, sem destacar como problema.
- Não diga que o texto foi feito por IA.
- Não faça comentários fora da ata.
- Use linguagem institucional, objetiva e elegante.
- A ata deve ter aparência parecida com documento oficial, não com relatório de sistema.

ESTRUTURA DESEJADA:
1. Título simples: ATA DE REUNIÃO DA ASSOCIAÇÃO DOS ACADÊMICOS DO CURSO DE DIREITO – AAD DIREITO 2028
2. Abertura em texto corrido, com data, horário, formato e local/link.
3. Registro de presença.
4. Pautas tratadas e deliberações.
5. Encerramento.
6. Assinaturas.

DADOS DA REUNIÃO:
${JSON.stringify(meeting, null, 2)}

PRESENÇAS CONFIRMADAS:
${JSON.stringify(attendance, null, 2)}

PAUTAS, ALTERNATIVAS E VOTAÇÕES:
${JSON.stringify(agendaItems, null, 2)}

INFORMAÇÕES COMPLEMENTARES:
${additionalInfo || "Não foram informadas informações complementares."}

Gere somente o texto da ata, em português do Brasil.
`;

    const ai = new GoogleGenAI({ apiKey });

    const modelCandidates = [
      process.env.GEMINI_MODEL,
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
    ].filter(Boolean) as string[];

    const uniqueModels = Array.from(new Set(modelCandidates));

    let lastError: unknown = null;

    for (const model of uniqueModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        const minuteText = response.text?.trim();

        if (minuteText) {
          return NextResponse.json({
            minuteText,
            modelUsed: model,
          });
        }

        lastError = new Error(`O modelo ${model} respondeu sem texto.`);
      } catch (error) {
        lastError = error;
        console.error(`Erro ao gerar ata com o modelo ${model}:`, getErrorMessage(error));
      }
    }

    return NextResponse.json(
      {
        error: `Não foi possível gerar a ata com os modelos disponíveis. Último erro: ${getErrorMessage(lastError)}`,
      },
      { status: 503 }
    );
  } catch (error) {
    const details = getErrorMessage(error);

    console.error("Erro ao gerar ata com IA:", details);

    return NextResponse.json(
      {
        error: `Erro ao gerar ata com IA: ${details}`,
      },
      { status: 500 }
    );
  }
}
