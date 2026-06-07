import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  SYSTEM_HELP_ASSISTANT_RULES,
  SYSTEM_HELP_KNOWLEDGE,
} from "@/lib/ai/system-help-knowledge";
import { AAD_STATUTE_KNOWLEDGE } from "@/lib/ai/aad-statute-knowledge";
import { AAD_MINUTES_KNOWLEDGE } from "@/lib/ai/aad-minutes-knowledge";

type AssistantPayload = {
  question?: string;
  userProfile?: string;
  allowedModules?: string[];
};

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

    const body = (await request.json()) as AssistantPayload;

    const question = body.question?.trim();

    if (!question) {
      return NextResponse.json(
        { error: "Informe uma pergunta para o assistente." },
        { status: 400 }
      );
    }

    if (question.length > 1200) {
      return NextResponse.json(
        { error: "A pergunta está muito longa. Resuma a dúvida e tente novamente." },
        { status: 400 }
      );
    }

    const userProfile = body.userProfile?.trim() || "perfil não informado";
    const allowedModules = body.allowedModules ?? [];

    const prompt = `
${SYSTEM_HELP_ASSISTANT_RULES}

Perfil informado do usuário:
${userProfile}

Módulos permitidos informados:
${allowedModules.length > 0 ? allowedModules.join(", ") : "não informado"}

Base de conhecimento do sistema:
${SYSTEM_HELP_KNOWLEDGE}

Base de conhecimento do Estatuto Social:
${AAD_STATUTE_KNOWLEDGE}

Base de conhecimento da Ata de Constituição:
${AAD_MINUTES_KNOWLEDGE}

Pergunta do usuário:
${question}

Responda agora seguindo estas regras:
- Use português do Brasil.
- Responda de forma natural, como uma conversa normal.
- Prefira texto corrido, com 1 a 3 parágrafos curtos.
- Evite títulos, subtítulos, blocos muito separados e listas longas.
- Só use passo a passo quando o usuário perguntar como fazer uma tarefa prática no sistema.
- Quando a pergunta for simples, responda de forma direta, sem transformar em relatório.
- Quando citar Estatuto ou Ata, faça isso de forma natural dentro do texto.
- Se a pergunta envolver composição da Diretoria ou Comissão Fiscal, diga que a informação vem da Ata de Constituição e recomende confirmar a composição atual nos registros da Associação, se necessário.
- Se o perfil informado não puder executar a ação, explique isso de forma simples e oriente procurar o perfil responsável.
- Se o perfil informado for "associado" ou "interessado", responda somente sobre área do associado, cadastro, solicitação, termo, pagamentos do próprio associado, documentos, avisos, suporte, Estatuto e Ata.
- Se o perfil informado for "associado" ou "interessado" e a pergunta envolver rotinas internas do dashboard, como aprovar pagamento, gerar mensalidades, lançar despesas, backup, auditoria, fechamento mensal ou configurações, explique que essas rotinas são administrativas e devem ser tratadas pela Diretoria, Tesouraria ou Secretaria.
- Não invente funcionalidade.
- Não diga que executou algo.
- Não mencione detalhes técnicos internos da API.
- Não ultrapasse aproximadamente 1.400 caracteres.
`;

    const ai = new GoogleGenAI({ apiKey });

    const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"];
    let answer = "";
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        answer = cleanAiText(response.text || "");

        if (answer) {
          break;
        }
      } catch (error) {
        lastError = error;
        console.error(`Erro ao consultar o modelo ${model}:`, error);
      }
    }

    if (!answer) {
      console.error("Falha em todos os modelos do assistente:", lastError);

      return NextResponse.json(
        {
          error:
            "O assistente de IA está temporariamente indisponível. Aguarde alguns instantes e tente novamente.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Erro no assistente de uso do sistema:", error);

    return NextResponse.json(
      { error: "Não foi possível consultar o assistente no momento." },
      { status: 500 }
    );
  }
}
