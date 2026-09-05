import { NextRequest, NextResponse } from "next/server";

import { settlePixPayment } from "@/lib/pix/settlement";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (process.env.SICREDI_TEST_ROUTES_ENABLED !== "true") {
    return NextResponse.json(
      {
        ok: false,
        message: "Rota de teste desabilitada.",
      },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);

  const txid = typeof body?.txid === "string" ? body.txid : "";
  const amount =
    typeof body?.amount === "number" || typeof body?.amount === "string"
      ? Number(body.amount)
      : null;

  if (!txid) {
    return NextResponse.json(
      {
        ok: false,
        message: "Informe o txid.",
      },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const result = await settlePixPayment(supabase, {
    txid,
    amount,
    paidAt: new Date().toISOString(),
    endToEndId: `TESTE-${txid}`,
    payload: {
      origem: "rota_manual_de_teste",
      txid,
      amount,
    },
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
  });
}
