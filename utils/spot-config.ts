export const SPOT_DEFAULT = 6449;

function envSpot(): number | undefined {
  const raw = process.env.NEXT_PUBLIC_SPOT_OVERRIDE;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function resolveSpot(override?: number): number {
  if (Number.isFinite(override as number)) return override as number;
  const fromEnv = envSpot();
  if (Number.isFinite(fromEnv)) return fromEnv as number;
  return SPOT_DEFAULT;
}
