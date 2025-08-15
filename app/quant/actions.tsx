"use server";

import {
  GetOptionsChainOrderEnum,
  GetOptionsChainSortEnum,
  restClient,
} from "@polygon.io/client-js";

export async function getOptionsChain(ticker: string) {
  const globalFetchOptions = {
    pagination: true,
  };
  const rest = restClient(
    process.env.POLY_API_KEY as string,
    "https://api.polygon.io",
    globalFetchOptions
  );
  try {
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
      GetOptionsChainSortEnum.ExpirationDate,
      undefined
    );
    const now = Date.now();
    const MAX_DTE = 365; // max 1 year
    const MAX_STRIKE_DISTANCE = 0.5; // 50% above/below spot
    const MIN_OI = 5; // tiny liquidity floor (tweak)
    const spotPrice = 6465; // PEGAR AUTOMATICO DEPOIS!!!!

    const filtered = (response.results ?? [])
      // 1) expiry & strike window
      .filter((c) => {
        const e = c.details?.expiration_date;
        const dte = e ? Math.floor((Date.parse(e) - now) / 86400000) : null;
        if (dte == null || dte < 0 || dte > MAX_DTE) return false;

        const strike = c.details?.strike_price ?? 0;
        const pctDiff = Math.abs(strike - spotPrice) / spotPrice;
        if (pctDiff > MAX_STRIKE_DISTANCE) return false;

        return true;
      })
      // 2) drop contracts with missing/zero gamma or low OI
      .filter((c) => {
        const gamma = c.greeks?.gamma;
        const oi = c.open_interest ?? 0;
        return Number.isFinite(gamma) && gamma !== 0 && oi >= MIN_OI;
      })
      // 3) (optional) trim fields so you don’t ship a huge object
      .map((c) => ({
        ticker: c.details?.ticker,
        type: c.details?.contract_type,
        expiry: c.details?.expiration_date,
        strike: c.details?.strike_price,
        oi: c.open_interest ?? 0,
        gamma: c.greeks?.gamma ?? null,
        iv: c.implied_volatility ?? null, // IV shows up in either place
      }));

    console.log(`${filtered.length} contracts after filtering`);
    return filtered;
  } catch (e) {
    console.error("An error happened:", e);
    throw e;
  }
}
