export function toBarData(arr: Array<{ strike: number; net: number }>) {
  return arr.map((p) => ({
    strike: p.strike,
    pos: p.net > 0 ? p.net : 0,
    neg: p.net < 0 ? p.net : 0,
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

export function buildCallPutMass(
  rows: Array<{
    type: "call" | "put";
    expiry: string;
    strike: number;
    oi: number;
    gamma: number;
  }>,
  S: number,
  opts: {
    expiry?: string | null; // filtra uma expiração específica
    spotWindow?: number | null; // janela em torno do spot (ex: 0.35 = ±35%)
    minOI?: number; // piso de OI
    binStep?: number | null; // agrega strikes por step (ex: 5)
    maxDteDays?: number | null; // corta DTE muito longo (ex: 365)
  } = {}
) {
  const MULT = 100,
    pctMove = 0.01;
  const {
    expiry = null,
    spotWindow = null,
    minOI = 0,
    binStep = null,
    maxDteDays = null,
  } = opts;

  const now = Date.now();
  const m = new Map<number, { call: number; put: number }>();

  for (const r of rows) {
    if (expiry && r.expiry !== expiry) continue;

    if (maxDteDays != null) {
      const dte = Math.floor((Date.parse(r.expiry) - now) / 86_400_000); // dias
      if (!Number.isFinite(dte) || dte < 0 || dte > maxDteDays) continue;
    }

    if (minOI && (r.oi ?? 0) < minOI) continue;

    if (spotWindow != null && spotWindow >= 0) {
      const far = Math.abs(r.strike - S) / S;
      if (far > spotWindow) continue;
    }

    const strike = binStep
      ? Math.round(r.strike / binStep) * binStep
      : r.strike;
    const contrib = Math.abs(r.gamma * S * S * pctMove * MULT * r.oi);

    const slot = m.get(strike) ?? { call: 0, put: 0 };
    if (r.type === "call") slot.call += contrib;
    else slot.put += contrib;
    m.set(strike, slot);
  }

  return [...m]
    .map(([strike, v]) => ({ strike, call: v.call, put: v.put }))
    .sort((a, b) => b.strike - a.strike);
}

export function toMassBars(
  arr: Array<{ strike: number; call: number; put: number }>
) {
  return arr.map((p) => ({
    strike: p.strike,
    call: p.call,
    put: -p.put, // puts ficam negativas para split L/R no gráfico
  }));
}
