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
      // carimbos crus (para asOfMs)
      _dq: (c as any)?.day?.last_updated ?? undefined,
      _lq: (c as any)?.last_quote?.sip_timestamp ?? undefined,
      _lt: (c as any)?.last_trade?.sip_timestamp ?? undefined,
      _gu: (c as any)?.greeks?.updated ?? undefined,
    }));
}

// pega o maior carimbo em ns (ou ms) e normaliza para ms
function chainAsOfMs(rows: any[]): number | undefined {
  let maxNum = 0;
  for (const r of rows) {
    const cand = [r._dq, r._lq, r._lt, r._gu].map((x) =>
      typeof x === "bigint" ? Number(x) : Number(x || 0)
    );
    const m = Math.max(...cand);
    if (m > maxNum) maxNum = m;
  }
  return maxNum ? Math.floor(maxNum / 1e6) : undefined; // ns->ms (ou já ms)
}

// util: escolhe o strike com maior valor para uma chave
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

export async function getMassForCharts(ticker = "I:SPX", S = 6465) {
  const rows = await getOptionsChain(ticker);

  const today = nycTodayISO();
  const expiries = [...new Set(rows.map((r) => r.expiry))].sort();
  const zeroDteExpiry = expiries.find((e) => e >= today) ?? null;

  // ---------- filtros leves p/ “todas as expirações” ----------
  const ALL_SPOT_WINDOW = 0.35; // ±35% do spot
  const ALL_MIN_OI = 5;
  const ALL_MAX_DTE = 365;
  const ALL_BIN = 5; // mantém granularidade fina (5 pts)

  const allMassRaw = buildCallPutMass(rows as any, S, {
    spotWindow: ALL_SPOT_WINDOW,
    minOI: ALL_MIN_OI,
    binStep: ALL_BIN,
    maxDteDays: ALL_MAX_DTE,
  }); // [{strike, call, put}]
  const allBars = toMassBars(allMassRaw); // para gráfico (put negativo)

  // CR/PS “todas” saem do MESMO agregado da tabela
  const crAll = topStrikeBy(allMassRaw, "call");
  const psAll = topStrikeBy(
    allMassRaw.map((r) => ({ ...r, put: Math.abs(r.put) })), // magnitude
    "put"
  );

  // ---------- 0DTE (com sanitização leve + bin 5) ----------
  const mass0Raw = zeroDteExpiry
    ? buildCallPutMass(rows as any, S, {
        expiry: zeroDteExpiry,
        spotWindow: 0.05,
        minOI: 10,
        binStep: 5,
      })
    : [];
  const mass0Bars = toMassBars(mass0Raw);

  const cr0 = topStrikeBy(mass0Raw, "call");
  const ps0 = topStrikeBy(
    mass0Raw.map((r) => ({ ...r, put: Math.abs(r.put) })), // magnitude
    "put"
  );

  return {
    spot: S,
    zeroDteExpiry,
    // níveis agora 100% consistentes com as tabelas/plots
    levels: {
      callResistance: crAll,
      putSupport: psAll,
      zeroDTE: {
        expiry: zeroDteExpiry,
        callResistance: cr0,
        putSupport: ps0,
      },
    },
    massAllBars: allBars,
    mass0Bars,
    asOfMs: chainAsOfMs(rows as any),
    debugTop0dtePut: zeroDteExpiry
      ? topPutMass(rows as any, zeroDteExpiry, S, 12)
      : [],
  };
}
