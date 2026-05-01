// Brazil is permanently UTC-3 (DST abolished in 2019)
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Returns a Date representing the current moment shifted to Brazil local time.
 * Use this instead of `new Date()` when computing month/day boundaries for
 * dashboard and report queries, so that 23:00 BR does not flip to the next UTC day.
 *
 * Dates in the DB are stored as UTC midnight of the user's local date
 * (e.g. "2026-04-30" → 2026-04-30T00:00:00Z), so filtering with BR-adjusted
 * boundaries produces consistent results.
 */
export function nowBR(): Date {
  return new Date(Date.now() - BR_OFFSET_MS);
}
