export function elapsedTickInterval(
  previousTimestamp: number | undefined,
  timestamp: number,
  fallbackMilliseconds: number,
): number {
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(fallbackMilliseconds) ||
    fallbackMilliseconds <= 0
  ) {
    throw new RangeError("Tick timestamps and fallback interval must be finite and positive");
  }

  if (previousTimestamp === undefined) return fallbackMilliseconds;
  const elapsed = timestamp - previousTimestamp;
  return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : fallbackMilliseconds;
}
