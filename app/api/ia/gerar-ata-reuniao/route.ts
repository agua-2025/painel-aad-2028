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
    const presidentName = String(body.presidentName ?? "").trim();
    const secretaryName = String(body.secretaryName ?? "").trim();

    if (!meeting?.title || !meeting?.meeting_date) {
      return NextResponse.json(
        { error: "Dados da reunião insuficientes para gerar a ata." },
        { status: 400 }
      );
    }

    const prompt = `
Você é responsável por redigir atas formais da Associação dos Acadêmicos do Curso de Direito – Turma de Formatura 2028 – AAD Direito 2028.

Elabore uma ATA em padrão formal tradicional, semelhante a atas de associações civis, usando exclusivamente os dados fornecidos pelo sistema.

A ata deve seguir este estilo:
- texto corrido;
- parágrafos objetivos;
- sem aparência de relatório;
- sem tópicos;
- sem markdown;
- sem negrito;
- sem asteriscos;
- sem emojis;
- sem colchetes;
- sem cabeçalhos como "1. ABERTURA", "2. PRESENÇAS" ou "3. PAUTAS";
- sem frases artificiais como "Reunião encerrada: sim", "informação não completa no sistema" ou "dados insuficientes";
- sem linguagem de chatbot;
- sem comentários antes ou depois da ata.

MODELO DE REDAÇÃO A SER SEGUIDO:
ATA DE REUNIÃO ORDINÁRIA DA ASSOCIAÇÃO DOS ACADÊMICOS DO CURSO DE DIREITO – AAD DIREITO 2028

Aos dez dias do mês de junho do ano de dois mil e vinte e seis, às dezenove horas, em modalidade online, por meio de link previamente disponibilizado aos associados, foi aberta a Reunião Ordinária da Associação dos Acadêmicos do Curso de Direito – AAD Direito 2028.

A Presidente, Sra. Aline Novakc Locate, iniciou os trabalhos saudando os membros presentes e, em seguida, declarou aberta a reunião.

Conforme registro e confirmação no sistema da Associação, esteve presente o associado Márcio Luiz Pereira.

Aberta a reunião, passou-se à apreciação da pauta prevista, consistente na definição do valor da mensalidade da Associação para o ano de 2026.

Submetida a matéria à votação, foram apresentadas as seguintes opções: R$ 40,00, R$ 50,00, R$ 60,00 e abstenção. Encerrada a votação, foi registrado o total de 1 voto, com o seguinte resultado: R$ 40,00, com 1 voto; R$ 50,00, com 0 votos; R$ 60,00, com 0 votos; e abstenção, com 0 votos.

Dessa forma, restou aprovada a fixação da mensalidade da Associação dos Acadêmicos do Curso de Direito – AAD Direito 2028, para o ano de 2026, no valor de R$ 40,00.

Nada mais havendo a tratar, a Presidente declarou encerrada a reunião, ocasião em que a Secretária, Sra. Claudia Braga Babilônia Faria dos Santos, lavrou a presente ata, que, após lida e aprovada, será assinada pelos responsáveis.

____________________________________
Aline Novakc Locate
Presidente

____________________________________
Claudia Braga Babilônia Faria dos Santos
Secretária

REGRAS DE CONTEÚDO:
- Use o modelo acima apenas como referência de estilo, não copie os dados do exemplo.
- Use os dados reais enviados pelo sistema.
- A ata deve começar diretamente pelo título.
- O título deve ser em caixa alta.
- Se a reunião tiver nome ou tipo que indique "ordinária", use "ATA DE REUNIÃO ORDINÁRIA...".
- Se a reunião indicar "extraordinária", use "ATA DE REUNIÃO EXTRAORDINÁRIA...".
- Se não for possível identificar se é ordinária ou extraordinária, use "ATA DE REUNIÃO DA ASSOCIAÇÃO...".
- A abertura deve informar data, horário, modalidade e local/link.
- A Presidente deve ser descrita como quem iniciou os trabalhos e declarou aberta a reunião, quando houver nome informado.
- A Secretária deve ser descrita como quem lavrou a ata, quando houver nome informado.
- As presenças devem ser registradas em parágrafo próprio.
- Se houver apenas uma pessoa presente, escreva "esteve presente o associado..." ou "esteve presente a associada...", conforme o nome não indicar claramente gênero, prefira "esteve presente o(a) associado(a)" apenas se necessário.
- Não invente quórum.
- Não invente debates.
- Não invente deliberações.
- Se houver informações complementares, incorpore naturalmente ao texto.
- Em votação, informe opções e votos no mesmo padrão do modelo.
- Se houver opção vencedora, registre a aprovação decorrente da votação.
- Se não houver voto registrado, diga de forma simples que não houve voto registrado para a pauta.
- No encerramento, use a fórmula "Nada mais havendo a tratar...".
- Finalize com assinatura da Presidência e da Secretaria.
- Use exatamente os nomes informados quando existirem.

DADOS DA REUNIÃO:
${JSON.stringify(meeting, null, 2)}

NOME DA PRESIDENTE/CONDUTORA DA REUNIÃO:
${presidentName || "Não informado"}

NOME DA SECRETÁRIA/RESPONSÁVEL PELA LAVRATURA:
${secretaryName || "Não informado"}

PRESENÇAS CONFIRMADAS:
${JSON.stringify(attendance, null, 2)}

PAUTAS, ALTERNATIVAS E VOTAÇÕES:
${JSON.stringify(agendaItems, null, 2)}

INFORMAÇÕES COMPLEMENTARES:
${additionalInfo || "Não foram informadas informações complementares."}

Gere somente o texto da ata, em português do Brasil, seguindo rigorosamente o padrão formal acima.
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
