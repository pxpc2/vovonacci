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

  const lv = data.levels;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[url('/wp.png')] bg-cover bg-center bg-no-repeat opacity-15 z-0"></div>

      <div className="relative z-10 font-sans flex flex-col gap-4 mx-12 sm:mx-32 h-full">
        <div className="flex font-medium items-center justify-center pt-10 pb-8 border-b border-gray-400">
          <Link href="/" className="hover:underline">
            <h1 className="text-2xl">Vovonacci@PJT</h1>
          </Link>
        </div>

        {/* Meta topo */}
        <div className="px-10 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="rounded-md border border-indigo-800/80 text-indigo-400 font-semibold px-2 py-0.5">
              {`$SPX - spot @ ${data.spot}`}
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 ${regimeClass(
                regimeAll
              )}`}
            >
              exposição γ: {regimeAll}
            </span>
            <span className="rounded-md border border-neutral-800/60 px-2 py-0.5">
              timestamp de coleta de dados (GMT-3): {asOfBR}
            </span>
            <span className="rounded-md border border-neutral-800/60 px-2 py-0.5">
              0DTE: {data.zeroDteExpiry ?? "—"}
            </span>
          </div>
        </div>

        {/* NÍVEIS — 2 cartões: primários e secundários */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* NÍVEIS PRIMÁRIOS (CR/PS/HVL de todas e 0DTE) */}
          <div className="rounded-xl border border-neutral-800/60 p-4">
            <div className="text-md font-semibold text-center mb-3 text-neutral-200"></div>
            <ul className="text-sm space-y-2">
              <li className="flex items-center justify-between">
                <span className="text-red-400 font-medium">
                  Call Resistance
                </span>
                <span className="tabular-nums">
                  {lv?.callResistance ?? "—"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-emerald-400 font-medium">
                  Put Support
                </span>
                <span className="tabular-nums">{lv?.putSupport ?? "—"}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-violet-400 font-medium">HVL</span>
                <span className="tabular-nums">{lv?.hvl ?? "—"}</span>
              </li>

              <li className="h-px bg-neutral-800/60 my-2" />

              <li className="flex items-center justify-between">
                <span className="text-red-400 font-medium">
                  Call Resistance 0DTE
                </span>
                <span className="tabular-nums">
                  {lv?.zeroDTE?.callResistance ?? "—"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-emerald-400 font-medium">
                  Put Support 0DTE
                </span>
                <span className="tabular-nums">
                  {lv?.zeroDTE?.putSupport ?? "—"}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-violet-400 font-medium">HVL 0DTE</span>
                <span className="tabular-nums">{lv?.zeroDTE?.hvl ?? "—"}</span>
              </li>
            </ul>
          </div>

          {/* NÍVEIS SECUNDÁRIOS (GEX 1–6 0DTE) */}
          <div className="rounded-xl border border-neutral-800/60 p-4">
            <div className="text-sm font-semibold text-center mb-3 text-neutral-200"></div>
            <ul className="text-sm space-y-2">
              {gexMinor.length === 0 && (
                <li className="text-neutral-500 text-center">sem dados</li>
              )}
              {gexMinor.map((g) => (
                <li key={g.label} className="flex items-center justify-between">
                  <span className="text-cyan-500/70 font-medium">
                    {g.label}
                  </span>
                  <span className="tabular-nums">{g.strike}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bandas 1D (σ) */}
        <div className="rounded-xl border border-neutral-800/60 bg-black/20 p-4 mb-10">
          <div className="text-sm font-semibold mb-3 text-neutral-200">
            variação 1D max/min (σ) — {data.bands?.gammaPositive ? "γ+" : "γ−"}
          </div>

          <div className="text-xs text-neutral-400 mb-3">
            <span className="mr-3">
              σ_real: {pct(data.bands?.sigma?.realized)}
            </span>
            <span className="mr-3">
              σ_impl(1d): {pct(data.bands?.sigma?.implied1d)}
            </span>
            <span className="mr-3">σ_base: {pct(data.bands?.sigma?.base)}</span>
            <span className="mr-3">
              risk-reversal:{" "}
              {data.bands?.sigma?.rr == null
                ? "—"
                : (100 * data.bands.sigma.rr).toFixed(2) + "%"}
            </span>
            <span className="mr-3">σ_up: {pct(data.bands?.sigma?.up)}</span>
            <span className="mr-3">σ_dn: {pct(data.bands?.sigma?.dn)}</span>
          </div>

          {data.bands?.anchors?.spot && (
            <div className="mb-2">
              <div className="text-xs text-neutral-400 mb-1">
                Âncora (spot): {fmtPx(data.bands.anchors.spot.anchor)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded border border-neutral-800/60 p-2">
                  <div className="text-neutral-500 text-xs mb-1">1σ</div>
                  <div>
                    min: {fmtPx(data.bands.anchors.spot.levels["1σ"].min)}
                  </div>
                  <div>
                    max: {fmtPx(data.bands.anchors.spot.levels["1σ"].max)}
                  </div>
                </div>

                <div className="rounded border border-indigo-400 p-2">
                  <div className="text-neutral-500 text-xs mb-1">2σ</div>
                  <div>
                    min: {fmtPx(data.bands.anchors.spot.levels["2σ"].min)}
                  </div>
                  <div>
                    max: {fmtPx(data.bands.anchors.spot.levels["2σ"].max)}
                  </div>
                </div>
                <div className="rounded border border-neutral-800/60 p-2">
                  <div className="text-neutral-500 text-xs mb-1">3σ</div>
                  <div>
                    min: {fmtPx(data.bands.anchors.spot.levels["3σ"].min)}
                  </div>
                  <div>
                    max: {fmtPx(data.bands.anchors.spot.levels["3σ"].max)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {data.bands?.anchors?.hvl && (
            <div className="mt-4">
              <div className="text-xs text-neutral-400 mb-1">
                Âncora (HVL): {fmtPx(data.bands.anchors.hvl.anchor)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded border border-neutral-800/60 p-2">
                  <div className="text-neutral-500 text-xs mb-1">1σ</div>
                  <div>
                    min: {fmtPx(data.bands.anchors.hvl.levels["1σ"].min)}
                  </div>
                  <div>
                    max: {fmtPx(data.bands.anchors.hvl.levels["1σ"].max)}
                  </div>
                </div>
                <div className="rounded border border-neutral-800/60 p-2">
                  <div className="text-neutral-500 text-xs mb-1">2σ</div>
                  <div>
                    min: {fmtPx(data.bands.anchors.hvl.levels["2σ"].min)}
                  </div>
                  <div>
                    max: {fmtPx(data.bands.anchors.hvl.levels["2σ"].max)}
                  </div>
                </div>
                <div className="rounded border border-neutral-800/60 p-2">
                  <div className="text-neutral-500 text-xs mb-1">3σ</div>
                  <div>
                    min: {fmtPx(data.bands.anchors.hvl.levels["3σ"].min)}
                  </div>
                  <div>
                    max: {fmtPx(data.bands.anchors.hvl.levels["3σ"].max)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Charts */}
        <div className=" w-full space-y-6 pb-6">
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
                    <span className="text-xs text-neutral-400">({r.dom})</span>
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
                          r.dom === "CALL" ? "text-emerald-400" : "text-red-400"
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
  );
}
