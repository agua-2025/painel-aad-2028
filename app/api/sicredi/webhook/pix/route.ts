import { NextRequest, NextResponse } from "next/server";

import { settlePixPayment } from "@/lib/pix/settlement";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SicrediWebhookPix = {
  endToEndId?: string;
  txid?: string;
  valor?: string | number;
  horario?: string;
};

function normalizePixPayload(payload: unknown): SicrediWebhookPix[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const body = payload as {
    pix?: SicrediWebhookPix[];
    endToEndId?: string;
    txid?: string;
    valor?: string | number;
    horario?: string;
  };

  if (Array.isArray(body.pix)) {
    return body.pix;
  }

  if (body.txid) {
    return [
      {
        endToEndId: body.endToEndId,
        txid: body.txid,
        valor: body.valor,
        horario: body.horario,
      },
    ];
  }

  return [];
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.PIX_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "PIX_WEBHOOK_SECRET não configurado.",
      },
      { status: 500 }
    );
  }

  const receivedSecret = request.nextUrl.searchParams.get("secret");

  if (receivedSecret !== webhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não autorizado.",
      },
      { status: 401 }
    );
  }

  const payload = await request.json().catch(() => null);
  const pixList = normalizePixPayload(payload);

  if (pixList.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Payload sem Pix válido para processamento.",
      },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const results = [];

  for (const pix of pixList) {
    if (!pix.txid) {
      results.push({
        ok: false,
        message: "Pix recebido sem txid. Ignorado.",
        pix,
      });

      continue;
    }

    const result = await settlePixPayment(supabase, {
      txid: pix.txid,
      endToEndId: pix.endToEndId ?? null,
      paidAt: pix.horario ?? new Date().toISOString(),
      amount: pix.valor !== undefined ? Number(pix.valor) : null,
      payload,
    });

    results.push({
      txid: pix.txid,
      endToEndId: pix.endToEndId ?? null,
      ...result,
    });
  }

  const settled = results.filter(
    (result) => result.ok && !result.already_settled
  ).length;

  const alreadySettled = results.filter(
    (result) => result.ok && result.already_settled
  ).length;

  const failed = results.filter((result) => !result.ok).length;

  return NextResponse.json({
    ok: true,
    message: "Webhook Pix Sicredi processado.",
    received: pixList.length,
    settled,
    already_settled: alreadySettled,
    failed,
    results,
  });
}
