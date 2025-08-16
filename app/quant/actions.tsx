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

// ---------- utils de data ----------
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
function daysDiff(a: string, b: string) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

// ---------- polygon: chain ----------
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
      type: c.details?.contract_type as "call" | "put",
      expiry: c.details?.expiration_date as string,
      strike: c.details?.strike_price as number,
      oi: c.open_interest ?? 0,
      gamma: c.greeks?.gamma as number,
      iv: (c.implied_volatility ?? null) as number | null,
      _dq: (c as any)?.day?.last_updated ?? undefined,
      _lq: (c as any)?.last_quote?.sip_timestamp ?? undefined,
      _lt: (c as any)?.last_trade?.sip_timestamp ?? undefined,
      _gu: (c as any)?.greeks?.updated ?? undefined,
    }));
}

// ---------- maior timestamp (ns|ms) → ms ----------
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

// ---------- helpers de ranking ----------
function topStrikeBy<T extends { strike: number }>(
  rows: (T & Record<string, number>)[],
  key: keyof T & string
): number | null {
  if (!rows.length) return null;
  let best = rows[0];
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i] as any)[key] > (best as any)[key]) best = rows[i];
  }
  return (best?.strike as number) ?? null;
}

// ---------- suavização p/ HVL ----------
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

// ---------- HVL ----------
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

// ---------- reamostragem/escala da curva ----------
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

// ---------- históricos (closes) ----------
async function getDailyCloses(ticker: string, days = 180) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const qs = new URLSearchParams({
    adjusted: "true",
    sort: "asc",
    apiKey: process.env.POLY_API_KEY as string,
  }).toString();
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from
    .toISOString()
    .slice(0, 10)}/${to.toISOString().slice(0, 10)}?${qs}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];
  return results
    .map((r: any) => Number(r.c))
    .filter((x: any) => Number.isFinite(x));
}
function ewmaDailySigma(closes: number[], lambda = 0.94) {
  if (closes.length < 20) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  let varEWMA = 0;
  let w = 1;
  let norm = 0;
  for (let i = rets.length - 1; i >= 0; i--) {
    varEWMA += w * rets[i] * rets[i];
    norm += w;
    w *= lambda;
  }
  const varDaily = (1 - lambda) * (varEWMA / Math.max(norm, 1e-9));
  return Math.sqrt(Math.max(varDaily, 0));
}

// ---------- IV helpers ----------
function nearestIv(
  rows: any[],
  expiry: string,
  type: "call" | "put",
  targetStrike: number
): number | null {
  const pool = rows
    .filter(
      (r) => r.expiry === expiry && r.type === type && Number.isFinite(r.iv)
    )
    .sort(
      (a, b) =>
        Math.abs(a.strike - targetStrike) - Math.abs(b.strike - targetStrike)
    );
  return pool.length ? (pool[0].iv as number) : null;
}
function pickExpiryForSkew(rows: any[], todayISO: string) {
  const uniq = [...new Set(rows.map((r) => r.expiry))].sort();
  let best: string | null = null;
  let bestDte = Infinity;
  for (const e of uniq) {
    const dte = daysDiff(e, todayISO);
    if (dte >= 2 && dte < bestDte) {
      bestDte = dte;
      best = e;
    }
  }
  return best ?? uniq[0] ?? null;
}

// ---------- bandas 1D ----------
function oneDayBands(anchor: number, sigmaUp: number, sigmaDn: number) {
  const lvl = (k: number) => ({
    min: anchor * Math.exp(-k * sigmaDn),
    max: anchor * Math.exp(+k * sigmaUp),
  });
  return {
    "1σ": lvl(1),
    "2σ": lvl(2),
    "3σ": lvl(3),
  };
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
  const mass0Raw = zeroDteExpiry
    ? buildCallPutMass(rows as any, spot, {
        expiry: zeroDteExpiry,
        spotWindow: 0.05,
        minOI: 10,
        binStep: 5,
      })
    : [];
  const HVL0_WINDOW = 0.15;
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

  // ===== regime γ (sinal do net) =====
  const netAll = allBars.reduce(
    (s, r: any) => s + (r.call || 0) + (r.put || 0),
    0
  );
  const gammaPositive = netAll >= 0;

  // ===== σ diário base (EWMA + IV ATM) =====
  const closes = await getDailyCloses(ticker, 180);
  const sigmaReal = ewmaDailySigma(closes) ?? 0; // diário
  // ATM IV (anual) → diário
  const atmIv =
    nearestIv(rows, pickExpiryForSkew(rows, today)!, "call", spot) ??
    nearestIv(rows, pickExpiryForSkew(rows, today)!, "put", spot) ??
    0;
  const sigmaImpl = atmIv > 0 ? atmIv / Math.sqrt(252) : 0;
  // blend simples (fallbacks)
  const haveReal = sigmaReal > 0,
    haveImpl = sigmaImpl > 0;
  const sigmaBase =
    haveReal && haveImpl
      ? 0.5 * sigmaReal + 0.5 * sigmaImpl
      : haveReal
      ? sigmaReal
      : sigmaImpl;

  // ---------- skew (risk-reversal ~ ±5%) ----------
  const skewExpiry = pickExpiryForSkew(rows, today);
  let rr = 0;
  if (skewExpiry) {
    const call5 = nearestIv(rows, skewExpiry, "call", spot * 1.05) ?? 0;
    const put5 = nearestIv(rows, skewExpiry, "put", spot * 0.95) ?? 0;
    rr = call5 - put5; // em pontos de vol (anual)
  }
  // converte RR anual para "efeito" diário; clamp e fator
  const rrDaily = rr / Math.sqrt(252) || 0;
  const rrClamp = Math.max(-0.2, Math.min(0.2, rrDaily)); // segurança
  const alpha = 0.5; // intensidade do skew
  const sigmaUp = sigmaBase * (1 + alpha * Math.max(0, rrClamp));
  const sigmaDn = sigmaBase * (1 + alpha * Math.max(0, -rrClamp));

  // ---------- âncoras e bandas ----------
  const anchors: { spot?: any; hvl?: any } = {};
  anchors.spot = {
    anchor: spot,
    levels: oneDayBands(spot, sigmaUp, sigmaDn),
  };
  if (!gammaPositive && hvlAll) {
    anchors.hvl = {
      anchor: hvlAll,
      levels: oneDayBands(hvlAll, sigmaUp, sigmaDn),
    };
  }

  return {
    spot,
    zeroDteExpiry,
    levels: {
      callResistance: crAll,
      putSupport: psAll,
      hvl: hvlAll,
      zeroDTE: {
        expiry: zeroDteExpiry,
        callResistance: cr0,
        putSupport: ps0,
        hvl: hvl0,
      },
    },
    massAllBars: allBars,
    mass0Bars: mass0Bars,
    asOfMs: chainAsOfMs(rows as any),
    debugTop0dtePut: zeroDteExpiry
      ? topPutMass(rows as any, zeroDteExpiry, spot, 12)
      : [],
    bands: {
      gammaPositive,
      sigma: {
        realized: sigmaReal || null,
        implied1d: sigmaImpl || null,
        base: sigmaBase || null,
        up: sigmaUp || null,
        dn: sigmaDn || null,
        rr: rr || null, // anual
        rrDaily: rrDaily || null,
        skewExpiry: skewExpiry ?? null,
      },
      anchors,
    },
  };
}
