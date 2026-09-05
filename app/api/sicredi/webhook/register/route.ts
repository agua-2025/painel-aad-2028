import { NextRequest, NextResponse } from "next/server";

import {
  getPixWebhook,
  getSicrediAccessToken,
  registerPixWebhook,
} from "@/lib/sicredi/pix";

export const runtime = "nodejs";

function getProductionBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  return "https://sistema.aaddireito2028.com.br";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function POST(request: NextRequest) {
  try {
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
        : getProductionBaseUrl();

    const webhookUrl = `${baseUrl}/api/sicredi/webhook/pix?secret=${encodeURIComponent(
      webhookSecret
    )}`;

    const token = await getSicrediAccessToken();

    const registerResponse = await registerPixWebhook({
      token: token.access_token,
      pixKey,
      webhookUrl,
    });

    let currentWebhook: unknown = null;
    let currentWebhookError: string | null = null;

    try {
      currentWebhook = await getPixWebhook({
        token: token.access_token,
        pixKey,
      });
    } catch (error) {
      currentWebhookError = getErrorMessage(error);
    }

    return NextResponse.json({
      ok: true,
      message: "Webhook Pix cadastrado/atualizado no Sicredi.",
      pix_key: pixKey,
      webhook_url: webhookUrl,
      register_response: registerResponse,
      current_webhook: currentWebhook,
      current_webhook_error: currentWebhookError,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Erro ao cadastrar webhook Pix no Sicredi.",
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
