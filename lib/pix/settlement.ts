import { SupabaseClient } from "@supabase/supabase-js";

type PixCharge = {
  id: string;
  associate_id: string;
  monthly_fee_id: string | null;
  extra_contribution_item_id: string | null;
  txid: string;
  status: string;
  updated_amount: number;
  paid_at: string | null;
  end_to_end_id: string | null;
};

type SettlePixInput = {
  txid: string;
  endToEndId?: string | null;
  paidAt?: string | null;
  amount?: number | null;
  payload?: unknown;
};

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);

  if (Number.isNaN(numberValue)) {
    return 0;
  }

  return numberValue;
}

export async function settlePixPayment(
  supabase: SupabaseClient,
  input: SettlePixInput
) {
  const txid = input.txid?.trim();

  if (!txid) {
    return {
      ok: false,
      message: "TXID não informado.",
    };
  }

  const { data: charge, error: chargeError } = await supabase
    .from("pix_charges")
    .select(
      "id, associate_id, monthly_fee_id, extra_contribution_item_id, txid, status, updated_amount, paid_at, end_to_end_id"
    )
    .eq("txid", txid)
    .maybeSingle<PixCharge>();

  if (chargeError) {
    return {
      ok: false,
      message: "Erro ao consultar cobrança Pix.",
      error: chargeError.message,
    };
  }

  if (!charge) {
    return {
      ok: false,
      message: "Cobrança Pix não localizada para o TXID informado.",
    };
  }

  if (charge.status === "paga") {
    return {
      ok: true,
      already_settled: true,
      message: "Cobrança Pix já estava baixada.",
      pix_charge_id: charge.id,
    };
  }

  const paidAt = input.paidAt ?? new Date().toISOString();
  const paidAmount = toNumber(input.amount ?? charge.updated_amount);
  const endToEndId = input.endToEndId ?? null;

  if (paidAmount <= 0) {
    return {
      ok: false,
      message: "Valor pago inválido para baixa.",
    };
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    associate_id: charge.associate_id,
    monthly_fee_id: charge.monthly_fee_id,
    extra_contribution_item_id: charge.extra_contribution_item_id,
    amount: paidAmount,
    paid_at: paidAt,
    payment_method: "pix",
    reference: endToEndId ?? charge.txid,
    notes: `Baixa automática Pix Sicredi. TXID: ${charge.txid}`,
  });

  if (paymentError) {
    return {
      ok: false,
      message: "Erro ao registrar pagamento.",
      error: paymentError.message,
    };
  }

  if (charge.monthly_fee_id) {
    const { data: fee, error: feeError } = await supabase
      .from("monthly_fees")
      .select("id, base_amount, paid_amount")
      .eq("id", charge.monthly_fee_id)
      .maybeSingle();

    if (feeError || !fee) {
      return {
        ok: false,
        message: "Pagamento registrado, mas mensalidade não foi localizada para atualização.",
        error: feeError?.message,
      };
    }

    const newPaidAmount = toNumber(fee.paid_amount) + paidAmount;
    const baseAmount = toNumber(fee.base_amount);
    const newStatus = newPaidAmount >= baseAmount ? "paga" : "parcialmente_paga";

    const { error: updateFeeError } = await supabase
      .from("monthly_fees")
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        paid_at: newStatus === "paga" ? paidAt : null,
      })
      .eq("id", charge.monthly_fee_id);

    if (updateFeeError) {
      return {
        ok: false,
        message: "Pagamento registrado, mas houve erro ao atualizar a mensalidade.",
        error: updateFeeError.message,
      };
    }
  }

  if (charge.extra_contribution_item_id) {
    const { data: item, error: itemError } = await supabase
      .from("extra_contribution_items")
      .select("id, amount, paid_amount")
      .eq("id", charge.extra_contribution_item_id)
      .maybeSingle();

    if (itemError || !item) {
      return {
        ok: false,
        message: "Pagamento registrado, mas contribuição extra não foi localizada para atualização.",
        error: itemError?.message,
      };
    }

    const newPaidAmount = toNumber(item.paid_amount) + paidAmount;
    const itemAmount = toNumber(item.amount);
    const newStatus = newPaidAmount >= itemAmount ? "paga" : "parcialmente_paga";

    const { error: updateItemError } = await supabase
      .from("extra_contribution_items")
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
      })
      .eq("id", charge.extra_contribution_item_id);

    if (updateItemError) {
      return {
        ok: false,
        message: "Pagamento registrado, mas houve erro ao atualizar a contribuição extra.",
        error: updateItemError.message,
      };
    }
  }

  const { error: chargeUpdateError } = await supabase
    .from("pix_charges")
    .update({
      status: "paga",
      paid_at: paidAt,
      end_to_end_id: endToEndId,
      webhook_payload: input.payload ?? null,
    })
    .eq("id", charge.id);

  if (chargeUpdateError) {
    return {
      ok: false,
      message: "Pagamento baixado, mas houve erro ao atualizar a cobrança Pix.",
      error: chargeUpdateError.message,
    };
  }

  return {
    ok: true,
    already_settled: false,
    message: "Pagamento Pix baixado com sucesso.",
    pix_charge_id: charge.id,
    monthly_fee_id: charge.monthly_fee_id,
    extra_contribution_item_id: charge.extra_contribution_item_id,
  };
}
