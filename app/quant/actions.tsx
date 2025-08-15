"use server";

import {
  GetOptionsChainOrderEnum,
  GetOptionsChainSortEnum,
  restClient,
} from "@polygon.io/client-js";
import { summarizeCRPS } from "../../utils/math/gex-math";
import {
  buildCallPutMass,
  toMassBars,
  topPutMass,
} from "../../utils/math/gex-format";

/* ---- helpers ---- */

// ns -> ms, tolerant of string/number
function nsToMs(ns: unknown): number | null {
  if (ns == null) return null;
  try {
    return Number(BigInt(ns as any) / BigInt(1000000));
  } catch {
    const s = String(ns);
    return s.length >= 13 ? Number(s.slice(0, 13)) : null;
  }
}

// find the freshest timestamp across common fields
function computeAsOfMs(results: any[]): number {
  let maxNs = BigInt(0);

  for (const s of results ?? []) {
    const day = s?.day ?? {};
    const q = s?.last_quote ?? {};
    const tr = s?.last_trade ?? {};

    const cands = [
      day?.last_updated,
      q?.["sip_timestamp"] ??
        q?.["timestamp"] ??
        q?.["t"] ??
        q?.["last_updated"],
      tr?.["sip_timestamp"] ??
        tr?.["timestamp"] ??
        tr?.["t"] ??
        tr?.["last_updated"],
    ].filter(Boolean);

    for (const t of cands) {
      try {
        const bn = BigInt(t as any);
        if (bn > maxNs) maxNs = bn;
      } catch {
        /* ignore bad values */
      }
    }
  }

  return maxNs ? Number(maxNs / BigInt(1000000)) : Date.now();
}

// YYYY-MM-DD in New York for a given ms epoch
function nycISOFromMs(ms: number) {
  const d = new Date(ms);
  const ny = new Date(
    d.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const y = ny.getFullYear();
  const m = String(ny.getMonth() + 1).padStart(2, "0");
  const dd = String(ny.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/* ---- API functions ---- */

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

  const results = response.results ?? [];

  // NEW: compute dataset timestamp
  const asOfMs = computeAsOfMs(results);

  const rows = results
    .filter((c) => Number.isFinite(c.greeks?.gamma) && c.greeks?.gamma !== 0)
    .map((c) => ({
      ticker: c.details?.ticker,
      type: c.details?.contract_type,
      expiry: c.details?.expiration_date,
      strike: c.details?.strike_price,
      oi: c.open_interest ?? 0,
      gamma: c.greeks?.gamma as number,
      iv: c.implied_volatility ?? null,
    }));

  // minimal change: return rows + timestamp
  return { rows, asOfMs };
}

export async function getMassForCharts(ticker = "I:SPX", S = 6465) {
  const { rows, asOfMs } = await getOptionsChain(ticker);

  // Use the dataset time (ET) to decide "today" for 0DTE
  const today = nycISOFromMs(asOfMs);
  const expiries = [...new Set(rows.map((r) => r.expiry))].sort();
  const zeroDteExpiry = expiries.find((e) => e >= today) ?? null;

  const levels = summarizeCRPS(rows as any, S).levels;

  const allMass = buildCallPutMass(rows as any, S);
  const dteMass = zeroDteExpiry
    ? buildCallPutMass(rows as any, S, {
        expiry: zeroDteExpiry,
        spotWindow: 0.05,
        minOI: 10,
        binStep: 25,
      })
    : [];

  return {
    spot: S,
    // NEW: surface timestamps so you can display them in the UI
    asOfMs,
    asOfET: new Date(asOfMs).toLocaleString("en-US", {
      timeZone: "America/New_York",
    }),
    zeroDteExpiry,
    levels,
    massAllBars: toMassBars(allMass),
    mass0Bars: toMassBars(dteMass),
    debugTop0dtePut: zeroDteExpiry
      ? topPutMass(rows as any, zeroDteExpiry, S, 12)
      : [],
  };
}
