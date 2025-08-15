"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getMassForCharts } from "./actions";
import GexMassChart from "../components/GexChart";

export default function Page() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const res = await getMassForCharts("I:SPX", 6465);
      setData(res);
      console.log("Top 0DTE put mass:", res.debugTop0dtePut);
    })();
  }, []);

  if (!data) return <div className="p-6">calculando dados quant...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold">
          vovonacci@PJT
        </Link>
        <div className="text-sm text-gray-500">
          data expiração 0DTE: {data.zeroDteExpiry ?? "—"}
        </div>
      </div>
      <div className="px-10 w-full">
        <div className="">
          <GexMassChart
            title="Call vs Put Mass — todas as expirações"
            data={data.massAllBars}
            spot={data.spot}
            callResistance={data.levels.callResistance}
            putSupport={data.levels.putSupport}
          />
        </div>
        <GexMassChart
          title="Call vs Put Mass — 0DTE"
          data={data.mass0Bars}
          spot={data.spot}
          callResistance={data.levels.zeroDTE?.callResistance ?? undefined}
          putSupport={data.levels.zeroDTE?.putSupport ?? undefined}
        />
      </div>
    </div>
  );
}
