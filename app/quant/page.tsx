// app/quant/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getMassForCharts } from "./actions";
import GexMassChart from "../components/GexChart";

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

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await getMassForCharts("I:SPX", 6465);
      setData(res);
    })();
  }, []);

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
          const net = d.call + d.put; // put is negative
          return { strike: d.strike, net, dom: net >= 0 ? "CALL" : "PUT" };
        })
        .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
        .slice(0, 10);

    const rankGross = (bars: typeof barsAll) =>
      [...bars]
        .map((d) => {
          const putMag = Math.abs(d.put);
          const total = d.call + putMag; // call + |put|
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
    };
  }, [data]);

  // Brasília time string (BRT)
  const asOfBR = useMemo(
    () => fmtTZ(data?.asOfMs, "pt-BR", "America/Sao_Paulo"),
    [data?.asOfMs]
  );

  if (!data) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>
        <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
          <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
            <Link href="/" className="hover:underline">
              <h1 className="text-2xl">vovonacci@PJT</h1>
            </Link>
          </div>
          <div className="flex items-center justify-center p-6">
            Carregando os dados...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* same background layer as Home */}
      <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>

      {/* same container / header as Home */}
      <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
        <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
          <Link href="/" className="hover:underline">
            <h1 className="text-2xl">vovonacci@PJT</h1>
          </Link>
        </div>

        {/* dataset meta (timestamp + 0DTE) */}
        <div className="px-10 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-neutral-800/60 px-2 py-0.5">
              timestamp de coleta de dados (GMT-3): {asOfBR}
            </span>
            <span className="rounded-md border border-neutral-800/60 px-2 py-0.5">
              0DTE: {data.zeroDteExpiry ?? "—"}
            </span>
          </div>
        </div>

        {/* Six ranking cards in one responsive row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 pt-2">
          {/* CALL (all) */}
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

          {/* PUT (all) */}
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

          {/* NET (all) */}
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
                    <span className="text-xs text-neutral-400">({r.dom})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* TOTAL (all) */}
          <div className="rounded-xl border border-neutral-800/60 p-4">
            <div className="text-sm font-semibold text-center mb-3 text-neutral-200">
              TOTAL GEX <span className="text-neutral-500">(todas)</span>
            </div>
            <ul className="text-sm space-y-2">
              {tables!.topGrossAll.map((r, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-indigo-400">{r.strike}</span>
                  <span className="tabular-nums">
                    <span className="text-neutral-300 mr-2">
                      {fmtBig(r.total)}
                    </span>
                    <span
                      className={`text-xs ${
                        r.dom === "CALL" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      ({r.dom} dom)
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Charts */}
        <div className="px-10 w-full space-y-6 pb-10">
          <GexMassChart
            title="Call vs Put Mass — 0DTE"
            data={data.mass0Bars}
            spot={data.spot}
            callResistance={data.levels.zeroDTE?.callResistance ?? undefined}
            putSupport={data.levels.zeroDTE?.putSupport ?? undefined}
          />
          <GexMassChart
            title="Call vs Put Mass — todas as expirações"
            data={data.massAllBars}
            spot={data.spot}
            callResistance={data.levels.callResistance}
            putSupport={data.levels.putSupport}
          />
        </div>
      </div>
    </div>
  );
}
