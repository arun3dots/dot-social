export const CADENCE_DAYS = { daily: 1, '3day': 3, weekly: 7 } as const;
export type Cadence = keyof typeof CADENCE_DAYS;
export const CADENCES: Cadence[] = ['daily', '3day', 'weekly'];

/** Hard ceiling: never generate more than a week of content in one batch. */
export const MAX_HORIZON_DAYS = 7;

export function daysForCadence(cadence: string | null | undefined): number {
  const c = (cadence || 'weekly') as Cadence;
  return CADENCE_DAYS[c] ?? 3;
}

export function clampHorizon(days: number): number {
  if (!Number.isFinite(days)) return 3;
  return Math.min(Math.max(Math.trunc(days), 1), MAX_HORIZON_DAYS);
}
