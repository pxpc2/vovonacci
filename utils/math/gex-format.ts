// turns [{ strike, net }] into [{ strike, pos, neg }] for a two-sided bar chart
export function toBarData(arr: Array<{ strike: number; net: number }>) {
  return arr.map((p) => ({
    strike: p.strike,
    pos: p.net > 0 ? p.net : 0,
    neg: p.net < 0 ? -p.net : 0, // keep as positive magnitude; we'll label it "Negative GEX"
  }));
}

export function topPutMass(
  rows: Array<{
    type: "call" | "put";
    expiry: string;
    strike: number;
    oi: number;
    gamma: number;
  }>,
  expiry: string,
  S: number,
  limit = 10
) {
  const MULT = 100,
    pctMove = 0.01;
  const m = new Map<number, number>();
  for (const r of rows) {
    if (r.expiry !== expiry || r.type !== "put") continue;
    const contrib = Math.abs(r.gamma * S * S * pctMove * MULT * r.oi);
    m.set(r.strike, (m.get(r.strike) ?? 0) + contrib);
  }
  return [...m.entries()]
    .map(([strike, mass]) => ({ strike, mass }))
    .sort((a, b) => b.mass - a.mass)
    .slice(0, limit);
}
