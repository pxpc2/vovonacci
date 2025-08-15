"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getGexForCharts } from "./actions";
import { toBarData } from "../../utils/math/gex-format";
import GexChart from "../components/GexChart";

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await getGexForCharts("I:SPX", 6465);
      setData({
        spot: res.spot,
        levels: res.levels,
        allBars: toBarData(res.curves.netAll),
        dteBars: toBarData(res.curves.net0dte ?? []),
        debug: res.debug,
        zeroExp: res.curves.zeroDteExpiry,
      });
      console.log("Top 0DTE put mass:", res.debug); // debugando: 6400 vs 6450
    })();
  }, []);

  if (!data) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl  hover:underline">
          vovonacci@PJT
        </Link>
        <div className="text-sm text-gray-500">
          data expiração 0DTE: {data.zeroExp ?? "—"}
        </div>
      </div>
      <div className="mx-[460px] items-center flex flex-col sm:gap-10">
        <GexChart
          title="Net GEX — todas as expirações"
          data={data.allBars}
          spot={data.spot}
          callResistance={data.levels.callResistance}
          putSupport={data.levels.putSupport}
        />

        <GexChart
          title="Net GEX — 0DTE"
          data={data.dteBars}
          spot={data.spot}
          callResistance={data.levels.zeroDTE?.callResistance ?? undefined}
          putSupport={data.levels.zeroDTE?.putSupport ?? undefined}
        />
      </div>
      {/*  debug list */}
      {data.debug?.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">
            Strikes 0DTE com maior volume de PUT
          </div>
          <ul className="space-y-1">
            {data.debug.map((r: any, i: number) => (
              <li key={i}>
                {r.strike}: {Math.round(r.mass).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
