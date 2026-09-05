type RelatedFinancialSettings =
  | {
      late_fee_grace_days?: number | null;
    }
  | {
      late_fee_grace_days?: number | null;
    }[]
  | null
  | undefined;

type MonthlyFeeChargeItem = {
  base_amount?: number | null;
  paid_amount?: number | null;
  due_date?: string | null;
  late_fee_percent?: number | null;
  daily_interest_percent?: number | null;
  financial_settings?: RelatedFinancialSettings;
};

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

function normalizeSingle<T>(value: T | T[] | null | undefined): T | null {
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

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function calculateLateCharges(params: {
  baseAmount: number;
  paidAmount: number;
  dueDateValue?: string | null;
  referenceDateValue: string | Date;
  lateFeePercent?: number | null;
  dailyInterestPercent?: number | null;
  graceDays?: number | null;
  applyLateCharges: boolean;
}) {
  const {
    baseAmount,
    paidAmount,
    dueDateValue,
    referenceDateValue,
    lateFeePercent,
    dailyInterestPercent,
    graceDays,
    applyLateCharges,
  } = params;

  const emptyResult = {
    baseAmount,
    paidAmount,
    applyLateCharges,
    daysAfterDue: 0,
    daysWithCharges: 0,
    lateFeeAmount: 0,
    interestAmount: 0,
    totalDue: baseAmount,
    remaining: Math.max(baseAmount - paidAmount, 0),
  };

  if (!applyLateCharges) {
    return emptyResult;
  }

  const dueDate = parseDateOnly(dueDateValue);
  const referenceDate = parseDateOnly(referenceDateValue);

  if (!dueDate || !referenceDate) {
    return emptyResult;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysAfterDue = Math.floor(
    (referenceDate.getTime() - dueDate.getTime()) / millisecondsPerDay
  );

  const daysWithCharges = Math.max(daysAfterDue - Number(graceDays ?? 0), 0);

  const lateFeeAmount =
    daysWithCharges > 0
      ? roundMoney(baseAmount * (Number(lateFeePercent ?? 0) / 100))
      : 0;

  const interestAmount =
    daysWithCharges > 0
      ? roundMoney(
          baseAmount *
            (Number(dailyInterestPercent ?? 0) / 100) *
            daysWithCharges
        )
      : 0;

  const totalDue = roundMoney(baseAmount + lateFeeAmount + interestAmount);

  return {
    baseAmount,
    paidAmount,
    applyLateCharges,
    daysAfterDue,
    daysWithCharges,
    lateFeeAmount,
    interestAmount,
    totalDue,
    remaining: Math.max(totalDue - paidAmount, 0),
  };
}

function getMonthlyGraceDays(item: MonthlyFeeChargeItem | null | undefined) {
  const settings = normalizeSingle(item?.financial_settings);

  return Number(settings?.late_fee_grace_days ?? 0);
}

export function calculateMonthlyFeeAmountDue(
  item: MonthlyFeeChargeItem | null | undefined,
  asOfDate: string | Date = new Date()
) {
  const baseAmount = Number(item?.base_amount ?? 0);
  const paidAmount = Number(item?.paid_amount ?? 0);

  return calculateLateCharges({
    baseAmount,
    paidAmount,
    dueDateValue: item?.due_date,
    referenceDateValue: asOfDate,
    lateFeePercent: item?.late_fee_percent,
    dailyInterestPercent: item?.daily_interest_percent,
    graceDays: getMonthlyGraceDays(item),
    applyLateCharges: true,
  });
}

export function calculateExtraContributionAmountDue(
  item: ExtraContributionChargeItem | null | undefined,
  asOfDate: string | Date = new Date()
) {
  const baseAmount = Number(item?.amount ?? 0);
  const paidAmount = Number(item?.paid_amount ?? 0);
  const contribution = normalizeSingle(item?.extra_contributions);

  return calculateLateCharges({
    baseAmount,
    paidAmount,
    dueDateValue: item?.due_date,
    referenceDateValue: asOfDate,
    lateFeePercent: contribution?.late_fee_percent,
    dailyInterestPercent: contribution?.daily_interest_percent,
    graceDays: contribution?.late_fee_grace_days,
    applyLateCharges: Boolean(contribution?.apply_late_charges),
  });
}
