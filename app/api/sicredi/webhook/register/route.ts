import { NextRequest, NextResponse } from "next/server";

import {
  getPixWebhook,
  getSicrediAccessToken,
  registerPixWebhook,
} from "@/lib/sicredi/pix";

export const runtime = "nodejs";

function getProductionBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://sistema.aaddireito2028.com.br"
  );
}

export async function POST(request: NextRequest) {
  const syncSecret = process.env.PIX_SYNC_SECRET;
  const webhookSecret = process.env.PIX_WEBHOOK_SECRET;
  const pixKey = process.env.SICREDI_PIX_KEY;

  if (!syncSecret) {
    return NextResponse.json(
      { ok: false, message: "PIX_SYNC_SECRET não configurado." },
      { status: 500 }
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, message: "PIX_WEBHOOK_SECRET não configurado." },
      { status: 500 }
    );
  }

  if (!pixKey) {
    return NextResponse.json(
      { ok: false, message: "SICREDI_PIX_KEY não configurado." },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${syncSecret}`) {
    return NextResponse.json(
      { ok: false, message: "Não autorizado." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);

  const baseUrl =
    typeof body?.baseUrl === "string" && body.baseUrl.trim()
      ? body.baseUrl.trim().replace(/\/$/, "")
      : getProductionBaseUrl().replace(/\/$/, "");

  const webhookUrl = `${baseUrl}/api/sicredi/webhook/pix?secret=${encodeURIComponent(
    webhookSecret
  )}`;

  const token = await getSicrediAccessToken();

  const registerResponse = await registerPixWebhook({
    token: token.access_token,
    pixKey,
    webhookUrl,
  });

  const currentWebhook = await getPixWebhook({
    token: token.access_token,
    pixKey,
  });

  return NextResponse.json({
    ok: true,
    message: "Webhook Pix cadastrado/atualizado no Sicredi.",
    pix_key: pixKey,
    webhook_url: webhookUrl,
    register_response: registerResponse,
    current_webhook: currentWebhook,
  });
}
