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

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await getMassForCharts("I:SPX", 6465);
      setData(res);
      console.log("Top 0DTE put mass:", res.debugTop0dtePut);
    })();
  }, []);

  const tables = useMemo(() => {
    if (!data) return null;

    // prefer 0DTE bars; fallback to all-exp
    const bars: Array<{ strike: number; call: number; put: number }> =
      (data.mass0Bars?.length ? data.mass0Bars : data.massAllBars) ?? [];

    // 1) Top Puts (magnitude)
    const topPuts = [...bars]
      .filter((d) => d.put < 0)
      .map((d) => ({ strike: d.strike, value: Math.abs(d.put) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 2) Top Calls (magnitude)
    const topCalls = [...bars]
      .filter((d) => d.call > 0)
      .map((d) => ({ strike: d.strike, value: d.call }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 3) Top Net (|call + put|, with dominance)
    const topNet = [...bars]
      .map((d) => {
        const net = d.call + d.put; // put is negative
        return { strike: d.strike, net, dom: net >= 0 ? "CALL" : "PUT" };
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
      .slice(0, 10);

    // 4) Top Gross GEX (call + |put|)
    const topGross = [...bars]
      .map((d) => {
        const putMag = Math.abs(d.put);
        const total = d.call + putMag; // gross = call + |put|
        const dom = d.call >= putMag ? "CALL" : "PUT";
        return { strike: d.strike, total, dom, call: d.call, putMag };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return { topPuts, topCalls, topNet, topGross };
  }, [data]);

  if (!data)
    return (
      <div className="w-full h-screen flex items-center justify-center p-6">
        Carregando os dados...
      </div>
    );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold hover:underline">
          vovonacci@PJT
        </Link>
        <div className="text-sm text-gray-500">
          data expiração 0DTE: {data.zeroDteExpiry ?? "—"}
        </div>
      </div>

      <div className="px-10 w-full space-y-6">
        <GexMassChart
          title="Call vs Put Mass — todas as expirações"
          data={data.massAllBars}
          spot={data.spot}
          callResistance={data.levels.callResistance}
          putSupport={data.levels.putSupport}
        />

        <GexMassChart
          title="Call vs Put Mass — 0DTE"
          data={data.mass0Bars}
          spot={data.spot}
          callResistance={data.levels.zeroDTE?.callResistance ?? undefined}
          putSupport={data.levels.zeroDTE?.putSupport ?? undefined}
        />

        {/* ======= 4-column rankings ======= */}
        {tables && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            {/* Top Put mass */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 underline underline-offset-6 text-neutral-200">
                PUT STRIKES GEX
              </div>
              <ul className="text-sm space-y-2">
                {tables.topPuts.map((r, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-neutral-300">{r.strike}</span>
                    <span className="text-red-400 tabular-nums">
                      {fmtBig(r.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top Call mass */}
            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 underline underline-offset-6 text-neutral-200">
                CALL STRIKES GEX
              </div>
              <ul className="text-sm space-y-2">
                {tables.topCalls.map((r, i) => (
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
              <div className="text-sm font-semibold text-center mb-3 underline underline-offset-6 text-neutral-200">
                NET GEX
              </div>
              <ul className="text-sm space-y-2">
                {tables.topNet.map((r, i) => (
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

            <div className="rounded-xl border border-neutral-800/60 p-4">
              <div className="text-sm font-semibold text-center mb-3 underline underline-offset-6 text-neutral-200">
                TOTAL GEX
              </div>
              <ul className="text-sm space-y-2">
                {tables.topGross.map((r, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span className="text-indigo-400">{r.strike}</span>
                    <span className="tabular-nums">
                      <span className="text-neutral-400 mr-2">
                        {fmtBig(r.total)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {/* optional: mini breakdown per row; uncomment if you want */}
              {/* <div className="mt-2 text-xs text-neutral-400">
                C {fmtBig(r.call)} · P {fmtBig(r.putMag)}
              </div> */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
