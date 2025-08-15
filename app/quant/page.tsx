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

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await getMassForCharts("I:SPX", 6465);
      setData(res);
    })();
  }, []);

  useEffect(() => {
    if (!data?.levels) return;
    const { callResistance, putSupport, zeroDTE } = data.levels;
    console.log("[NÍVEIS GAMMA - TODAS EXPIRAÇÕES]", {
      CR: callResistance,
      PS: putSupport,
    });
    if (zeroDTE) {
      console.log("[NÍVEIS GAMMA - 0DTE]", {
        data: zeroDTE.expiry,
        CR0DTE: zeroDTE.callResistance,
        PS0DTE: zeroDTE.putSupport,
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

    return {
      topPutsAll: rankPuts(barsAll),
      topCallsAll: rankCalls(barsAll),
      topNetAll: rankNet(barsAll),
      topGrossAll: rankGross(barsAll),
      topPuts0: rankPuts(bars0),
      topCalls0: rankCalls(bars0),
    };
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
  const net0 = useMemo(
    () =>
      (data?.mass0Bars ?? []).reduce(
        (sum: number, d: any) => sum + (d.call || 0) + (d.put || 0),
        0
      ),
    [data?.mass0Bars]
  );

  const EPS = 0;
  function regime(net: number) {
    if (net > EPS) return "positiva";
    if (net < -EPS) return "negativa";
    return "neutra";
  }
  const regimeAll = regime(netAll);
  const regimeClass = (r: string) =>
    r === "positiva"
      ? "text-emerald-400 border-emerald-800/60"
      : r === "negativa"
      ? "text-red-400 border-red-800/60"
      : "text-neutral-300 border-neutral-700/60";

  if (!data) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>
        <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
          <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
            <Link href="/" className="hover:underline">
              <h1 className="text-2xl">Vovonacci@PJT</h1>
            </Link>
          </div>
          <div className="flex flex-col items-center justify-center p-6 gap-3 text-neutral-300">
            <Spinner />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>

      <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
        <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
          <Link href="/" className="hover:underline">
            <h1 className="text-2xl">Vovonacci@PJT</h1>
          </Link>
        </div>

        <div className="px-10 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-indigo-800/80 text-indigo-400 font-semibold px-2 py-0.5">
              {"$SPX"}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 ${regimeClass(
                regimeAll
              )}`}
            >
              exposição gamma: {regimeAll}
            </span>
            <span className="rounded-md border border-neutral-800/60 px-2 py-0.5">
              timestamp de coleta de dados (GMT-3): {asOfBR}
            </span>
            <span className="rounded-md border border-neutral-800/60 px-2 py-0.5">
              0DTE: {data.zeroDteExpiry ?? "—"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 pt-2">
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
                      ({r.dom})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className=" w-full space-y-6 pb-10">
          <GexMassChart
            title="Call vs Put GEX — 0DTE"
            data={data.mass0Bars}
            spot={data.spot}
            callResistance={data.levels.zeroDTE?.callResistance ?? undefined}
            putSupport={data.levels.zeroDTE?.putSupport ?? undefined}
          />
          <GexMassChart
            title="Call vs Put GEX — todas as expirações"
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
