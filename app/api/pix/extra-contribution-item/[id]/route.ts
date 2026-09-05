import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  createImmediatePixCharge,
  getSicrediAccessToken,
} from "@/lib/sicredi/pix";
import { calculateExtraContributionAmountDue } from "@/lib/financialCharges";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function formatPixAmount(value: number) {
  return value.toFixed(2);
}

function normalizeCpf(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function createRequestSupabaseClient(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Variáveis públicas do Supabase não configuradas.");
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Esta rota apenas lê a sessão atual e gera cobrança Pix.
      },
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await context.params;

    const authSupabase = createRequestSupabaseClient(request);
    const supabase = createServiceClient();

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json(
        { ok: false, message: "Usuário não autenticado ou sessão expirada." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: approvedRequest } = await supabase
      .from("membership_requests")
      .select("id, profile_id, email, cpf, status")
      .or(`email.eq.${user.email}${profile?.id ? `,profile_id.eq.${profile.id}` : ""}`)
      .eq("status", "aprovada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const associateFilter = approvedRequest?.cpf
      ? `email.eq.${user.email},cpf.eq.${approvedRequest.cpf}`
      : `email.eq.${user.email}`;

    const { data: associate, error: associateError } = await supabase
      .from("associates")
      .select("id, full_name, cpf, email, status")
      .or(associateFilter)
      .maybeSingle();

    if (associateError || !associate || associate.status !== "ativo") {
      return NextResponse.json(
        { ok: false, message: "Associado ativo não localizado." },
        { status: 403 }
      );
    }

    if (!associate.cpf) {
      return NextResponse.json(
        { ok: false, message: "Seu cadastro não possui CPF para geração do Pix." },
        { status: 400 }
      );
    }

    const { data: item, error: itemError } = await supabase
      .from("extra_contribution_items")
      .select(
        "id, contribution_id, associate_id, amount, paid_amount, due_date, status, extra_contributions(id, title, description, reason, status, apply_late_charges, late_fee_percent, daily_interest_percent, late_fee_grace_days)"
      )
      .eq("id", itemId)
      .eq("associate_id", associate.id)
      .maybeSingle();

    if (itemError) {
      throw new Error(`Erro ao buscar contribuição extra: ${itemError.message}`);
    }

    if (!item) {
      return NextResponse.json(
        { ok: false, message: "Contribuição extra não localizada para este associado." },
        { status: 404 }
      );
    }

    if (!["pendente", "parcialmente_paga", "atrasada"].includes(item.status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Esta contribuição extra não está em aberto para pagamento por Pix.",
          status: item.status,
        },
        { status: 400 }
      );
    }

    const contribution = normalizeSingle(item.extra_contributions);

    if (!contribution || !["ativa", "encerrada"].includes(contribution.status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "A cobrança de contribuição extra não está disponível para Pix.",
        },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const amountDue = calculateExtraContributionAmountDue(item, today);
    const pixAmount = Number(amountDue.remaining.toFixed(2));

    if (pixAmount <= 0) {
      return NextResponse.json(
        { ok: false, message: "Esta contribuição extra não possui saldo em aberto." },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();

    const { data: existingCharge, error: existingChargeError } = await supabase
      .from("pix_charges")
      .select(
        "id, txid, status, original_amount, updated_amount, expires_at, pix_copia_e_cola, location, loc_id, created_at"
      )
      .eq("extra_contribution_item_id", item.id)
      .eq("status", "ativa")
      .gt("expires_at", nowIso)
      .eq("updated_amount", pixAmount)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingChargeError) {
      throw new Error(
        `Erro ao verificar cobrança Pix existente: ${existingChargeError.message}`
      );
    }

    if (existingCharge) {
      return NextResponse.json({
        ok: true,
        reused: true,
        message: "Cobrança Pix ativa reaproveitada.",
        pix_charge: existingCharge,
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
      });
    }

    await supabase
      .from("pix_charges")
      .update({ status: "expirada" })
      .eq("extra_contribution_item_id", item.id)
      .eq("status", "ativa")
      .lte("expires_at", nowIso);

    const token = await getSicrediAccessToken();

    const charge = await createImmediatePixCharge(token.access_token, {
      cpf: normalizeCpf(associate.cpf),
      nome: associate.full_name,
      valor: formatPixAmount(pixAmount),
      expiracao: 3600,
      solicitacaoPagador:
        `Contribuição extra: ${contribution.title ?? "Associação Acadêmica de Direito 2028"}.`,
    });

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    const { data: savedCharge, error: saveError } = await supabase
      .from("pix_charges")
      .insert({
        associate_id: associate.id,
        extra_contribution_item_id: item.id,
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
        "id, txid, status, original_amount, updated_amount, expires_at, pix_copia_e_cola, location, loc_id, created_at"
      )
      .single();

    if (saveError) {
      throw new Error(`Erro ao salvar cobrança Pix: ${saveError.message}`);
    }

    return NextResponse.json({
      ok: true,
      reused: false,
      message: "Cobrança Pix criada com sucesso.",
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
    });
  } catch (error) {
    console.error("Erro ao gerar Pix da contribuição extra:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Não foi possível gerar o Pix da contribuição extra.",
        error: error instanceof Error ? error.message : "Erro desconhecido.",
      },
      { status: 500 }
    );
  }
}
