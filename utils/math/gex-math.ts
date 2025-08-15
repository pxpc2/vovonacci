function nycTodayISO() {
  const now = new Date();
  const ny = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const y = ny.getFullYear();
  const m = String(ny.getMonth() + 1).padStart(2, "0");
  const d = String(ny.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function argMax(map: Map<any, number>) {
  let bestK: any,
    bestV = -Infinity;
  for (const [k, v] of map)
    if (v > bestV) {
      bestV = v;
      bestK = k;
    }
  return bestK;
}

function binTo(x: number, step: number) {
  return Math.round(x / step) * step;
}

export function summarizeCRPS(rows: any[], S: number) {
  const MULT = 100;
  const pctMove = 0.01;
  const spotWindow0 = 0.05;
  const minOI0 = 10; // ignore tiny OI on 0DTE
  const binStep0 = 5; // bin 0DTE strikes to 5-pt grid

  const today = nycTodayISO();
  const expiries = [...new Set(rows.map((r) => r.expiry))].sort();
  const zeroDteExpiry = expiries.find((e) => e >= today);

  const callMassAll = new Map<number, number>();
  const putMassAll = new Map<number, number>();
  const callMass0 = new Map<number, number>();
  const putMass0 = new Map<number, number>();

  for (const r of rows) {
    const gexUnit = r.gamma * (S * S) * pctMove * MULT;
    const contrib = Math.abs(gexUnit * r.oi);

    if (r.type === "call") {
      callMassAll.set(r.strike, (callMassAll.get(r.strike) ?? 0) + contrib);
    } else {
      putMassAll.set(r.strike, (putMassAll.get(r.strike) ?? 0) + contrib);
    }

    if (r.expiry === zeroDteExpiry) {
      if ((r.oi ?? 0) < minOI0) continue;
      if (Math.abs(r.strike - S) / S > spotWindow0) continue;
      const bStrike = binTo(r.strike, binStep0);

      if (r.type === "call") {
        callMass0.set(bStrike, (callMass0.get(bStrike) ?? 0) + contrib);
      } else {
        putMass0.set(bStrike, (putMass0.get(bStrike) ?? 0) + contrib);
      }
    }
  }

  return {
    levels: {
      callResistance: argMax(callMassAll),
      putSupport: argMax(putMassAll),
      zeroDTE: {
        expiry: zeroDteExpiry ?? null,
        callResistance: callMass0.size ? argMax(callMass0) : null,
        putSupport: putMass0.size ? argMax(putMass0) : null,
      },
    },
  };
}

export function buildNetCurves(
  rows: any[],
  S: number,
  opts: { spotWindow0?: number; minOI0?: number } = {}
) {
  const MULT = 100;
  const pctMove = 0.01;
  const spotWindow0 = opts.spotWindow0 ?? 0.08;
  const minOI0 = opts.minOI0 ?? 10;

  const today = nycTodayISO();
  const expiries = [...new Set(rows.map((r) => r.expiry))].sort();
  const zeroDteExpiry = expiries.find((e) => e >= today) ?? null;

  const netAll = new Map<number, number>();
  const net0 = new Map<number, number>();

  for (const r of rows) {
    const sign = r.type === "call" ? +1 : -1;
    const gexUnit = r.gamma * (S * S) * pctMove * MULT;
    const contrib = gexUnit * r.oi;

    netAll.set(r.strike, (netAll.get(r.strike) ?? 0) + sign * contrib);

    if (
      zeroDteExpiry &&
      r.expiry === zeroDteExpiry &&
      (r.oi ?? 0) >= minOI0 &&
      Math.abs(r.strike - S) / S <= spotWindow0
    ) {
      net0.set(r.strike, (net0.get(r.strike) ?? 0) + sign * contrib);
    }
  }

  const netAllArr = [...netAll]
    .map(([strike, net]) => ({ strike, net }))
    .sort((a, b) => a.strike - b.strike);

  const net0Arr = [...net0]
    .map(([strike, net]) => ({ strike, net }))
    .sort((a, b) => a.strike - b.strike);

  return { netAll: netAllArr, net0dte: net0Arr, zeroDteExpiry };
}
