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
  memberContext?: {
    associateName?: string;
    financialStatus?: string | null;
    openMonthlyFeesCount?: number;
    openMonthlyFeesTotal?: number;
    overdueMonthlyFeesCount?: number;
    openMonthlyFees?: string[];
    openExtraContributionsCount?: number;
    openExtraContributionsTotal?: number;
    openExtraContributions?: string[];
    totalPaid?: number;
    lastPayments?: string[];
    pendingPaymentReportsCount?: number;
    approvedPaymentReportsCount?: number;
    rejectedPaymentReportsCount?: number;
    lastPaymentReports?: string[];
  };
};


const MEETINGS_AND_MINUTES_KNOWLEDGE = `
MÓDULO REUNIÕES E ATAS

O sistema possui um módulo administrativo chamado "Reuniões e Atas", acessível no Painel Administrativo por perfis autorizados da Diretoria, como administrador, presidente, vice-presidente e secretaria, conforme permissões configuradas.

ÁREA ADMINISTRATIVA DO MÓDULO:
1. Cadastrar reunião:
- Permite criar reunião, informar título, data, horário, local/modalidade, pautas e alternativas de votação.
- A reunião deve respeitar antecedência mínima de 3 dias para convocação.
- As pautas podem ou não exigir votação.
- Quando houver votação, podem ser cadastradas alternativas para escolha dos associados.

2. Realizar reunião:
- Permite operar a reunião no dia e horário definidos.
- O sistema acompanha presenças confirmadas, quórum, início, abertura de votação, encerramento de votação e encerramento da reunião.
- A presença do associado só é liberada a partir do horário da reunião.
- No horário da reunião, o início depende do quórum de primeira chamada.
- Se não houver quórum de primeira chamada, o sistema mantém o início bloqueado.
- Após 15 minutos do horário previsto, a reunião pode ser iniciada em segunda chamada com os presentes, desde que exista pelo menos uma presença confirmada.
- A Diretoria abre a votação de cada pauta.
- O associado só consegue votar em pauta com votação aberta.
- Depois de encerrada a votação, os votos ficam registrados para apuração e ata.

3. Histórico e pesquisa:
- Permite consultar reuniões anteriores, reuniões encerradas, pautas, presenças e registros do módulo.

4. Atas:
- Permite gerar ata formal com IA a partir dos dados reais da reunião.
- A IA da ata usa informações da reunião, presentes, pautas, alternativas, votos e encerramento.
- A ata deve ser formal, em texto corrido, com linguagem institucional.
- A ata final, depois de salva como final, fica bloqueada para edição.
- A ata pode conter relação simples dos associados presentes, sem campo de assinatura individual, pois a presença é registrada eletronicamente.

5. Relatório de votação:
- É relatório administrativo interno.
- Mostra reunião, data, horário, início, encerramento, associados presentes, horário de confirmação da presença, resultado por opção e voto por associado presente.
- Também mostra quem esteve presente e não votou.
- Como identifica voto por associado, deve ser tratado como informação interna da Diretoria, e não como conteúdo público geral.

ÁREA DO ASSOCIADO:
- O associado acessa o módulo pela área pessoal em "Reuniões".
- Pode visualizar reuniões convocadas ou em andamento.
- Pode confirmar presença somente a partir do horário da reunião.
- Pode votar apenas se tiver presença confirmada.
- Só pode votar enquanto a votação da pauta estiver aberta.
- Depois de votar em uma pauta, não pode alterar o voto.
- O associado comum não acessa o relatório interno de votação nem as rotinas administrativas de abertura, encerramento, geração de ata ou operação da reunião.

REGRAS DE ORIENTAÇÃO:
- Se usuário da Diretoria perguntar como cadastrar, realizar, encerrar reunião, abrir votação, gerar ata ou consultar relatório, explique o caminho pelo Painel Administrativo.
- Se associado perguntar sobre reunião, explique apenas como acessar a área pessoal, confirmar presença e votar.
- Se associado perguntar sobre relatório de votação, votos de outros associados ou rotinas internas, explique que isso é informação administrativa interna da Diretoria.
- Não diga que o sistema permite alterar voto depois de confirmado.
- Não diga que a reunião pode iniciar antes do horário.
- Não diga que segunda chamada dispensa totalmente presença; precisa existir pelo menos uma presença confirmada.
`;

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
    const memberContext = body.memberContext;

    const prompt = `
${SYSTEM_HELP_ASSISTANT_RULES}

Perfil informado do usuário:
${userProfile}

Módulos permitidos informados:
${allowedModules.length > 0 ? allowedModules.join(", ") : "não informado"}

Contexto financeiro do associado logado:
${
  memberContext
    ? JSON.stringify(memberContext, null, 2)
    : "nenhum contexto financeiro informado"
}

Base de conhecimento do sistema:
${SYSTEM_HELP_KNOWLEDGE}

Base de conhecimento do Estatuto Social:
${AAD_STATUTE_KNOWLEDGE}

Base de conhecimento da Ata de Constituição:
${AAD_MINUTES_KNOWLEDGE}

Base de conhecimento atualizada do módulo Reuniões e Atas:
${MEETINGS_AND_MINUTES_KNOWLEDGE}

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
- Se o perfil informado for "associado" ou "interessado", responda somente sobre área do associado, cadastro, solicitação, termo, pagamentos do próprio associado, documentos, avisos, suporte, Estatuto, Ata e participação em reuniões pela área pessoal.
- Se houver contexto financeiro do associado logado, use esses dados para responder perguntas sobre mensalidades em aberto, contribuições extras, pagamentos realizados e informes pendentes.
- Se o associado perguntar se um pagamento foi aprovado, verifique primeiro lastPaymentReports, approvedPaymentReportsCount, pendingPaymentReportsCount e rejectedPaymentReportsCount.
- Se houver informe pendente, explique que ainda aguarda análise da Tesouraria.
- Se houver informe aprovado, diga que consta informe aprovado/baixado no histórico, usando a informação disponível.
- Se não houver informe pendente nem cobrança em aberto, explique de forma simples que, pelo contexto atual, não há pendência financeira registrada.
- Se não houver informação suficiente sobre o informe específico, oriente consultar a seção Pagamentos e, se necessário, falar com a Tesouraria.
- Se o associado perguntar quanto está devendo e houver dados financeiros no contexto, responda com quantidade e valor total, separando mensalidades e contribuições extras quando possível.
- Se não houver dados financeiros no contexto, oriente o associado a consultar a área Financeiro ou Contribuições Extras.
- Se o perfil informado for "associado" ou "interessado" e a pergunta envolver rotinas internas do dashboard, como aprovar pagamento, gerar mensalidades, lançar despesas, backup, auditoria, fechamento mensal, configurações, operar reunião, abrir votação, encerrar reunião, gerar ata ou consultar relatório interno de votação, explique que essas rotinas são administrativas e devem ser tratadas pela Diretoria, Tesouraria ou Secretaria.
- Se o associado perguntar sobre reuniões, explique que ele pode acessar a área pessoal, abrir o menu Reuniões, confirmar presença no horário liberado e votar apenas enquanto a votação estiver aberta.
- Se a pergunta envolver relatório de votação com identificação de voto por associado, explique que é relatório administrativo interno da Diretoria.
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
