type ExtraContributionChargeSettings = {
  apply_late_charges?: boolean | null;
  late_fee_percent?: number | null;
  daily_interest_percent?: number | null;
  late_fee_grace_days?: number | null;
};

type ExtraContributionChargeItem = {
  amount?: number | null;
  paid_amount?: number | null;
  due_date?: string | null;
  extra_contributions?:
    | ExtraContributionChargeSettings
    | ExtraContributionChargeSettings[]
    | null;
};

function normalizeContribution(
  value:
    | ExtraContributionChargeSettings
    | ExtraContributionChargeSettings[]
    | null
    | undefined
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseDateOnly(value: string | Date | null | undefined) {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateExtraContributionAmountDue(
  item: ExtraContributionChargeItem | null | undefined,
  asOfDate: string | Date = new Date()
) {
  const baseAmount = Number(item?.amount ?? 0);
  const paidAmount = Number(item?.paid_amount ?? 0);
  const contribution = normalizeContribution(item?.extra_contributions);

  const emptyResult = {
    baseAmount,
    paidAmount,
    applyLateCharges: false,
    daysAfterDue: 0,
    daysWithCharges: 0,
    lateFeeAmount: 0,
    interestAmount: 0,
    totalDue: baseAmount,
    remaining: Math.max(baseAmount - paidAmount, 0),
  };

  if (!item || !contribution?.apply_late_charges) {
    return emptyResult;
  }

  const dueDate = parseDateOnly(item.due_date);
  const referenceDate = parseDateOnly(asOfDate);

  if (!dueDate || !referenceDate) {
    return emptyResult;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysAfterDue = Math.floor(
    (referenceDate.getTime() - dueDate.getTime()) / millisecondsPerDay
  );

  const graceDays = Number(contribution.late_fee_grace_days ?? 0);
  const daysWithCharges = Math.max(daysAfterDue - graceDays, 0);

  const lateFeeAmount =
    daysWithCharges > 0
      ? Number(
          (
            baseAmount *
            (Number(contribution.late_fee_percent ?? 0) / 100)
          ).toFixed(2)
        )
      : 0;

  const interestAmount =
    daysWithCharges > 0
      ? Number(
          (
            baseAmount *
            (Number(contribution.daily_interest_percent ?? 0) / 100) *
            daysWithCharges
          ).toFixed(2)
        )
      : 0;

  const totalDue = Number(
    (baseAmount + lateFeeAmount + interestAmount).toFixed(2)
  );

  return {
    baseAmount,
    paidAmount,
    applyLateCharges: true,
    daysAfterDue,
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
    remaining: Math.max(totalDue - paidAmount, 0),
  };
}
