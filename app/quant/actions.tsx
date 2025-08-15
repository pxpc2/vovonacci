"use server";

import {
  GetOptionsChainOrderEnum,
  GetOptionsChainSortEnum,
  restClient,
} from "@polygon.io/client-js";
import {
  buildCallPutMass,
  toMassBars,
  topPutMass,
} from "../../utils/math/gex-format";
import { resolveSpot } from "../../utils/spot-config";

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

export async function getOptionsChain(ticker: string) {
  const rest = restClient(
    process.env.POLY_API_KEY as string,
    "https://api.polygon.io",
    { pagination: true }
  );

  const response = await rest.getOptionsChain(
    ticker,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    GetOptionsChainOrderEnum.Asc,
    250,
    GetOptionsChainSortEnum.ExpirationDate
  );

  return (response.results ?? [])
    .filter((c) => Number.isFinite(c.greeks?.gamma) && c.greeks?.gamma !== 0)
    .map((c) => ({
      ticker: c.details?.ticker,
      type: c.details?.contract_type,
      expiry: c.details?.expiration_date,
      strike: c.details?.strike_price,
      oi: c.open_interest ?? 0,
      gamma: c.greeks?.gamma as number,
      iv: c.implied_volatility ?? null,
      _dq: (c as any)?.day?.last_updated ?? undefined,
      _lq: (c as any)?.last_quote?.sip_timestamp ?? undefined,
      _lt: (c as any)?.last_trade?.sip_timestamp ?? undefined,
      _gu: (c as any)?.greeks?.updated ?? undefined,
    }));
}

// maior timestamp (ns|ms) → ms
function chainAsOfMs(rows: any[]): number | undefined {
  let maxNum = 0;
  for (const r of rows) {
    const cand = [r._dq, r._lq, r._lt, r._gu].map((x) =>
      typeof x === "bigint" ? Number(x) : Number(x || 0)
    );
    const m = Math.max(...cand);
    if (m > maxNum) maxNum = m;
  }
  return maxNum ? Math.floor(maxNum / 1e6) : undefined;
}

// melhor strike por chave
function topStrikeBy<T extends { strike: number }>(
  rows: (T & Record<string, number>)[],
  key: keyof T & string
): number | null {
  if (!rows.length) return null;
  let best = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i] as any)[key] > (best as any)[key]) best = rows[i];
  }
  return best.strike ?? null;
}

// média móvel centrada
function smooth(arr: number[], win = 5) {
  if (win <= 1 || arr.length < 3) return arr.slice();
  const k = Math.max(3, win | 0);
  const half = (k - 1) / 2;
  const out = arr.slice();
  for (let i = 0; i < arr.length; i++) {
    let s = 0,
      c = 0;
    for (let j = -half; j <= half; j++) {
      const idx = Math.min(arr.length - 1, Math.max(0, i + j));
      s += arr[idx];
      c++;
    }
    out[i] = s / c;
  }
  return out;
}

// HVL a partir do agregado {strike, call, put}
function hvlFromMass(
  mass: Array<{ strike: number; call: number; put: number }>,
  opts: { smoothWin?: number } = {}
) {
  if (!mass.length) {
    return {
      hvl: null as number | null,
      curve: [] as Array<{ strike: number; cum: number }>,
    };
  }
  const smoothWin = opts.smoothWin ?? 5;
  const pts = [...mass].sort((a, b) => a.strike - b.strike);
  const strikes = pts.map((p) => p.strike);
  const net = pts.map((p) => p.call - p.put); // call(+), put(-)
  const sm = smooth(net, smoothWin);

  const curve: Array<{ strike: number; cum: number }> = [];
  let acc = 0;
  for (let i = 0; i < sm.length; i++) {
    acc += sm[i];
    curve.push({ strike: strikes[i], cum: acc });
  }

  // HVL = strike de mínimo da cumulativa
  let minV = Infinity,
    minI = -1;
  for (let i = 0; i < curve.length; i++) {
    if (curve[i].cum < minV) {
      minV = curve[i].cum;
      minI = i;
    }
  }
  const hvl = minI >= 0 ? strikes[minI] : null;
  return { hvl, curve };
}

// interp linear p/ reamostrar curva nos strikes visíveis
function lerp(y0: number, y1: number, t: number) {
  return y0 + (y1 - y0) * t;
}
function interpAt(xs: number[], ys: number[], x: number) {
  if (!xs.length) return 0;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0,
    hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return lerp(ys[lo], ys[hi], t);
}

// reamostra e normaliza para caber no eixo X
function attachAndScaleCumResampled(
  bars: Array<{ strike: number; call: number; put: number }>,
  curve: Array<{ strike: number; cum: number }>
) {
  const xs = curve.map((c) => c.strike);
  const ys = curve.map((c) => c.cum);
  const withCum = bars.map((b) => ({
    ...b,
    cum: interpAt(xs, ys, b.strike),
  }));
  const maxBar = withCum.reduce(
    (m, p) => Math.max(m, Math.abs(p.call), Math.abs(p.put)),
    0
  );
  const maxCum = withCum.reduce((m, p) => Math.max(m, Math.abs(p.cum ?? 0)), 0);
  const k = maxCum > 0 ? (maxBar * 0.9) / maxCum : 1;
  return withCum.map((p) => ({ ...p, cumScaled: (p.cum ?? 0) * k }));
}

export async function getMassForCharts(
  ticker = "I:SPX",
  spotOverride?: number
) {
  const rows = await getOptionsChain(ticker);
  const spot = resolveSpot(spotOverride);
  const today = nycTodayISO();
  const expiries = [...new Set(rows.map((r) => r.expiry))].sort();
  const zeroDteExpiry = expiries.find((e) => e >= today) ?? null;

  // ===== todas (filtro leve) =====
  const ALL_SPOT_WINDOW = 0.35;
  const ALL_MIN_OI = 5;
  const ALL_MAX_DTE = 365;
  const ALL_BIN = 5;

  const allMassRaw = buildCallPutMass(rows as any, spot, {
    spotWindow: ALL_SPOT_WINDOW,
    minOI: ALL_MIN_OI,
    binStep: ALL_BIN,
    maxDteDays: ALL_MAX_DTE,
  });

  const { hvl: hvlAll, curve: curveAll } = hvlFromMass(allMassRaw, {
    smoothWin: 5,
  });
  const allBars = attachAndScaleCumResampled(toMassBars(allMassRaw), curveAll);

  const crAll = topStrikeBy(allMassRaw, "call");
  const psAll = topStrikeBy(
    allMassRaw.map((r) => ({ ...r, put: Math.abs(r.put) })),
    "put"
  );

  // ===== 0DTE =====
  // barras (sanitizado)
  const mass0Raw = zeroDteExpiry
    ? buildCallPutMass(rows as any, spot, {
        expiry: zeroDteExpiry,
        spotWindow: 0.05,
        minOI: 10,
        binStep: 5,
      })
    : [];

  // perfil HVL 0DTE com janela mais ampla, sem “overfit”
  const HVL0_WINDOW = 0.15; // ±15% do spot
  const mass0ForHVL = zeroDteExpiry
    ? buildCallPutMass(rows as any, spot, {
        expiry: zeroDteExpiry,
        spotWindow: HVL0_WINDOW,
        minOI: 1,
        binStep: 5,
      })
    : [];

  const { hvl: hvl0, curve: curve0 } = hvlFromMass(mass0ForHVL, {
    smoothWin: 7,
  });

  const mass0Bars = attachAndScaleCumResampled(toMassBars(mass0Raw), curve0);

  const cr0 = topStrikeBy(mass0Raw, "call");
  const ps0 = topStrikeBy(
    mass0Raw.map((r) => ({ ...r, put: Math.abs(r.put) })),
    "put"
  );

  return {
    spot: spot,
    zeroDteExpiry,
    levels: {
      callResistance: crAll,
      putSupport: psAll,
      hvl: hvlAll,
      zeroDTE: {
        expiry: zeroDteExpiry,
        callResistance: cr0,
        putSupport: ps0,
        hvl: hvl0, // valor bruto (pode sair do range visível)
      },
    },
    massAllBars: allBars, // com cumScaled
    mass0Bars: mass0Bars, // com cumScaled
    asOfMs: chainAsOfMs(rows as any),
    debugTop0dtePut: zeroDteExpiry
      ? topPutMass(rows as any, zeroDteExpiry, spot, 12)
      : [],
  };
}
