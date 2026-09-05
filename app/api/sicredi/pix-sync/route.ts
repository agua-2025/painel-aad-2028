import { NextRequest, NextResponse } from "next/server";

import { listReceivedPix, getSicrediAccessToken } from "@/lib/sicredi/pix";
import { settlePixPayment } from "@/lib/pix/settlement";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getDefaultStartDate() {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date.toISOString();
}

function getDefaultEndDate() {
  return new Date().toISOString();
}

type SicrediReceivedPix = {
  endToEndId?: string;
  txid?: string;
  valor?: string | number;
  horario?: string;
};

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.PIX_SYNC_SECRET;

  if (!configuredSecret) {
    return NextResponse.json(
      {
        ok: false,
        message: "PIX_SYNC_SECRET não configurado.",
      },
      { status: 500 }
    );
  }

  const authorization = request.headers.get("authorization");
  const expectedAuthorization = `Bearer ${configuredSecret}`;

  if (authorization !== expectedAuthorization) {
    return NextResponse.json(
      {
        ok: false,
        message: "Não autorizado.",
      },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);

  const inicio =
    typeof body?.inicio === "string" && body.inicio.trim()
      ? body.inicio.trim()
      : getDefaultStartDate();

  const fim =
    typeof body?.fim === "string" && body.fim.trim()
      ? body.fim.trim()
      : getDefaultEndDate();

  const token = await getSicrediAccessToken();

  const sicrediResponse = await listReceivedPix({
    token: token.access_token,
    inicio,
    fim,
    txIdPresente: true,
  });

  const pixList = Array.isArray(sicrediResponse.pix)
    ? (sicrediResponse.pix as SicrediReceivedPix[])
    : [];

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
      payload: pix,
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
    message: "Sincronização Pix Sicredi concluída.",
    inicio,
    fim,
    total_received_from_sicredi: pixList.length,
    settled,
    already_settled: alreadySettled,
    failed,
    results,
  });
}
