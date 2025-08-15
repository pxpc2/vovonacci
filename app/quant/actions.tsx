"use server";

import {
  GetOptionsChainOrderEnum,
  GetOptionsChainSortEnum,
  restClient,
} from "@polygon.io/client-js";
import { buildNetCurves, summarizeCRPS } from "../../utils/math/gex-math";
import { topPutMass } from "../../utils/math/gex-format";

export async function getOptionsChain(ticker: string) {
  const globalFetchOptions = { pagination: true };
  const rest = restClient(
    process.env.POLY_API_KEY as string,
    "https://api.polygon.io",
    globalFetchOptions
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

  // keep only rows with valid gamma
  return (response.results ?? [])
    .filter((c) => Number.isFinite(c.greeks?.gamma) && c.greeks?.gamma !== 0)
    .map((c) => ({
      ticker: c.details?.ticker,
      type: c.details?.contract_type,
      expiry: c.details?.expiration_date,
      strike: c.details?.strike_price,
      oi: c.open_interest ?? 0,
      gamma: c.greeks?.gamma ?? null,
      iv: c.implied_volatility ?? null,
    }));
}

export async function getCRPSSummary(ticker = "I:SPX", S = 6465) {
  const rows = await getOptionsChain(ticker);
  return summarizeCRPS(rows as any, S);
}

export async function getGexForCharts(ticker = "I:SPX", S = 6465) {
  const rows = await getOptionsChain(ticker); // already filtered for finite gamma

  const crps = summarizeCRPS(rows as any, S, {
    spotWindow0: 0.05,
    minOI0: 10,
    binStep0: 25,
  });
  const curves = buildNetCurves(rows as any, S, {
    spotWindow0: 0.05,
    minOI0: 10,
  });

  const zeroExp = crps.levels.zeroDTE?.expiry ?? null;
  const debug = zeroExp ? topPutMass(rows as any, zeroExp, S, 10) : [];

  return {
    spot: S,
    levels: crps.levels,
    curves, // { netAll, net0dte, zeroDteExpiry }
    debug, // [{strike, mass}] top 0DTE put mass (helps explain PS)
  };
}
