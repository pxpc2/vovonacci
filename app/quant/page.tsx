"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getMassForCharts } from "./actions";
import GexMassChart from "../components/GexChart";
import Spinner from "../components/Spinner";

function fmtBig(n: number) {
  const s = Math.sign(n);
  const v = Math.abs(n);
  if (v >= 1e9) return (s * (v / 1e9)).toFixed(2) + "B";
  if (v >= 1e6) return (s * (v / 1e6)).toFixed(2) + "M";
  return (s * v).toLocaleString();
}
function fmtTZ(ms: number | undefined, locale: string, timeZone: string) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(ms));
}
const fmtPx = (x: number | null | undefined) =>
  x == null ? "—" : Math.round(x).toString();
const pct = (x: number | null | undefined, digits = 2) =>
  x == null ? "—" : (100 * x).toFixed(digits) + "%";

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await getMassForCharts("I:SPX");
      setData(res);
    })();
  }, []);

  // logs
  useEffect(() => {
    if (!data?.levels) return;
    const { callResistance, putSupport, hvl, zeroDTE } = data.levels;
    console.log("[NÍVEIS GAMMA - TODAS EXPIRAÇÕES]", {
      CR: callResistance,
      PS: putSupport,
      HVL: hvl,
    });
    if (zeroDTE) {
      console.log("[NÍVEIS GAMMA - 0DTE]", {
        data: zeroDTE.expiry,
        CR0DTE: zeroDTE.callResistance,
        PS0DTE: zeroDTE.putSupport,
        HVL0DTE: zeroDTE.hvl,
      });
    }
  }, [data?.levels]);

  const tables = useMemo(() => {
    if (!data) return null;

    const barsAll: Array<{ strike: number; call: number; put: number }> =
      data.massAllBars ?? [];
    const bars0: Array<{ strike: number; call: number; put: number }> =
      data.mass0Bars ?? [];

    const rankPuts = (bars: typeof barsAll) =>
      [...bars]
        .filter((d) => d.put < 0)
        .map((d) => ({ strike: d.strike, value: Math.abs(d.put) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const rankCalls = (bars: typeof barsAll) =>
      [...bars]
        .filter((d) => d.call > 0)
        .map((d) => ({ strike: d.strike, value: d.call }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    const rankNet = (bars: typeof barsAll) =>
      [...bars]
        .map((d) => {
          const net = d.call + d.put;
          return { strike: d.strike, net, dom: net >= 0 ? "CALL" : "PUT" };
        })
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        .slice(0, 10);

    const rankGross = (bars: typeof barsAll) =>
      [...bars]
        .map((d) => {
          const putMag = Math.abs(d.put);
          const total = d.call + putMag;
          const dom = d.call >= putMag ? "CALL" : "PUT";
          return { strike: d.strike, total, dom, call: d.call, putMag };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    // TOTAL GEX (0DTE)
    const rankGross0 = (bars: typeof bars0) =>
      [...bars]
        .map((d) => {
          const putMag = Math.abs(d.put);
          const total = d.call + putMag;
          const dom = d.call >= putMag ? "CALL" : "PUT";
          return { strike: d.strike, total, dom, call: d.call, putMag };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    return {
      topPutsAll: rankPuts(barsAll),
      topCallsAll: rankCalls(barsAll),
      topNetAll: rankNet(barsAll),
      topGrossAll: rankGross(barsAll),
      topPuts0: rankPuts(bars0),
      topCalls0: rankCalls(bars0),
      topGross0: rankGross0(bars0),
    };
  }, [data]);

  // GEX 1–6 minoritários (0DTE)
  const gexMinor = useMemo(() => {
    if (!data?.mass0Bars) return [];
    const majors = new Set<number>(
      [
        data?.levels?.callResistance,
        data?.levels?.putSupport,
        data?.levels?.hvl,
        data?.levels?.zeroDTE?.callResistance,
        data?.levels?.zeroDTE?.putSupport,
        data?.levels?.zeroDTE?.hvl,
      ].filter((x: any) => Number.isFinite(x)) as number[]
    );
    const rows = [...data.mass0Bars]
      .map((d: any) => ({
        strike: d.strike,
        total: (d.call ?? 0) + Math.abs(d.put ?? 0),
      }))
      .filter((r) => !majors.has(r.strike))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((r, i) => ({ label: `GEX ${i + 1}`, strike: r.strike }));
    return rows;
  }, [data]);

  const asOfBR = useMemo(
    () => fmtTZ(data?.asOfMs, "pt-BR", "America/Sao_Paulo"),
    [data?.asOfMs]
  );

  const netAll = useMemo(
    () =>
      (data?.massAllBars ?? []).reduce(
        (sum: number, d: any) => sum + (d.call || 0) + (d.put || 0),
        0
      ),
    [data?.massAllBars]
  );
  const EPS = 0;
  function regime(net: number) {
    if (net > EPS) return "positivo";
    if (net < -EPS) return "negativo";
    return "neutro";
  }
  const regimeAll = regime(netAll);
  const regimeClass = (r: string) =>
    r === "positivo"
      ? "text-emerald-400 border-emerald-800/60"
      : r === "negativo"
      ? "text-red-400 border-red-800/60"
      : "text-neutral-300 border-neutral-700/60";

  // (formato p/ TradingView)
  const tvLevelsString = useMemo(() => {
    if (!data) return "";

    const lv = data.levels;
    const parts: string[] = ["$SPX:"];

    const add = (label: string, val: unknown) => {
      if (typeof val === "number" && Number.isFinite(val)) {
        parts.push(`${label}: ${Math.round(val)}`);
      }
    };

    // principais
    add("Call Resistance", lv?.callResistance);
    add("Put Support", lv?.putSupport);
    add("HVL", lv?.hvl);
    add("Call Resistance 0DTE", lv?.zeroDTE?.callResistance);
    add("Put Support 0DTE", lv?.zeroDTE?.putSupport);
    add("HVL 0DTE", lv?.zeroDTE?.hvl);

    // banda 2σ
    const b2 = data.bands?.anchors?.spot?.levels?.["2σ"];
    if (b2 && typeof b2.min === "number" && typeof b2.max === "number") {
      add("1D Min", b2.min);
      add("1D Max", b2.max);
    }

    // GEX 1–6 (secundários 0DTE)
    gexMinor.forEach((g, i) => add(`GEX ${i + 1}`, g.strike));

    return parts.join(", ");
  }, [data, gexMinor]);
  useEffect(() => {
    if (tvLevelsString) {
      console.log(tvLevelsString);
    }
  }, [tvLevelsString]);

  if (!data) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>
        <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
          <div className="flex items-center justify-center pt-8 pb-6 border-b border-gray-400">
            <Link href="/" className="hover:underline">
              <h1 className="text-xl">vovonacci@PJT</h1>
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center p-6 gap-3 text-neutral-300">
            <Spinner />
          </div>
        </div>
      </div>
    );
  }

  const lv = data.levels;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>

      <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full items-center">
        <div className="sm:max-w-[1920px]">
          <div className="flex items-center justify-center pt-8 pb-6 border-b border-gray-400">
            <Link href="/" className="hover:underline">
              <h1 className="text-xl">vovonacci@PJT</h1>
            </Link>
          </div>
          {/* Meta topo */}
          <div className="pt-4 pb-2 text-xs text-neutral-400">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
              <span className="rounded-md border border-amber-700/80 text-amber-400 px-2 py-0.5 whitespace-nowrap shrink-0">
                {`$SPX - SPOT: ${data.spot}`}
              </span>
              <span
                className={`rounded-md border px-2 py-0.5 whitespace-nowrap shrink-0 ${regimeClass(
                  regimeAll
                )}`}
              >
                Perfil γ: {regimeAll.toUpperCase()}
              </span>
              <span className="rounded-md border border-neutral-800/60 px-2 py-0.5 whitespace-nowrap shrink-0">
                {asOfBR} (GMT-3)
              </span>
              <span className="rounded-md border border-neutral-800/60 px-2 py-0.5 whitespace-nowrap shrink-0">
                0DTE: {data.zeroDteExpiry ?? "—"}
              </span>
            </div>
          </div>

          {/* NÍVEIS + BANDAS — 3 cartões numa única fileira */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 items-stretch">
            {/* PRIMÁRIOS */}
            <div className="rounded-xl border border-neutral-800/60 bg-black/20 p-4 h-full flex flex-col">
              <div className="text-sm font-semibold text-center text-neutral-200 mb-3">
                Níveis γ
              </div>
              <ul className="text-sm divide-y divide-neutral-800/60">
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-indigo-400">Call Resistance</span>
                  <span className="tabular-nums">
                    {lv?.callResistance ?? "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-indigo-400">Put Support</span>
                  <span className="tabular-nums">{lv?.putSupport ?? "—"}</span>
                </li>
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-indigo-400">HVL</span>
                  <span className="tabular-nums">{lv?.hvl ?? "—"}</span>
                </li>
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-indigo-400">Call Resistance 0DTE</span>
                  <span className="tabular-nums">
                    {lv?.zeroDTE?.callResistance ?? "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-indigo-400">Put Support 0DTE</span>
                  <span className="tabular-nums">
                    {lv?.zeroDTE?.putSupport ?? "—"}
                  </span>
                </li>
                <li className="flex items-center justify-between py-1.5">
                  <span className="text-indigo-400">HVL 0DTE</span>
                  <span className="tabular-nums">
                    {lv?.zeroDTE?.hvl ?? "—"}
                  </span>
                </li>
              </ul>
            </div>

            {/* SECUNDÁRIOS */}
            <div className="rounded-xl border border-neutral-800/60 bg-black/20 p-4 h-full flex flex-col">
              <div className="text-sm font-semibold text-center text-neutral-200 mb-3">
                Subníveis γ
              </div>
              <ul className="text-sm divide-y divide-neutral-800/60">
                {gexMinor.length === 0 && (
                  <li className="text-neutral-500 text-center py-1.5">
                    sem dados
                  </li>
                )}
                {gexMinor.map((g) => (
                  <li
                    key={g.label}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-blue-900">{g.label}</span>
                    <span className="tabular-nums">{g.strike}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* BANDAS 1D */}
            <div className="rounded-xl border border-neutral-800/60 bg-black/20 p-4 h-full flex flex-col">
              <div className="text-sm font-semibold text-neutral-200 mb-3 text-center">
                Variação 1D Max/Min (σ) —{" "}
                {data.bands?.gammaPositive ? (
                  <span className="text-emerald-500">perfil γ+</span>
                ) : (
                  <span className="text-red-500">perfil γ−</span>
                )}
              </div>

              <div className="text-xs text-neutral-400 mb-3 flex flex-wrap gap-x-4 gap-y-1">
                <span>σ_real: {pct(data.bands?.sigma?.realized)}</span>
                <span>σ_impl(1d): {pct(data.bands?.sigma?.implied1d)}</span>
                <span>σ_base: {pct(data.bands?.sigma?.base)}</span>
                <span>
                  risk-reversal:{" "}
                  {data.bands?.sigma?.rr == null
                    ? "—"
                    : (100 * data.bands.sigma.rr).toFixed(2) + "%"}
                </span>
                <span>σ_up: {pct(data.bands?.sigma?.up)}</span>
                <span>σ_dn: {pct(data.bands?.sigma?.dn)}</span>
              </div>

              {data.bands?.anchors?.spot && (
                <div className="mt-auto">
                  <div className="text-xs text-neutral-400 mb-2">
                    Âncora (spot): {fmtPx(data.bands.anchors.spot.anchor)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded border border-neutral-800/60 p-2">
                      <div className="text-neutral-500 text-xs mb-1">1σ</div>
                      <div className="text-neutral-500">
                        Max: {fmtPx(data.bands.anchors.spot.levels["1σ"].max)}
                      </div>
                      <div className="text-neutral-500">
                        Min: {fmtPx(data.bands.anchors.spot.levels["1σ"].min)}
                      </div>
                    </div>
                    <div className="rounded border border-neutral-800/60 p-2">
                      <div className="text-neutral-300 text-sm mb-1">
                        2σ (região de retorno à média)
                      </div>
                      <div className="text-indigo-400 font-medium">
                        Max:{" "}
                        <span className="text-neutral-50">
                          {fmtPx(data.bands.anchors.spot.levels["2σ"].max)}
                        </span>
                      </div>
                      <div className="text-indigo-400 font-medium">
                        Min:{" "}
                        <span className="text-neutral-50">
                          {fmtPx(data.bands.anchors.spot.levels["2σ"].min)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded border border-neutral-800/60 p-2">
                      <div className="text-neutral-500 text-xs mb-1">3σ</div>
                      <div className="text-neutral-500">
                        Max: {fmtPx(data.bands.anchors.spot.levels["3σ"].max)}
                      </div>
                      <div className="text-neutral-500">
                        Min: {fmtPx(data.bands.anchors.spot.levels["3σ"].min)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="w-full space-y-6 pb-6">
            <GexMassChart
              title="Call vs Put GEX — 0DTE"
              data={data.mass0Bars}
              spot={data.spot}
              callResistance={lv.zeroDTE?.callResistance ?? undefined}
              putSupport={lv.zeroDTE?.putSupport ?? undefined}
              hvl={lv.zeroDTE?.hvl ?? undefined}
              normalizeBars={true}
              normalizeQuantile={0.9}
            />
            <GexMassChart
              title="Call vs Put GEX — todas as expirações"
              data={data.massAllBars}
              spot={data.spot}
              callResistance={lv.callResistance}
              putSupport={lv.putSupport}
              hvl={lv.hvl}
              normalizeBars={false}
            />
          </div>

          {/* Tabelas topo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 pt-2 mb-24">
            {/* CALL (todas) */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
                CALL GEX <span className="text-neutral-500">(todas)</span>
              </div>
              <ul className="text-sm space-y-2">
                {tables!.topCallsAll.map((r, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-indigo-400">{r.strike}</span>
                    <span className="text-emerald-400 tabular-nums">
                      {fmtBig(r.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* PUT (todas) */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
                PUT GEX <span className="text-neutral-500">(todas)</span>
              </div>
              <ul className="text-sm space-y-2">
                {tables!.topPutsAll.map((r, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-indigo-400">{r.strike}</span>
                    <span className="text-red-400 tabular-nums">
                      {fmtBig(r.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CALL (0DTE) */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
                CALL GEX <span className="text-neutral-500">(0DTE)</span>
              </div>
              <ul className="text-sm space-y-2">
                {(tables!.topCalls0?.length ? tables!.topCalls0 : []).map(
                  (r, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-indigo-400">{r.strike}</span>
                      <span className="text-emerald-400 tabular-nums">
                        {fmtBig(r.value)}
                      </span>
                    </li>
                  )
                )}
                {!tables!.topCalls0?.length && (
                  <li className="text-neutral-500 text-sm text-center">
                    sem dados 0DTE
                  </li>
                )}
              </ul>
            </div>

            {/* PUT (0DTE) */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
                PUT GEX <span className="text-neutral-500">(0DTE)</span>
              </div>
              <ul className="text-sm space-y-2">
                {(tables!.topPuts0?.length ? tables!.topPuts0 : []).map(
                  (r, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-indigo-400">{r.strike}</span>
                      <span className="text-red-400 tabular-nums">
                        {fmtBig(r.value)}
                      </span>
                    </li>
                  )
                )}
                {!tables!.topPuts0?.length && (
                  <li className="text-neutral-500 text-sm text-center">
                    sem dados 0DTE
                  </li>
                )}
              </ul>
            </div>

            {/* NET (todas) */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
                NET GEX <span className="text-neutral-500">(todas)</span>
              </div>
              <ul className="text-sm space-y-2">
                {tables!.topNetAll.map((r, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-indigo-400">{r.strike}</span>
                    <span
                      className={`tabular-nums ${
                        r.dom === "CALL" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {fmtBig(r.net)}{" "}
                      <span className="text-xs text-neutral-400">
                        ({r.dom})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* TOTAL (0DTE) */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
                TOTAL GEX <span className="text-neutral-500">(0DTE)</span>
              </div>
              <ul className="text-sm space-y-2">
                {(tables!.topGross0?.length ? tables!.topGross0 : []).map(
                  (r: any, i: number) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-indigo-400">{r.strike}</span>
                      <span className="tabular-nums">
                        <span className="text-neutral-300 mr-2">
                          {fmtBig(r.total)}
                        </span>
                        <span
                          className={`text-xs ${
                            r.dom === "CALL"
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          ({r.dom})
                        </span>
                      </span>
                    </li>
                  )
                )}
                {!tables!.topGross0?.length && (
                  <li className="text-neutral-500 text-sm text-center">
                    sem dados 0DTE
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
