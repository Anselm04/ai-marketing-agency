export function providerLocalDate(timeZone, now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(safeDate);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return safeDate.toISOString().slice(0, 10);
  }
}

export function applyDailySpendSnapshot({
  previousProviderTotalCents = 0,
  currentProviderTotalCents = 0,
  previousDailySpendCents = 0,
  previousDailySpendDate = null,
  currentDate,
  dailyCapCents,
}) {
  const previousTotal = Math.max(0, Number(previousProviderTotalCents) || 0);
  const currentTotal = Math.max(0, Number(currentProviderTotalCents) || 0);
  const incrementCents = Math.max(0, currentTotal - previousTotal);
  const priorDaily = previousDailySpendDate === currentDate
    ? Math.max(0, Number(previousDailySpendCents) || 0)
    : 0;
  const dailySpendCents = priorDaily + incrementCents;
  const cap = Math.max(0, Number(dailyCapCents) || 0);

  return {
    incrementCents,
    dailySpendCents,
    dailySpendDate: currentDate,
    dailyCapReached: cap > 0 && dailySpendCents >= cap,
  };
}

export function shouldAutoResumeDailyCap(budget, currentDate) {
  if (!budget || budget.status !== 'daily_capped' || budget.enabled !== true) return false;
  if (budget.hardStopReason !== 'daily_spend_cap_reached') return false;
  if (!budget.dailySpendDate || budget.dailySpendDate === currentDate) return false;
  if (Number(budget.remainingMediaBudgetCents || 0) <= 0) return false;
  return ['bounded_auto', 'full_auto'].includes(String(budget.spendAuthorization?.mode || '').toLowerCase());
}
