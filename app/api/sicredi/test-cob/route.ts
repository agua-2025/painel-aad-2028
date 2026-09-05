import { NextResponse } from "next/server";
import {
  createImmediatePixCharge,
  getSicrediAccessToken,
} from "@/lib/sicredi/pix";

export const runtime = "nodejs";

function testRoutesEnabled() {
  return process.env.SICREDI_TEST_ROUTES_ENABLED === "true";
}

export async function GET() {
  if (!testRoutesEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Rota de teste não habilitada." },
      { status: 404 }
    );
  }

  try {
    const token = await getSicrediAccessToken();

    const charge = await createImmediatePixCharge(token.access_token, {
      cpf: "12345678909",
      nome: "Teste Associado AAD",
      valor: "1.00",
      expiracao: 3600,
      solicitacaoPagador:
        "Teste de cobrança Pix imediata gerada pelo backend do Painel AAD 2028.",
    });

    return NextResponse.json({
      ok: true,
      message: "Cobrança Pix imediata criada com sucesso pelo backend.",
      txid: charge.txid,
      status: charge.status ?? null,
      loc_id: charge.loc?.id ?? null,
      location: charge.loc?.location ?? charge.location ?? null,
      valor: charge.valor?.original ?? null,
      has_pix_copia_e_cola: Boolean(charge.pixCopiaECola),
    });
  } catch (error) {
    console.error("Erro ao criar cobrança teste Sicredi:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível criar cobrança Pix imediata pelo backend.",
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}
