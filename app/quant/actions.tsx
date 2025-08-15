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
    }));
}

export async function getMassForCharts(ticker = "I:SPX", S = 6465) {
  const rows = await getOptionsChain(ticker);

  const today = nycTodayISO();
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
    zeroDteExpiry,
    levels,
    massAllBars: toMassBars(allMass),
    mass0Bars: toMassBars(dteMass),
    debugTop0dtePut: zeroDteExpiry
      ? topPutMass(rows as any, zeroDteExpiry, S, 12)
      : [],
  };
}
