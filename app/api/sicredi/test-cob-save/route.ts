import { NextRequest, NextResponse } from "next/server";
import {
  createImmediatePixCharge,
  getSicrediAccessToken,
} from "@/lib/sicredi/pix";
import { calculateMonthlyFeeAmountDue } from "@/lib/financialCharges";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function testRoutesEnabled() {
  return process.env.SICREDI_TEST_ROUTES_ENABLED === "true";
}

function formatPixAmount(value: number) {
  return value.toFixed(2);
}

export async function GET(request: NextRequest) {
  if (!testRoutesEnabled()) {
    return NextResponse.json(
      { ok: false, message: "Rota de teste não habilitada." },
      { status: 404 }
    );
  }

  const monthlyFeeId = request.nextUrl.searchParams.get("monthly_fee_id");

  if (!monthlyFeeId) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Informe o parâmetro monthly_fee_id para gerar uma cobrança Pix teste.",
        example:
          "/api/sicredi/test-cob-save?monthly_fee_id=ID_DA_MENSALIDADE",
      },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceClient();

    const { data: monthlyFee, error: monthlyFeeError } = await supabase
      .from("monthly_fees")
      .select(
        "id, associate_id, year, month, base_amount, due_date, late_fee_percent, daily_interest_percent, paid_amount, status, associates(id, full_name, cpf, email, status), financial_settings(late_fee_grace_days)"
      )
      .eq("id", monthlyFeeId)
      .maybeSingle();

    if (monthlyFeeError) {
      throw new Error(`Erro ao buscar mensalidade teste: ${monthlyFeeError.message}`);
    }

    if (!monthlyFee) {
      return NextResponse.json(
        { ok: false, message: "Mensalidade não localizada." },
        { status: 404 }
      );
    }

    if (!["pendente", "parcialmente_paga", "atrasada"].includes(monthlyFee.status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "A mensalidade informada não está em aberto para geração de Pix.",
          status: monthlyFee.status,
        },
        { status: 400 }
      );
    }

    const associate = Array.isArray(monthlyFee.associates)
      ? monthlyFee.associates[0]
      : monthlyFee.associates;

    if (!associate || associate.status !== "ativo") {
      return NextResponse.json(
        {
          ok: false,
          message: "Associado da mensalidade não localizado ou não está ativo.",
        },
        { status: 400 }
      );
    }

    if (!associate.cpf) {
      return NextResponse.json(
        {
          ok: false,
          message: "Associado não possui CPF cadastrado.",
        },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const amountDue = calculateMonthlyFeeAmountDue(monthlyFee, today);
    const pixAmount = Number(amountDue.remaining.toFixed(2));

    if (pixAmount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "A mensalidade informada não possui saldo em aberto para Pix.",
          monthly_fee_id: monthlyFee.id,
        },
        { status: 400 }
      );
    }

    const token = await getSicrediAccessToken();

    const charge = await createImmediatePixCharge(token.access_token, {
      cpf: String(associate.cpf).replace(/\D/g, ""),
      nome: associate.full_name,
      valor: formatPixAmount(pixAmount),
      expiracao: 3600,
      solicitacaoPagador:
        `Mensalidade ${monthlyFee.month}/${monthlyFee.year} da Associação Acadêmica de Direito 2028.`,
    });

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    const { data: savedCharge, error: saveError } = await supabase
      .from("pix_charges")
      .insert({
        associate_id: associate.id,
        monthly_fee_id: monthlyFee.id,
        txid: charge.txid,
        loc_id: charge.loc?.id ? String(charge.loc.id) : null,
        location: charge.loc?.location ?? charge.location ?? null,
        pix_copia_e_cola: charge.pixCopiaECola ?? null,
        original_amount: amountDue.baseAmount,
        updated_amount: pixAmount,
        status: "ativa",
        expires_at: expiresAt,
        sicredi_response: charge,
      })
      .select(
        "id, associate_id, monthly_fee_id, txid, status, original_amount, updated_amount, expires_at, created_at"
      )
      .single();

    if (saveError) {
      throw new Error(`Erro ao salvar cobrança Pix: ${saveError.message}`);
    }

    return NextResponse.json({
      ok: true,
      message:
        "Cobrança Pix teste criada no Sicredi e salva com valor atualizado da mensalidade informada.",
      pix_charge: savedCharge,
      calculation: {
        base_amount: amountDue.baseAmount,
        paid_amount: amountDue.paidAmount,
        days_with_charges: amountDue.daysWithCharges,
        late_fee_amount: amountDue.lateFeeAmount,
        interest_amount: amountDue.interestAmount,
        total_due: amountDue.totalDue,
        remaining: amountDue.remaining,
        pix_amount: pixAmount,
      },
      sicredi: {
        txid: charge.txid,
        status: charge.status ?? null,
        loc_id: charge.loc?.id ?? null,
        valor: charge.valor?.original ?? null,
        has_pix_copia_e_cola: Boolean(charge.pixCopiaECola),
      },
    });
  } catch (error) {
    console.error("Erro ao criar e salvar cobrança teste Sicredi:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível criar e salvar cobrança Pix teste.",
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}
