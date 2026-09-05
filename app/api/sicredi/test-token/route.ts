import { NextResponse } from "next/server";
import { getSicrediAccessToken } from "@/lib/sicredi/pix";

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

    return NextResponse.json({
      ok: true,
      message: "Token Sicredi gerado com sucesso pelo backend.",
      token_type: token.token_type,
      expires_in: token.expires_in ?? null,
      has_access_token: Boolean(token.access_token),
    });
  } catch (error) {
    console.error("Erro ao testar token Sicredi:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível gerar token Sicredi pelo backend.",
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}
