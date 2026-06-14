/** Resolve how long a student spent on an item (seconds). */

export function resolveAttemptDurationSeconds(params: {
  totalTimeSeconds?: number | null;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
}): number | null {
  const fromTimestamps = (() => {
    if (!params.startedAt || !params.endedAt) return null;
    const start =
      params.startedAt instanceof Date ? params.startedAt : new Date(params.startedAt);
    const end = params.endedAt instanceof Date ? params.endedAt : new Date(params.endedAt);
    const ms = end.getTime() - start.getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    return ms / 1000;
  })();

  const client =
    typeof params.totalTimeSeconds === "number" &&
    Number.isFinite(params.totalTimeSeconds) &&
    params.totalTimeSeconds > 0
      ? params.totalTimeSeconds
      : null;

  if (client != null && fromTimestamps != null) return Math.max(client, fromTimestamps);
  return client ?? fromTimestamps;
}
